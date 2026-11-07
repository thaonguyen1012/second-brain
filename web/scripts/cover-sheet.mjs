#!/usr/bin/env node
// Contact sheet for the handbook covers (web/public/covers/<slug>.svg, rules in web/components/book-cover.md).
//
//   node web/scripts/cover-sheet.mjs [slug ...] [--out <dir>] [--web <path to web/>]   (default out: <tmp>/cover-sheet)
//
// No slugs = every handbook in the registry. For each slug it lints the SVG (size, viewBox, palette, forbidden
// elements) and renders, at device scale 2, the cover the way components/book-cover.tsx shows it: the Sổ tay card
// band at 320 and 236 px wide (name in HTML over the calm left part), the band on a dark card, the Hôm nay hero
// column from sm (224x168, no name) and its phone band (358 wide, 16:7, with the name), the 64 px square crop, the
// 80x56 shelf row thumb, the 72x82 phone card thumb (every crop object-position right) and the raw SVG at 640x280.
// A missing SVG shows the fallback (ground + name), as the app does. Output: <out>/<slug>.png per cover, <out>/sheet.png for all, lint report on
// stdout (exit 1 when a cover fails a hard rule). Uses the installed Google Chrome (channel 'chrome'); no network.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = { slugs: [], out: path.join(os.tmpdir(), 'cover-sheet'), web: path.resolve(here, '..') };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--out') args.out = path.resolve(process.argv[++i]);
  else if (a === '--web') args.web = path.resolve(process.argv[++i]);
  else if (a === '-h' || a === '--help') {
    console.log('usage: node web/scripts/cover-sheet.mjs [slug ...] [--out <dir>] [--web <path to web/>]');
    process.exit(0);
  } else args.slugs.push(a);
}

const { chromium } = createRequire(path.join(args.web, 'package.json'))('@playwright/test');

// Registry titles -> cover names, the same rule as coverName() in web/lib/book-marks.ts.
const registry = readFileSync(path.join(args.web, 'lib/books.ts'), 'utf8');
const titles = new Map();
for (const m of registry.matchAll(/"slug": "([^"]+)",\s*"title": "([^"]+)"/g)) titles.set(m[1], m[2]);
const coverName = (title) => title.replace(/^sổ tay\s*/iu, '').replace(/^\d+\s*[–-]\s*/u, '').trim() || title;
const slugs = args.slugs.length ? args.slugs : [...titles.keys()];
for (const s of slugs) if (!titles.has(s)) console.warn(`warn: ${s} is not in lib/books.ts`);

// ---- lint ---------------------------------------------------------------------------------------------------
const PALETTE = new Set(['#141413', '#faf9f5', '#e3dacc', '#ebdbbc', '#d4a27f', '#d97757', '#cc785c', '#6a9bcc', '#788c5d']);
const coversDir = path.join(args.web, 'public/covers');
let failed = false;
function lint(slug) {
  const file = path.join(coversDir, `${slug}.svg`);
  if (!existsSync(file)) return { missing: true, notes: ['missing: the app shows the fallback (ground + name)'] };
  const svg = readFileSync(file, 'utf8');
  const bytes = statSync(file).size;
  const errors = [];
  const notes = [];
  if (bytes > 6144) errors.push(`${bytes} bytes > 6144`);
  if (!/viewBox="0 0 320 140"/.test(svg)) errors.push('viewBox must be "0 0 320 140"');
  if (/<text|<tspan|<foreignObject/i.test(svg)) errors.push('text in the SVG (the name is HTML)');
  if (/<image|data:/i.test(svg)) errors.push('embedded raster or data: URI');
  if (/Gradient/i.test(svg)) errors.push('gradient');
  if (/<script|on[a-z]+=|<style|@import|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svg)) errors.push('script, style, event attribute or external URL');
  if (/<(width|height)=/i.test(svg) || /<svg[^>]*\s(width|height)=/i.test(svg)) errors.push('width/height on <svg> (scale comes from CSS)');
  if (/opacity|<mask|<clipPath|xlink:/i.test(svg)) errors.push('opacity, mask, clipPath or xlink: (forbidden, book-cover.md "File")');
  const filters = (svg.match(/<filter/g) || []).length;
  if (filters !== 1) errors.push(`${filters} filters (exactly one grain filter)`);
  const colours = new Set((svg.match(/#[0-9a-f]{3,6}\b/gi) || []).map((c) => c.toLowerCase()));
  const off = [...colours].filter((c) => !PALETTE.has(c));
  if (off.length) errors.push(`off-palette colours: ${off.join(' ')}`);
  const hues = [...colours].filter((c) => !['#141413', '#faf9f5', '#e3dacc'].includes(c));
  if (hues.length > 4) errors.push(`${hues.length} hues besides ink/ivory/ground (max 4): ${hues.join(' ')}`);
  if (!/<rect width="320" height="140" fill="#e3dacc"\/>/.test(svg)) errors.push('first shape must be the flat ground <rect width="320" height="140" fill="#e3dacc"/>');
  const widths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
  if (widths.some((w) => w < 2)) errors.push(`stroke-width below 2: ${widths.filter((w) => w < 2).join(', ')}`);
  notes.push(`${bytes} B, hues: ${hues.join(' ') || 'none'}`);
  return { errors, notes };
}

// ---- fonts: Geist from the Next build, if there is one --------------------------------------------------------
let fontCss = '';
const cssDir = path.join(args.web, '.next/static');
const walk = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
for (const f of walk(cssDir).filter((f) => f.endsWith('.css'))) {
  const css = readFileSync(f, 'utf8');
  const faces = css.match(/@font-face\{font-family:Geist;[^}]*\}/g);
  if (faces) {
    fontCss = [...new Set(faces)]
      .join('\n')
      .replace(/url\(\.\.\/media\/([^)]+)\)/g, (_, file) => `url(${pathToFileURL(path.join(args.web, '.next/static/media', file)).href})`);
    break;
  }
}
if (!fontCss) console.warn('warn: Geist not found in web/.next; names render in the system font');

