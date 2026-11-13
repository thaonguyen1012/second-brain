#!/usr/bin/env node
// Make attachment links (/files/<book>/<name>) work on a dev machine: copy every file a handbook's markdown links
// to from a folder of attachments into web/public/files/<book>/ (gitignored; in production /files/ is served
// separately, behind the login).
//
//   node web/scripts/prepare-assets.mjs <book-slug> <folder> [<book-slug> <folder> ...]
//
// A linked file is looked up in the folder (and its subfolders) by its exact name, then by its GitBook asset id:
// the importer writes attachment names as <course>__<id>__<file>, an export folder holds them as <id>__<file>.
// Copies are clones where the file system supports them (APFS, btrfs, XFS), so they take no extra disk.
import fs from 'node:fs';
import path from 'node:path';
import { WEB_DIR, CONTENT_DIR } from './lib/book-import.mjs';

// The book slug goes into a RegExp: its special characters are matched as text (CodeQL js/regex-injection)
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
  console.error('Usage: prepare-assets.mjs <book-slug> <folder> [<book-slug> <folder> ...]');
  process.exit(1);
}

function index(dir) {
  const byName = new Map();
  const byId = new Map();
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        byName.set(e.name, p);
        if (e.name.includes('__')) byId.set(e.name.split('__')[0], p);
      }
    }
  })(dir);
  return { byName, byId };
}

let copied = 0;
let present = 0;
const missing = [];
for (let i = 0; i < args.length; i += 2) {
  const book = args[i];
  const folder = path.resolve(args[i + 1]);
  const bookDir = fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((t) => t.isDirectory())
    .map((t) => path.join(CONTENT_DIR, t.name, book))
    .find((d) => fs.existsSync(d));
  if (!bookDir) {
    console.error(`${book}: no such handbook under ${CONTENT_DIR}`);
    process.exit(1);
  }
  if (!fs.existsSync(folder)) {
    console.error(`${folder}: no such folder`);
    process.exit(1);
  }
  const { byName, byId } = index(folder);
  const names = new Set();
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md'))
        for (const m of fs.readFileSync(p, 'utf8').matchAll(new RegExp(`\\(/files/${escapeRegExp(book)}/([^)\\s]+)\\)`, 'g')))
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
    const src = byName.get(name) ?? byId.get(name.split('__')[1]);
    if (!src) {
      missing.push(`${book}/${name}`);
      continue;
    }
    fs.copyFileSync(src, dest, fs.constants.COPYFILE_FICLONE);
    copied++;
  }
}
console.log(`attachments: ${copied} copied, ${present} already present, ${missing.length} missing`);
for (const m of missing) console.log(`  missing: ${m}`);
