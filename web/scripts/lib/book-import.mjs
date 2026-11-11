// Shared import logic: GitBook-style markdown (pages + SUMMARY.md) -> web/content/docs/<track>/<slug>/.
// Converts structure and syntax only; page text is never rewritten.
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

export const WEB_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const CONTENT_DIR = path.join(WEB_DIR, 'content/docs');

/** Read a GitBook export zip: returns { pages: Map<srcPath, markdown>, summary, assets: string[] }. */
export function readGitbookZip(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const summaryEntry = entries
    .filter((e) => e.entryName.endsWith('SUMMARY.md'))
    .sort((a, b) => a.entryName.length - b.entryName.length)[0];
  if (!summaryEntry) throw new Error(`No SUMMARY.md in ${zipPath}`);
  const root = summaryEntry.entryName.slice(0, -'SUMMARY.md'.length);
  const pages = new Map();
  const assets = [];
  for (const e of entries) {
    if (!e.entryName.startsWith(root)) continue;
    const rel = e.entryName.slice(root.length);
    if (rel.startsWith('.gitbook/assets/')) assets.push(rel);
    else if (rel.endsWith('.md') && rel !== 'SUMMARY.md') pages.set(rel, e.getData().toString('utf8'));
  }
  return { pages, summary: summaryEntry.getData().toString('utf8'), assets };
}

/**
 * Parse SUMMARY.md into a tree. Nodes: { title, src, children, separator? }.
 * `## Heading` lines become separator nodes at the top level.
 */
export function parseSummary(summary) {
  const root = { children: [] };
  const stack = [{ indent: -1, node: root }];
  for (const raw of summary.replace(/\r\n/g, '\n').split('\n')) {
    const sep = raw.match(/^##\s+(.+?)\s*$/);
    if (sep) {
      root.children.push({ separator: sep[1] });
      stack.length = 1;
      continue;
    }
    const m = raw.match(/^(\s*)[*-]\s+\[(.*)\]\(([^)]+)\)\s*$/);
    if (!m) continue;
    const indent = m[1].replace(/\t/g, '  ').length;
    const node = { title: m[2].trim(), src: decodeURI(m[3].trim()), children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ indent, node });
  }
  return root;
}

const isIndex = (src) => path.posix.basename(src).toLowerCase() === 'readme.md';

/**
 * Decide output paths. A node with children or a README source becomes a folder (index.md),
 * named after its source directory; a leaf page keeps its file name. The SUMMARY nesting
 * defines the output nesting, so the sidebar order equals the SUMMARY order.
 * Returns { files: [{src, out, title}], folders: Map<outDir, {title, pages}> }.
 */
export function planLayout(tree) {
  const files = [];
  const folders = new Map();
  const used = new Set();

  function claim(p) {
    // a `..` or empty segment in an export's paths would write outside the book folder (security audit S-22)
    if (p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) throw new Error(`Unsafe output path: ${p}`);
    if (used.has(p)) throw new Error(`Output path collision: ${p}`);
    used.add(p);
    return p;
  }

  function visit(nodes, outDir, folderMeta) {
    for (const n of nodes) {
      if (n.separator) {
        folderMeta.pages.push(`---${n.separator}---`);
        continue;
      }
      const isFolder = n.children.length > 0 || isIndex(n.src);
      if (outDir === null && isIndex(n.src) && path.posix.dirname(n.src) === '.') {
        // the book's own README
        files.push({ src: n.src, out: claim('index.md'), title: n.title });
        folderMeta.pages.push('index');
        continue;
      }
      const base = outDir ?? '';
      if (isFolder) {
        const name = isIndex(n.src)
          ? path.posix.basename(path.posix.dirname(n.src))
          : path.posix.basename(n.src, '.md');
        const dir = base ? `${base}/${name}` : name;
        const meta = { title: n.title, pages: [] };
        folders.set(dir, meta);
        folderMeta.pages.push(name);
        if (isIndex(n.src)) files.push({ src: n.src, out: claim(`${dir}/index.md`), title: n.title });
        else {
          // a non-README page that has children: keep it as the folder's index
          files.push({ src: n.src, out: claim(`${dir}/index.md`), title: n.title });
        }
        visit(n.children, dir, meta);
      } else {
        const name = path.posix.basename(n.src, '.md');
        files.push({ src: n.src, out: claim(base ? `${base}/${name}.md` : `${name}.md`), title: n.title });
        folderMeta.pages.push(name);
      }
    }
  }

  const rootMeta = { pages: [] };
  folders.set('', rootMeta);
  visit(tree.children, null, rootMeta);
  return { files, folders };
}