// ---- sheet ----------------------------------------------------------------------------------------------------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const src = (slug) => pathToFileURL(path.join(coversDir, `${slug}.svg`)).href;
const cover = (slug, { w, h, variant, dark = false }) => {
  const name = coverName(titles.get(slug) ?? slug);
  const img = `<img src="${src(slug)}" alt="">`;
  const label = variant === 'thumb' ? '' : `<span class="name">${esc(name)}</span>`;
  const frame = `<div class="cv" style="width:${w}px;height:${h}px">${img}${label}</div>`;
  return dark ? `<div class="darkcard">${frame}</div>` : frame;
};
const rows = slugs
  .map((slug) => {
    const r = lint(slug);
    const status = r.missing ? 'missing' : r.errors.length ? `FAIL: ${r.errors.join('; ')}` : 'ok';
    return `<section id="${slug}">
  <h2>${esc(slug)} <small>${esc(status)} · ${esc(r.notes.join(' · '))}</small></h2>
  <div class="grid">
    <figure>${cover(slug, { w: 320, h: 140, variant: 'band' })}<figcaption>band 320</figcaption></figure>
    <figure>${cover(slug, { w: 236, h: 103, variant: 'band' })}<figcaption>band 236 (lg card)</figcaption></figure>
    <figure>${cover(slug, { w: 320, h: 140, variant: 'band', dark: true })}<figcaption>band on dark card</figcaption></figure>
    <figure>${cover(slug, { w: 224, h: 168, variant: 'thumb' })}<figcaption>hero column 224x168 (side, sm+)</figcaption></figure>
    <figure>${cover(slug, { w: 358, h: 157, variant: 'band' })}<figcaption>hero on a phone (side, 16:7)</figcaption></figure>
    <figure>${cover(slug, { w: 64, h: 64, variant: 'thumb' })}<figcaption>64 crop</figcaption></figure>
    <figure>${cover(slug, { w: 80, h: 56, variant: 'thumb' })}<figcaption>shelf row 80x56</figcaption></figure>
    <figure>${cover(slug, { w: 72, h: 82, variant: 'thumb' })}<figcaption>phone card 72x82</figcaption></figure>
    <figure class="raw">${existsSync(path.join(coversDir, `${slug}.svg`)) ? `<img src="${src(slug)}" alt="" width="640" height="280">` : ''}<figcaption>raw 640x280</figcaption></figure>
  </div>
</section>`;
  })
  .join('\n');
const html = `<!doctype html><meta charset="utf-8"><style>
${fontCss}
body{margin:24px;font:13px/1.4 system-ui,sans-serif;background:#fff;color:#111}
h2{font-size:14px;margin:24px 0 8px}h2 small{font-weight:400;color:#666}
.grid{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end}
figure{margin:0}figcaption{color:#666;font-size:11px;margin-top:4px}
.cv{position:relative;overflow:hidden;background:#e3dacc;border-radius:0;container-type:inline-size}
.cv img{position:absolute;inset:0;width:100%;height:100%}
.cv img::after{content:'';position:absolute;inset:0;background:#e3dacc}
.cv img{object-fit:cover;object-position:right}
/* as BookCover: 14-18px with the cover's width, 2 lines, inside the calm left 56% */
.name{position:absolute;left:0;top:0;box-sizing:border-box;max-width:56%;padding:max(12px,4.5cqw) 0 0 max(12px,5cqw);
  font-family:Geist,system-ui,sans-serif;font-weight:600;font-size:clamp(14px,5.5cqw,18px);line-height:1.25;letter-spacing:-.01em;color:#141413;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:balance}
.darkcard{background:#141414;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12)}
.raw img{display:block;background:#e3dacc}
</style>
<body>${rows}</body>`;
mkdirSync(args.out, { recursive: true });
const htmlFile = path.join(args.out, 'contact-sheet.html');
writeFileSync(htmlFile, html);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
await page.route(/^https?:/, (r) => r.abort()); // the sheet is local only
await page.goto(pathToFileURL(htmlFile).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
for (const slug of slugs) await page.locator(`section[id="${slug}"]`).screenshot({ path: path.join(args.out, `${slug}.png`) });
await page.screenshot({ path: path.join(args.out, 'sheet.png'), fullPage: true });
await browser.close();

for (const slug of slugs) {
  const r = lint(slug);
  if (r.errors?.length) failed = true;
  console.log(`${r.missing ? 'miss' : r.errors.length ? 'FAIL' : 'ok  '} ${slug}  ${[...(r.errors ?? []), ...r.notes].join(' · ')}`);
}
console.log(`\n${slugs.length} covers -> ${args.out}/<slug>.png, ${args.out}/sheet.png`);
process.exit(failed ? 1 : 0);
