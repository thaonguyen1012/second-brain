#!/usr/bin/env node
// Import a GitBook markdown export into the site.
// Usage: node web/scripts/import-gitbook.mjs <zip> --track <track> --slug <slug> --title "<title>" [--no-register]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readGitbookZip, parseSummary, writeBook, CONTENT_DIR } from './lib/book-import.mjs';
import { registerBook } from './lib/registry.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    track: { type: 'string' },
    slug: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string', default: '' },
    'no-register': { type: 'boolean', default: false },
  },
});

const [zipPath] = positionals;
const { track, slug, title } = values;
if (!zipPath || !track || !slug || !title) {
  console.error('Usage: import-gitbook.mjs <zip> --track <track> --slug <slug> --title "<title>" [--description "..."] [--no-register]');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9-]+$/.test(track)) {
  console.error('track and slug must be lowercase ASCII (a-z, 0-9, -)');
  process.exit(1);
}

const { pages, summary } = readGitbookZip(path.resolve(zipPath));
const tree = parseSummary(summary);
const originalHtml = fs.existsSync(path.join(CONTENT_DIR, '../../public/original', `${slug}.html`))
  ? `/original/${slug}.html`
  : null;

const stats = writeBook({
  pages,
  tree,
  track,
  slug,
  title,
  bookFrontmatter: { description: values.description, track, courseraUrls: [], originalHtml },
  fileUrl: (name) => `/files/${slug}/${name}`,
});

if (!values['no-register']) registerBook({ slug, title, description: values.description, track, originalHtml });

console.log(
  JSON.stringify(
    {
      slug,
      pages: stats.pages,
      folders: stats.folders,
      hints: stats.hints ?? 0,
      attachments: stats.files ?? 0,
      links: stats.links ?? 0,
      unresolvedLinks: stats.unresolvedLinks?.length ?? 0,
      missingSrc: stats.missingSrc,
      unlistedPages: stats.unlisted,
    },
    null,
    2,
  ),
);
