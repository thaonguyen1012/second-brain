#!/usr/bin/env node
// Make attachment links (/files/<book>/<name>) work: clone each referenced file from
// raw/tai-lieu-so-tay-N/ into web/public/files/<book>/ with `cp -c` (APFS clone, no extra disk).
// public/files/ is gitignored; in production /files/ is served separately behind login.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { WEB_DIR, CONTENT_DIR } from './lib/book-import.mjs';

const RAW = path.resolve(WEB_DIR, '../raw');
const SOURCES = {
  'handbook-01': 'tai-lieu-so-tay-1',
  'handbook-02': 'tai-lieu-so-tay-2',
  'handbook-03': 'tai-lieu-so-tay-3',
  'handbook-04': 'tai-lieu-so-tay-4',
  'handbook-05': 'tai-lieu-so-tay-5',
};

function index(dir) {
  const byId = new Map();
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.includes('__')) byId.set(e.name.split('__')[0], p);
    }
  })(dir);
  return byId;
}

let copied = 0;
let present = 0;
const missing = [];
for (const [book, folder] of Object.entries(SOURCES)) {
  const bookDir = fs.readdirSync(CONTENT_DIR).map((t) => path.join(CONTENT_DIR, t, book)).find((d) => fs.existsSync(d));
  if (!bookDir || !fs.existsSync(path.join(RAW, folder))) continue;
  const byId = index(path.join(RAW, folder));
  const names = new Set();
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md'))
        for (const m of fs.readFileSync(p, 'utf8').matchAll(new RegExp(`\\(/files/${book}/([^)\\s]+)\\)`, 'g')))
          names.add(decodeURI(m[1]));
    }
  })(bookDir);
  const out = path.join(WEB_DIR, 'public/files', book);
  fs.mkdirSync(out, { recursive: true });
  for (const name of names) {
    const dest = path.join(out, name);
    if (fs.existsSync(dest)) {
      present++;
      continue;
    }
    // GitBook asset name: <course>__<id>__<file>
    const src = byId.get(name.split('__')[1]);
    if (!src) {
      missing.push(`${book}/${name}`);
      continue;
    }
    execFileSync('cp', ['-c', src, dest]);
    copied++;
  }
}
console.log(`attachments: ${copied} cloned, ${present} already present, ${missing.length} missing`);
for (const m of missing) console.log(`  missing: ${m}`);
