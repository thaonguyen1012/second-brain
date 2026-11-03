#!/usr/bin/env node
// Build budget (DECISIONS 10.2, 10.3): gzip size of the scripts the home page loads, from the last `npm run build`.
// Counts every <script src> in .next/server/app/index.html except `noModule` ones (modern browsers skip them).
// Usage: node scripts/check-budget.mjs [--max-kb 220]   (kB = 1000 bytes; exits 1 above the limit)
// Without a build it prints a note and exits 0, so `make check` still runs on a fresh clone.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// 220 kB gzip total, approved by the owner on 03/11/2026 (DECISIONS 10.2); Next 16 + React 19 alone ship ~140-150 kB.
const { values } = parseArgs({ options: { 'max-kb': { type: 'string', default: '220' } } });
const maxBytes = Number(values['max-kb']) * 1000;

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = path.join(web, '.next/server/app/index.html');
if (!fs.existsSync(page)) {
  console.log('budget: no production build (.next/server/app/index.html), skipped; run `npm run build` first');
  process.exit(0);
}

// The number is only as fresh as the build: warn when shipped sources changed after it (tests and docs excluded).
const buildId = path.join(web, '.next/BUILD_ID');
const builtAt = fs.statSync(fs.existsSync(buildId) ? buildId : page).mtimeMs;
const newer = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(tsx?|mjs|js|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      if (fs.statSync(file).mtimeMs > builtAt) newer.push(path.relative(web, file));
    }
  }
}
for (const dir of ['app', 'components', 'lib']) scan(path.join(web, dir));

const html = fs.readFileSync(page, 'utf8');
const rows = [];
let skipped = 0;
for (const [tag, src] of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) {
  if (!src.startsWith('/_next/')) continue;
  if (/\bnomodule\b/i.test(tag)) {
    skipped += 1;
    continue;
  }
  const file = path.join(web, '.next', src.replace(/^\/_next\//, '').split('?')[0]);
  rows.push({ src, gzip: zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length });
}
const total = rows.reduce((sum, r) => sum + r.gzip, 0);
const built = new Date(builtAt).toLocaleString('sv-SE', { timeZone: 'Europe/Prague' }).slice(0, 16);
for (const r of rows.sort((a, b) => b.gzip - a.gzip).slice(0, 5)) {
  console.log(`budget:   ${(r.gzip / 1000).toFixed(1).padStart(6)} kB  ${r.src}`);
}
const kb = (n) => `${(n / 1000).toFixed(1)} kB`;
console.log(
  `budget: home First Load JS ${kb(total)} gzip in ${rows.length} scripts (${skipped} noModule skipped; build ${built} Prague), limit ${kb(maxBytes)}`,
);
if (newer.length) {
  console.warn(
    `budget: WARNING the build is older than ${newer.length} source file(s) (${newer.slice(0, 3).join(', ')}` +
      `${newer.length > 3 ? ', ...' : ''}); this number may be stale, run \`npm run build\` to measure them`,
  );
}
if (total > maxBytes) {
  console.error(`budget: over the limit by ${kb(total - maxBytes)}`);
  process.exit(1);
}