/** Split markdown into segments outside/inside fenced code blocks. */
function mapOutsideFences(md, fn) {
  const lines = md.split('\n');
  const out = [];
  let buf = [];
  let fence = null;
  const flush = () => {
    if (buf.length) out.push(fn(buf.join('\n')));
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      out.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) fence = null;
      continue;
    }
    if (m) {
      flush();
      fence = m[1];
      out.push(line);
      continue;
    }
    buf.push(line);
  }
  flush();
  return out.join('\n');
}

const HINT_TYPES = { info: 'info', success: 'success', warning: 'warning', danger: 'danger', tip: 'info' };

/**
 * Normalize one page. ctx: { srcPath, urlOf(srcPath) -> url|null, fileUrl(assetName) -> url|null, stats }.
 * Returns { title, body }.
 */
export function normalizePage(md, ctx) {
  let text = md.replace(/\r\n?/g, '\n').replace(/^﻿/, '');

  // Title: the leading H1 (removed from the body because the layout renders it).
  let title = null;
  const h1 = text.match(/^\s*#\s+(.+?)\s*#*\s*\n/);
  if (h1) {
    title = h1[1].trim();
    text = text.slice(h1[0].length);
  }

  text = mapOutsideFences(text, (seg) => {
    // {% hint style="x" %} ... {% endhint %} -> :::x ... ::: (rendered as Fumadocs Callout)
    seg = seg.replace(/^[ \t]*\{%\s*hint\s+style=["']?(\w+)["']?\s*%\}[ \t]*$/gm, (_, t) => {
      ctx.stats.hints = (ctx.stats.hints ?? 0) + 1;
      return `\n:::${HINT_TYPES[t] ?? 'info'}\n`;
    });
    seg = seg.replace(/^[ \t]*\{%\s*endhint\s*%\}[ \t]*$/gm, '\n:::\n');

    // {% file src="..." %}caption{% endfile %} -> attachment link
    seg = seg.replace(
      /\{%\s*file\s+src=["']([^"']+)["']\s*%\}([\s\S]*?)\{%\s*endfile\s*%\}/g,
      (_, src, caption) => {
        ctx.stats.files = (ctx.stats.files ?? 0) + 1;
        const name = decodeURI(path.posix.basename(src));
        const label = caption.trim() || name;
        const url = ctx.fileUrl(name);
        return url ? `📎 [${label}](${encodeURI(url)})` : `📎 ${label}`;
      },
    );

    // relative links to other pages: [x](../a/b.md#h) and href="a.md"
    const fix = (target) => {
      if (/^[a-z]+:|^#|^\//i.test(target)) return null;
      const [p, hash] = target.split('#');
      if (!p.endsWith('.md')) return null;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(ctx.srcPath), decodeURI(p)));
      const url = hash ? ctx.urlOf(resolved)?.replace(/#.*$/, '') : ctx.urlOf(resolved);
      if (!url) {
        ctx.stats.unresolvedLinks = [...(ctx.stats.unresolvedLinks ?? []), `${ctx.srcPath} -> ${target}`];
        return null;
      }
      ctx.stats.links = (ctx.stats.links ?? 0) + 1;
      return hash ? `${url}#${hash}` : url;
    };
    seg = seg.replace(/(\]\()(<?)([^)\s>]+)(>?)((?:\s+"[^"]*")?\))/g, (all, a, lt, target, gt, rest) => {
      const url = fix(target);
      return url ? `${a}${lt}${url}${gt}${rest}` : all;
    });
    seg = seg.replace(/(href=["'])([^"']+)(["'])/g, (all, a, target, b) => {
      const url = fix(target);
      return url ? `${a}${url}${b}` : all;
    });
    return seg;
  });

  return { title, body: text.replace(/\n{3,}/g, '\n\n').trim() + '\n' };
}

const yamlString = (s) => JSON.stringify(String(s ?? ''));

export function frontmatter(data) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    lines.push(`${k}: ${typeof v === 'string' ? yamlString(v) : JSON.stringify(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

/**
 * Write a whole book. opts: { pages: Map, tree, track, slug, title, bookFrontmatter, fileUrl }.
 * Returns stats.
 */
export function writeBook({ pages, tree, track, slug, title, bookFrontmatter = {}, fileUrl = () => null, aliases = new Map() }) {
  const { files, folders } = planLayout(tree);
  const bookDir = path.join(CONTENT_DIR, track, slug);
  if (fs.existsSync(bookDir)) throw new Error(`${bookDir} already exists, remove it first`);

  const inside = (p) => {
    const resolved = path.resolve(p);
    if (!resolved.startsWith(path.resolve(bookDir) + path.sep)) throw new Error(`Refusing to write outside ${bookDir}: ${p}`);
    return resolved;
  };
  for (const dir of folders.keys()) {
    if (dir && dir.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) throw new Error(`Unsafe folder: ${dir}`);
  }
  const base = `/docs/${track}/${slug}`;
  const urlBySrc = new Map(
    files.map((f) => [f.src, `${base}/${f.out.replace(/(^|\/)index\.md$/, '').replace(/\.md$/, '')}`.replace(/\/$/, '') + '/']),
  );
  // items merged into another page resolve to <merged page url>#<item anchor>
  const urlOf = (p) => {
    const alias = aliases.get(p);
    if (!alias) return urlBySrc.get(p) ?? null;
    const url = urlBySrc.get(alias.src);
    return url ? (alias.anchor ? `${url}#${alias.anchor}` : url) : null;
  };
  const stats = { pages: 0, missingSrc: [], unlisted: [] };

  for (const f of files) {
    const md = pages.get(f.src);
    if (md === undefined) {
      stats.missingSrc.push(f.src);
      continue;
    }
    const { title: h1, body } = normalizePage(md, {
      srcPath: f.src,
      urlOf,
      fileUrl,
      stats,
    });
    const fm =
      f.out === 'index.md'
        ? { title: title ?? h1 ?? f.title, ...bookFrontmatter }
        : { title: h1 ?? f.title };
    const outPath = inside(path.join(bookDir, f.out));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, frontmatter(fm) + body);
    stats.pages++;
  }

  const listed = new Set(files.map((f) => f.src));
  stats.unlisted = [...pages.keys()].filter((p) => !listed.has(p) && !aliases.has(p));

  for (const [dir, meta] of folders) {
    const data = dir === '' ? { title, root: true, pages: meta.pages } : { title: meta.title, pages: meta.pages };
    fs.mkdirSync(path.join(bookDir, dir), { recursive: true });
    fs.writeFileSync(inside(path.join(bookDir, dir, 'meta.json')), JSON.stringify(data, null, 2) + '\n');
  }
  stats.folders = folders.size;
  return stats;
}

