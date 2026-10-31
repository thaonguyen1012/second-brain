#!/usr/bin/env node
// Download images whose original (signed, expired) Coursera URLs became placeholders.
//
//   node web/scripts/backfill-images.mjs <new-urls.(json|txt)> [--list raw/missing-images.json] [--delay 300]
//
// <new-urls> holds fresh URLs in the SAME ORDER as raw/missing-images.json (a JSON array of strings,
// or one URL per line; empty entries are skipped). Each image is saved to web/public/img/<book>/ and
// every reference to the original URL in that book's markdown is rewritten to the local path.
// Failures are skipped and logged to raw/backfill-images.log. Text is never changed otherwise.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { WEB_DIR, CONTENT_DIR } from './lib/book-import.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    list: { type: 'string', default: path.resolve(WEB_DIR, '../raw/missing-images.json') },
    delay: { type: 'string', default: '300' },
  },
});
if (!positionals[0]) {
  console.error('Usage: backfill-images.mjs <new-urls.json|txt> [--list raw/missing-images.json] [--delay ms]');
  process.exit(1);
}

const missing = JSON.parse(fs.readFileSync(values.list, 'utf8'));
const rawNew = fs.readFileSync(positionals[0], 'utf8');
const fresh = rawNew.trim().startsWith('[') ? JSON.parse(rawNew) : rawNew.split('\n').map((s) => s.trim());
if (fresh.length !== missing.length)
  console.warn(`warning: ${fresh.length} new URLs for ${missing.length} images; matching by position`);

const logFile = path.resolve(WEB_DIR, '../raw/backfill-images.log');
const log = (line) => fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };

function bookDir(book) {
  for (const track of fs.readdirSync(CONTENT_DIR)) {
    const d = path.join(CONTENT_DIR, track, book);
    if (fs.existsSync(d)) return d;
  }
  return null;
}

function rewrite(dir, from, to) {
  let files = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) {
        const text = fs.readFileSync(p, 'utf8');
        if (!text.includes(from)) continue;
        fs.writeFileSync(p, text.split(from).join(to));
        files++;
      }
    }
  })(dir);
  return files;
}

let saved = 0;
let failed = 0;
let skipped = 0;
for (let i = 0; i < missing.length; i++) {
  const entry = missing[i];
  const url = fresh[i];
  if (!url) {
    skipped++;
    continue;
  }
  const dir = bookDir(entry.book);
  if (!dir) {
    log(`SKIP ${i} ${entry.book}: book not imported`);
    skipped++;
    continue;
  }
  try {
    const res = await fetch(url);
    const type = (res.headers.get('content-type') ?? '').split(';')[0];
    if (!res.ok || !type.startsWith('image/')) throw new Error(`HTTP ${res.status} ${type}`);
    const name = crypto.createHash('sha1').update(entry.url).digest('hex').slice(0, 16) + (EXT[type] ?? '.img');
    const outDir = path.join(WEB_DIR, 'public/img', entry.book);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(await res.arrayBuffer()));
    const files = rewrite(dir, entry.url, `/img/${entry.book}/${name}`);
    log(`OK ${i} ${entry.book} -> /img/${entry.book}/${name} (${files} file(s))`);
    saved++;
  } catch (e) {
    log(`FAIL ${i} ${entry.book} ${entry.page}: ${e.message}`);
    failed++;
  }
  await sleep(Number(values.delay));
}
console.log(`backfill: ${saved} saved, ${failed} failed, ${skipped} skipped (log: ${logFile})`);
if (saved) console.log('Restart the server (or rebuild) so cached pages pick up the local images.');
