#!/usr/bin/env node
// Check every sidebar tree served at /trees/<book>.json against the markdown on disk:
// each page entry must map to a file (no dead entries), and each file must appear in its tree.
// Usage: node scripts/check-trees.mjs [--base http://localhost:3000]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONTENT_DIR } from './lib/book-import.mjs';
import { readRegistry } from './lib/registry.mjs';

const { values } = parseArgs({ options: { base: { type: 'string', default: 'http://localhost:3000' } } });

const fileOf = (url) => {
  const rel = url.replace(/^\/docs\//, '').replace(/\/$/, '');
  for (const p of [`${rel}.md`, `${rel}/index.md`]) if (fs.existsSync(path.join(CONTENT_DIR, p))) return p;
  return null;
};

let dead = 0;
let orphans = 0;
let entries = 0;
for (const book of readRegistry()) {
  const res = await fetch(`${values.base}/trees/${book.slug}.json`);
  if (!res.ok) {
    console.log(`${book.slug}: HTTP ${res.status}`);
    dead++;
    continue;
  }
  const tree = await res.json();
  const urls = [];
  (function walk(n) {
    if (n.type === 'page') urls.push(n.url);
    if (n.index) urls.push(n.index.url);
    (n.children ?? []).forEach(walk);
  })(tree);
  const seen = new Set();
  const bookDead = [];
  for (const u of urls) {
    const f = fileOf(u);
    if (f) seen.add(f);
    else bookDead.push(u);
  }
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.push(path.relative(CONTENT_DIR, p).split(path.sep).join('/'));
    }
  })(path.join(CONTENT_DIR, book.track, book.slug));
  const bookOrphans = files.filter((f) => !seen.has(f));
  entries += urls.length;
  dead += bookDead.length;
  orphans += bookOrphans.length;
  console.log(`${book.slug}: ${urls.length} entries, ${files.length} files, ${bookDead.length} dead, ${bookOrphans.length} not in tree`);
  for (const u of bookDead.slice(0, 5)) console.log(`  dead: ${u}`);
  for (const f of bookOrphans.slice(0, 5)) console.log(`  not in tree: ${f}`);
}
console.log(`total: ${entries} entries, ${dead} dead, ${orphans} files not in any tree`);
process.exit(dead || orphans ? 1 : 0);
