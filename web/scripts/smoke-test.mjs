#!/usr/bin/env node
// Request a random sample of pages from a running server and check status 200 + expected title.
// Usage: node scripts/smoke-test.mjs [--base http://localhost:3000|auto] [--sample 100] [--book slug ...] [--optional]
//        [--lang vi|en]
// --base auto uses the first server that answers: the owner's next dev (:3000), then make dev (:8080).
// --optional (the pre-commit hook) prints a warning and exits 0 when no server answers instead of failing.
// --lang sends the language cookie (lib/i18n/README.md) and checks the page's <html lang>; Vietnamese by default.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CONTENT_DIR } from './lib/book-import.mjs';

const { values } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000' },
    sample: { type: 'string', default: '100' },
    book: { type: 'string', multiple: true, default: [] },
    optional: { type: 'boolean', default: false },
    lang: { type: 'string', default: 'vi' },
  },
});
if (!['vi', 'en'].includes(values.lang)) {
  console.error(`smoke: --lang must be vi or en, not ${values.lang}`);
  process.exit(2);
}

const AUTO_BASES = ['http://localhost:3000', 'http://127.0.0.1:8080'];
async function answers(base) {
  try {
    await fetch(base + '/', { method: 'HEAD', signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}
const candidates = values.base === 'auto' ? AUTO_BASES : [values.base];
let liveBase = null;
for (const base of candidates) {
  if (await answers(base)) {
    liveBase = base;
    break;
  }
}
if (!liveBase) {
  const msg = `smoke: no web server answers at ${candidates.join(' or ')}`;
  if (values.optional) {
    console.warn(`${msg}; smoke test SKIPPED (start next dev or make dev to run it)`);
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}
values.base = liveBase;
if (candidates.length > 1) console.log(`smoke: using ${liveBase}`);

const pages = [];
for (const track of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
  if (!track.isDirectory()) continue;
  for (const book of fs.readdirSync(path.join(CONTENT_DIR, track.name), { withFileTypes: true })) {
    if (!book.isDirectory() || (values.book.length && !values.book.includes(book.name))) continue;
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.md')) {
          const head = fs.readFileSync(p, 'utf8').slice(0, 2000);
          const m = head.match(/^title:\s*(.*)$/m);
          const title = m ? JSON.parse(m[1]) : '';
          const rel = path.relative(CONTENT_DIR, p).split(path.sep).join('/');
          const url = `/docs/${rel.replace(/(^|\/)index\.md$/, '').replace(/\.md$/, '')}`.replace(/\/$/, '') + '/';
          pages.push({ book: book.name, url, title });
        }
      }
    })(path.join(CONTENT_DIR, track.name, book.name));
  }
}

const n = Math.min(Number(values.sample), pages.length);
const picked = [...pages].sort(() => Math.random() - 0.5).slice(0, n);
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

let ok = 0;
const failures = [];
const times = [];
for (const p of picked) {
  const t = performance.now();
  try {
    const res = await fetch(values.base + encodeURI(p.url), { headers: { cookie: `lang=${values.lang}` } });
    const html = await res.text();
    times.push(performance.now() - t);
    const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
    const lang = html.match(/<html[^>]*\blang="([^"]*)"/)?.[1];
    if (res.status === 200 && title.startsWith(p.title) && lang === values.lang) ok++;
    else failures.push(`${res.status} ${p.url} title="${title}" expected="${p.title}" lang=${lang}`);
  } catch (e) {
    failures.push(`ERR ${p.url} ${e.message}`);
  }
}
times.sort((a, b) => a - b);
const ms = (x) => `${Math.round(x ?? 0)} ms`;
console.log(
  `pages on disk: ${pages.length}; sampled ${n} (${values.lang}): ${ok} ok, ${failures.length} failed; ` +
    `time median ${ms(times[Math.floor(times.length / 2)])}, max ${ms(times.at(-1))}`,
);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
