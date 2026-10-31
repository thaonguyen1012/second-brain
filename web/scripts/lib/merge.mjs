// Merge step: turns item pages (one per video/reading/quiz) into learning units.
//   m2     — IT books: one page per lesson group inside a module (module index stays its own page).
//   module — Handbook books: one page per module, split into "Phần N" above ~120 KB or 12 lessons.
//   m1     — fallback: fold near-empty pages into the previous page.
// Only structure changes: each item becomes a `## <item title> [#<item id>]` section, its own
// headings move one level down, its text is kept as is.
import path from 'node:path';

const MODULE_MAX_BYTES = 120 * 1024;
const MODULE_MAX_LESSONS = 12;

export function slugify(text, max = 60) {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/, '') || 'phan'
  );
}

const isReadme = (src) => path.posix.basename(src).toLowerCase() === 'readme.md';
const itemId = (src) => path.posix.basename(src, '.md');

/** Split off the leading H1 (title) of an item. */
function splitTitle(md) {
  const text = md.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const h1 = text.match(/^\s*#\s+(.+?)\s*#*\s*\n/);
  return h1 ? { title: h1[1].trim(), body: text.slice(h1[0].length) } : { title: null, body: text };
}

/** Shift every ATX heading down one level (outside fenced code). */
export function demoteHeadings(body) {
  let fence = null;
  return body
    .split('\n')
    .map((line) => {
      const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (f) {
        if (!fence) fence = f[1];
        else if (f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
        return line;
      }
      if (fence) return line;
      return line.replace(/^(#{1,5})(\s)/, '#$1$2');
    })
    .join('\n');
}

function section(node, md) {
  const { title, body } = splitTitle(md);
  const heading = (title ?? node.title).replace(/\s*\[#[^\]]*\]\s*$/, '');
  return `## ${heading} [#${itemId(node.src)}]\n\n${demoteHeadings(body).trim()}\n`;
}

/** Group labels from a module README's "🔗 Bài học trong module" list: { 'file.md': label }. */
export function readmeGroups(md) {
  const start = md.indexOf('🔗 Bài học trong module');
  if (start < 0) return {};
  const out = {};
  let label = null;
  for (const line of md.slice(start).split('\n').slice(1)) {
    if (/^#{1,2}\s/.test(line)) break;
    const b = line.trim().match(/^\*\*(.+?)\*\*$/);
    if (b) {
      label = b[1].trim();
      continue;
    }
    const l = line.match(/^\s*[-*]\s+.*?\]\(([^)]+\.md)\)/);
    if (l) out[decodeURI(l[1])] = label;
  }
  return out;
}

const isModule = (n) => n.children?.length > 0 && n.children.every((c) => !c.children?.length && !c.separator);

function walkModules(nodes, fn, parent = null) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.separator || !n.children?.length) continue;
    if (isModule(n)) fn(n, nodes, i, parent);
    else walkModules(n.children, fn, n);
  }
}

/**
 * Apply a merge mode. Mutates `tree` and `pages` (adds synthetic pages), returns
 * { aliases: Map<itemSrc, {src, anchor}>, report }.
 * opts.sections: optional Map<itemSrc, label> (authoritative group labels, e.g. from book-data).
 */
export function mergeBook({ tree, pages, mode, sections = null }) {
  const aliases = new Map();
  const report = { mode, groups: 0, parts: 0, folded: 0, missingLabels: 0 };
  const merged = (node, src, title, members, extraHead = '') => {
    const body = members.map((m) => section(m, pages.get(m.src) ?? '')).join('\n');
    pages.set(src, `# ${title}\n\n${extraHead ? `${extraHead.trim()}\n\n` : ''}${body}`);
    for (const m of members) aliases.set(m.src, { src, anchor: itemId(m.src) });
    return { title, src, children: [], name: path.posix.basename(src, '.md') };
  };

  if (mode === 'm2') {
    walkModules(tree.children, (mod) => {
      const readme = pages.get(mod.src) ?? '';
      const fromReadme = readmeGroups(readme);
      const groups = [];
      let prev = null;
      for (const child of mod.children) {
        let label = sections?.get(child.src);
        if (label === undefined) label = fromReadme[path.posix.basename(child.src)];
        if (label === undefined || label === null) {
          report.missingLabels++;
          label = prev ?? child.title;
        }
        label = label.replace(/\s+/g, ' ').trim();
        if (groups.length && groups[groups.length - 1].label === label) groups[groups.length - 1].members.push(child);
        else groups.push({ label, members: [child] });
        prev = label;
      }
      const dir = path.posix.dirname(mod.src);
      mod.children = groups.map((g) => {
        const no = itemId(g.members[0].src).match(/^\d+/)?.[0] ?? '';
        const name = `${no ? `${no}-` : ''}${slugify(g.label)}`;
        report.groups++;
        return merged(mod, `${dir}/${name}.md`, g.label, g.members);
      });
    });
  }

  if (mode === 'module') {
    walkModules(tree.children, (mod, siblings, index) => {
      const dir = path.posix.dirname(mod.src);
      const { body: readmeBody } = splitTitle(pages.get(mod.src) ?? '');
      const lessons = mod.children;
      // split at lesson boundaries: first count the parts needed, then spread lessons evenly
      const split = (maxLessons) => {
        const parts = [[]];
        let size = Buffer.byteLength(readmeBody);
        for (const l of lessons) {
          const s = Buffer.byteLength(pages.get(l.src) ?? '');
          const cur = parts[parts.length - 1];
          if (cur.length && (cur.length >= maxLessons || size + s > MODULE_MAX_BYTES)) {
            parts.push([]);
            size = 0;
          }
          parts[parts.length - 1].push(l);
          size += s;
        }
        return parts;
      };
      let parts = split(MODULE_MAX_LESSONS);
      if (parts.length > 1) {
        const even = split(Math.ceil(lessons.length / parts.length));
        if (even.length === parts.length) parts = even;
      }
      const base = path.posix.basename(dir);
      const nodes = parts.map((members, i) => {
        const multi = parts.length > 1;
        const title = multi ? `${mod.title} — Phần ${i + 1}` : mod.title;
        const name = multi ? `${base}-phan-${i + 1}` : base;
        // the module README (overview, lesson list) opens the first part
        return merged(mod, `${dir}/${name}.md`, title, members, i === 0 ? readmeBody : '');
      });
      if (parts.length > 1) report.parts += parts.length;
      aliases.set(mod.src, { src: nodes[0].src, anchor: null });
      siblings.splice(index, 1, ...nodes);
    });
  }

  if (mode === 'm1') {
    const fold = (nodes) => {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.children?.length) fold(n.children);
        if (n.separator || n.children?.length || isReadme(n.src) || i === 0) continue;
        const prevNode = nodes[i - 1];
        if (prevNode.separator || prevNode.children?.length) continue;
        if (!isNearEmpty(pages.get(n.src) ?? '')) continue;
        pages.set(prevNode.src, `${(pages.get(prevNode.src) ?? '').trimEnd()}\n\n${section(n, pages.get(n.src) ?? '')}`);
        aliases.set(n.src, { src: aliases.get(prevNode.src)?.src ?? prevNode.src, anchor: itemId(n.src) });
        nodes.splice(i, 1);
        i--;
        report.folded++;
      }
    };
    fold(tree.children);
  }

  return { aliases, report };
}

/**
 * Near-empty item: nothing from the source course beyond the title, type badge, the
 * "Ý chính" hint, the "do it on Coursera" note and the module quiz list.
 */
export function isNearEmpty(md) {
  const { body } = splitTitle(md);
  const rest = body
    .replace(/\{%\s*hint[\s\S]*?\{%\s*endhint\s*%\}/g, '')
    .replace(/^`[^`]+`\s*(·.*)?$/gm, '')
    .replace(/^>\s*ℹ️.*$/gm, '')
    .replace(/^## 🧩 Quiz & bài tập của module[\s\S]*?(?=^## |$(?![\s\S]))/gm, '')
    .trim();
  return rest.length === 0;
}