/**
 * Read a single-file HTML handbook that embeds its markdown in <script id="book-data">.
 * Returns { pages, tree, sections } where tree mirrors a SUMMARY.md and sections maps
 * item path -> lesson group label (from book-data, authoritative).
 */
export function readHtmlBook(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const marker = '<script id="book-data" type="application/json">';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`${htmlPath} has no book-data block`);
  const end = html.indexOf('</script>', start);
  const data = JSON.parse(html.slice(start + marker.length, end));
  const pages = new Map(Object.entries(data.pages));
  const sections = new Map();
  const root = { children: [] };

  const inChapter = new Set((data.chapters ?? []).map((c) => c.dir).filter(Boolean));
  for (const p of data.order ?? []) {
    if (!p.includes('/') && !inChapter.has(p.replace(/\.md$/, ''))) {
      const md = pages.get(p) ?? '';
      const h1 = md.match(/^\s*#\s+(.+?)\s*\n/);
      root.children.push({ title: h1 ? h1[1].trim() : p, src: p, children: [] });
    }
  }
  let course = null;
  let courseNo = 0;
  for (const ch of data.chapters ?? []) {
    if (ch.course && ch.course !== course) {
      course = ch.course;
      courseNo++;
      root.children.push({ separator: `Khóa ${courseNo}. ${course}` });
    }
    const title = ch.code ? `⭐ ${ch.code} ${ch.title}` : `${ch.tp}. ${ch.title}`;
    const node = { title, src: `${ch.dir}/README.md`, children: [] };
    for (const l of ch.lessons ?? []) {
      node.children.push({ title: l.code ? `${l.code} ${l.title}` : l.title, src: l.file, children: [] });
      if (l.section) sections.set(l.file, l.section);
    }
    root.children.push(node);
  }
  return { pages, tree: root, sections };
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const isFolderIndex = (name) => /^(readme|index)\.md$/i.test(name);

/** A title from a file or folder name: "02-modules_and-lessons.md" -> "Modules and lessons". */
export function titleFromName(name) {
  const base = name.replace(/\.md$/i, '').replace(/^\d+[-_. ]+/, '').replace(/[-_]+/g, ' ').trim() || name;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** The leading H1 of a page, or null. */
const h1Of = (md) => md.replace(/^﻿/, '').match(/^\s*#\s+(.+?)\s*#*\s*(?:\n|$)/)?.[1].trim() ?? null;

/**
 * Read a folder of markdown as a handbook: { pages: Map<srcPath, markdown>, tree, aliases }.
 *
 * With a SUMMARY.md at its top (or in a single top folder) it is read exactly like a GitBook zip. Without one, the
 * folder tree is the structure: sub-folders are modules (nested folders nest), .md files are items, both in
 * natural alphabetical order ("2-x" before "10-x"); a folder's README.md or index.md is its page, and the top
 * folder's is the book's own first page. Titles come from each page's leading H1, else from the file or folder
 * name. A folder without a page of its own gets one that holds only its title, so the module still has a page.
 * index.md is filed as README.md (the name the layout reads as a folder page); `aliases` sends links to the
 * index.md file there. Hidden files and folders (".x") are skipped; other files are ignored. Text is never changed.
 */
export function readMarkdownDir(dirPath) {
  const root0 = path.resolve(dirPath);
  if (!fs.statSync(root0).isDirectory()) throw new Error(`${dirPath} is not a folder`);
  // a single top folder (an unpacked export) is the book
  const visible = (d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'));
  let root = root0;
  const top = visible(root0);
  if (top.length === 1 && top[0].isDirectory()) root = path.join(root0, top[0].name);

  const pages = new Map();
  const aliases = new Map();
  const walk = (dir, rel) => {
    for (const e of visible(dir)) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), relPath);
      else if (/\.md$/i.test(e.name) && relPath !== 'SUMMARY.md') {
        const text = fs.readFileSync(path.join(dir, e.name), 'utf8');
        if (/^index\.md$/i.test(e.name)) {
          const readme = rel ? `${rel}/README.md` : 'README.md';
          if (visible(dir).some((x) => /^readme\.md$/i.test(x.name))) {
            pages.set(relPath, text); // both exist: README.md is the folder's page, index.md an ordinary item
            continue;
          }
          pages.set(readme, text);
          aliases.set(relPath, { src: readme, anchor: null });
        } else if (/^readme\.md$/i.test(e.name)) pages.set(rel ? `${rel}/README.md` : 'README.md', text);
        else pages.set(relPath, text);
      }
    }
  };
  walk(root, '');

  const summaryFile = path.join(root, 'SUMMARY.md');
  if (fs.existsSync(summaryFile)) return { pages, tree: parseSummary(fs.readFileSync(summaryFile, 'utf8')), aliases };

  const titleOf = (src, name) => h1Of(pages.get(src) ?? '') ?? titleFromName(name);
  const build = (dir, rel) => {
    const entries = visible(dir)
      .filter((e) => e.isDirectory() || (/\.md$/i.test(e.name) && !isFolderIndex(e.name) && !(rel === '' && e.name === 'SUMMARY.md')))
      .sort((a, b) => collator.compare(a.name, b.name));
    const nodes = [];
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        const children = build(path.join(dir, e.name), relPath);
        const src = `${relPath}/README.md`;
        if (!pages.has(src)) {
          if (children.length === 0) continue; // no markdown inside
          pages.set(src, `# ${titleFromName(e.name)}\n`);
        }
        nodes.push({ title: titleOf(src, e.name), src, children });
      } else nodes.push({ title: titleOf(relPath, e.name), src: relPath, children: [] });
    }
    // index.md next to a README.md is an ordinary item
    for (const e of visible(dir)) {
      if (/^index\.md$/i.test(e.name) && visible(dir).some((x) => /^readme\.md$/i.test(x.name))) {
        const relPath = rel ? `${rel}/${e.name}` : e.name;
        nodes.push({ title: titleOf(relPath, e.name), src: relPath, children: [] });
      }
    }
    return nodes;
  };
  const children = build(root, '');
  if (pages.has('README.md')) children.unshift({ title: titleOf('README.md', path.basename(root)), src: 'README.md', children: [] });
  return { pages, tree: { children }, aliases };
}
