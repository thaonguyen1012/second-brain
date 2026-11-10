#!/usr/bin/env node
// Import a handbook into the site: unzip/read, merge items into learning units, normalize,
// write web/content/docs/<track>/<slug>/, register in lib/books.ts, re-index search.
//
//   node web/scripts/import-gitbook.mjs <zip|html|folder> --track <track> --slug <slug> --title "<title>"
//        [--from zip|html|markdown-dir] [--description "..."] [--merge auto|m2|module|m1|none] [--cover <name>]
//        [--replace] [--no-register]
//
// --cover names a drawing of web/public/covers/ (without ".svg"); without it a new book gets one by its slug.
//
// A .zip is a GitBook markdown export (SUMMARY.md); a .html is a single-file handbook with an
// embedded book-data block; a folder (--from markdown-dir, the default for a folder) holds markdown files: with a
// SUMMARY.md it is read like the zip, without one its folders are the modules (readMarkdownDir in lib/book-import.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readGitbookZip, readHtmlBook, readMarkdownDir, parseSummary, writeBook, CONTENT_DIR, WEB_DIR } from './lib/book-import.mjs';
import { mergeBook, readmeGroups } from './lib/merge.mjs';
import { coverNames, registerBook, trackSlugs } from './lib/registry.mjs';
import { rebuildSearch } from './lib/search-db.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    track: { type: 'string' },
    slug: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', default: '' },
    merge: { type: 'string', default: 'auto' },
    from: { type: 'string' },
    cover: { type: 'string' },
    replace: { type: 'boolean', default: false },
    'no-register': { type: 'boolean', default: false },
  },
});

const [input] = positionals;
const { track, slug, title } = values;
if (!input || !track || !slug || !title) {
  console.error(
    'Usage: import-gitbook.mjs <zip|html|folder> --track <track> --slug <slug> --title "<title>" [--from zip|html|markdown-dir] [--merge auto|m2|module|m1|none] [--cover <name>] [--replace]',
  );
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(track)) {
  console.error('track and slug must be lowercase ASCII (a-z, 0-9, -)');
  process.exit(1);
}
if (!trackSlugs().includes(track)) {
  console.error(`--track must be one of: ${trackSlugs().join(', ')} (the groups of lib/books.ts)`);
  process.exit(1);
}
if (values.cover !== undefined && !coverNames().includes(values.cover)) {
  console.error(`--cover must be one of: ${coverNames().join(', ')}`);
  process.exit(1);
}

const t0 = performance.now();
let pages;
let tree;
let sections = null;
let dirAliases = new Map();
const from =
  values.from ?? (fs.existsSync(input) && fs.statSync(input).isDirectory() ? 'markdown-dir' : input.endsWith('.html') ? 'html' : 'zip');
if (!['zip', 'html', 'markdown-dir'].includes(from)) {
  console.error('--from must be zip, html or markdown-dir');
  process.exit(1);
}
if (from === 'html') ({ pages, tree, sections } = readHtmlBook(path.resolve(input)));
else if (from === 'markdown-dir') ({ pages, tree, aliases: dirAliases } = readMarkdownDir(input));
else {
  const zip = readGitbookZip(path.resolve(input));
  pages = zip.pages;
  tree = parseSummary(zip.summary);
}
const itemsBefore = pages.size;

// auto: lesson-group labels available -> m2; course > module > item tree -> module; else m1
let mode = values.merge;
if (mode === 'auto') {
  const readmes = [...pages.entries()].filter(([p]) => p.endsWith('README.md'));
  const labelled = (sections?.size ?? 0) > 0 || readmes.some(([, md]) => Object.values(readmeGroups(md)).some(Boolean));
  const depth = (nodes) => Math.max(0, ...nodes.filter((n) => n.children?.length).map((n) => 1 + depth(n.children)));
  mode = labelled ? 'm2' : depth(tree.children) >= 2 ? 'module' : 'm1';
}
const { aliases, report } = mode === 'none' ? { aliases: new Map(), report: { mode } } : mergeBook({ tree, pages, mode, sections });
// a folder's index.md is filed as its README.md: links to the index.md file follow it (through a merge too)
for (const [file, { src }] of dirAliases) aliases.set(file, aliases.get(src) ?? { src, anchor: null });

const bookDir = path.join(CONTENT_DIR, track, slug);
if (fs.existsSync(bookDir)) {
  if (!values.replace) {
    console.error(`${bookDir} exists; pass --replace to re-import`);
    process.exit(1);
  }
  fs.rmSync(bookDir, { recursive: true });
}
const originalHtml = fs.existsSync(path.join(WEB_DIR, 'public/original', `${slug}.html`)) ? `/original/${slug}.html` : null;

const stats = writeBook({
  pages,
  tree,
  track,
  slug,
  title,
  aliases,
  bookFrontmatter: { description: values.description, track, originalHtml },
  fileUrl: (name) => `/files/${slug}/${name}`,
});

const entry = values['no-register']
  ? null
  : registerBook({ slug, title, description: values.description, track, originalHtml, cover: values.cover });
const search = rebuildSearch([slug]);

console.log(
  JSON.stringify(
    {
      slug,
      from,
      mode,
      itemsInSource: itemsBefore,
      pagesWritten: stats.pages,
      lessonCount: entry?.lessonCount,
      cover: entry?.cover,
      merge: report,
      hints: stats.hints ?? 0,
      attachments: stats.files ?? 0,
      linksRewritten: stats.links ?? 0,
      unresolvedLinks: stats.unresolvedLinks ?? [],
      missingSrc: stats.missingSrc,
      unlistedPages: stats.unlisted,
      searchRows: search.rows,
      seconds: +((performance.now() - t0) / 1000).toFixed(1),
    },
    null,
    2,
  ),
);
