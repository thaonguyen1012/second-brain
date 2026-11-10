#!/usr/bin/env node
// Attach course links to the handbook registry (the "Liên kết" menu of a Sổ tay card).
//
//   node web/scripts/extract-courses.mjs [materials.zip ...]
//
//  1. web/content/courses.json lists the programs each handbook was written from (shipped empty):
//       [{ "book": "<slug>", "title": "<program name>", "url": "<url or key>" | null, "provider": "Coursera" }]
//     `url` is a full https URL, or a Coursera key ("learn/<course>", "specializations/<name>",
//     "professional-certificates/<name>"), or null. `provider` defaults to "Coursera".
//  2. A Coursera key becomes a link only when it appears in the owner's own material: the imported markdown under
//     web/content/docs, and, when they exist, raw/*.json.gz course materials (also inside the zips given as
//     arguments) and the links of the roadmap PDF (roadmap.json `pdf.href`, read with pdftohtml). A key that
//     appears nowhere gets url: null, and the UI then shows a Coursera search link instead of a guessed URL.
//     Full URLs are kept as written.
//  3. With raw materials it also writes web/content/image-sources.json (image URL -> the lesson that holds it,
//     used by the image placeholders) and raw/courses-extracted.json (what was found, for reference).
// Never prints file contents.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import AdmZip from 'adm-zip';
import { WEB_DIR, CONTENT_DIR } from './lib/book-import.mjs';
import { readRegistry, writeRegistry } from './lib/registry.mjs';

const ROOT = path.resolve(WEB_DIR, '..');
const RAW = path.join(ROOT, 'raw');
const COURSES_FILE = path.join(WEB_DIR, 'content/courses.json');
const ROADMAP_FILE = path.resolve(process.env.ROADMAP_FILE ?? path.join(WEB_DIR, 'content/roadmap.json'));
const COURSERA = 'https://www.coursera.org/';
const KEY_RE = /^(learn|specializations|professional-certificates)\/[a-z0-9-]+$/;
const URL_RE = /https?:\/\/(?:www\.)?coursera\.org\/((?:learn|specializations|professional-certificates)\/[a-z0-9-]+)/g;

const known = new Map(); // "learn/x" | "specializations/x" | "professional-certificates/x" -> where it was seen
const courses = [];
const add = (key, from) => !known.has(key) && known.set(key, from);

// 1a. course materials (optional): raw/*.json.gz and any *.json.gz inside the zips given as arguments
const materials = [];
if (fs.existsSync(RAW))
  for (const f of fs.readdirSync(RAW))
    if (f.endsWith('.json.gz')) materials.push({ name: f, buf: fs.readFileSync(path.join(RAW, f)) });
for (const zip of process.argv.slice(2))
  for (const e of new AdmZip(path.resolve(zip)).getEntries())
    if (e.entryName.endsWith('.json.gz')) materials.push({ name: path.basename(e.entryName), buf: e.getData() });

// image URL (without query string) -> the lesson that contains it
const imageSources = {};
const imgKey = (u) => u.split('?')[0];

for (const { name, buf } of materials) {
  const text = zlib.gunzipSync(buf).toString('utf8');
  const data = JSON.parse(text);
  for (const c of data.courses ?? []) {
    // item URLs follow the pattern seen in the data: coursera.org/learn/<course>/<type>/<item id>
    for (const m of c.modules ?? [])
      for (const l of m.lessons ?? [])
        for (const it of l.items ?? [])
          for (const img of String(it.html ?? '').matchAll(/<img[^>]+src="([^"]+)"/g))
            if (c.slug && it.id && it.type)
              imageSources[imgKey(img[1].replace(/&amp;/g, '&'))] ??= `${COURSERA}learn/${c.slug}/${it.type}/${it.id}`;
    courses.push({ file: name, slug: c.slug, name: c.name, program: c.program ?? data.program, section: c.section ?? null });
    if (c.slug) add(`learn/${c.slug}`, `${name}: course slug`);
    if (KEY_RE.test(c.program ?? '')) add(c.program, `${name}: program`);
  }
  if (data.course && data.tracks) courses.push({ file: name, slug: null, name: data.course, program: data.course, section: null });
  for (const m of text.matchAll(URL_RE)) add(m[1], `${name}: url`);
}

if (materials.length > 0) {
  fs.writeFileSync(path.join(WEB_DIR, 'content/image-sources.json'), JSON.stringify(imageSources, null, 0) + '\n');
  let note = '';
  const missingFile = path.join(RAW, 'missing-images.json');
  if (fs.existsSync(missingFile)) {
    const missing = JSON.parse(fs.readFileSync(missingFile, 'utf8'));
    note = `, ${missing.filter((m) => imageSources[imgKey(m.url)]).length}/${missing.length} placeholders link to their lesson`;
  }
  console.log(`image sources: ${Object.keys(imageSources).length} mapped${note}`);
}

// 1b. links of the roadmap PDF (optional): roadmap.json names it, pdftohtml (poppler) reads it
const pdfLinks = [];
let pdfFile = null;
try {
  const href = JSON.parse(fs.readFileSync(ROADMAP_FILE, 'utf8'))?.pdf?.href;
  if (typeof href === 'string' && /^\/[^/]/.test(href)) pdfFile = path.join(WEB_DIR, 'public', href);
} catch {
  // no roadmap file: nothing to read
}
if (pdfFile && fs.existsSync(pdfFile)) {
  try {
    const pdfHtml = execFileSync('pdftohtml', ['-q', '-i', '-s', '-noframes', '-stdout', pdfFile], {
      maxBuffer: 64 * 1024 * 1024,
    }).toString('utf8');
    for (const m of pdfHtml.matchAll(/<a href="(https?:\/\/[^"]+)">([\s\S]*?)<\/a>/g)) {
      const text = m[2].replace(/<[^>]+>/g, ' ').replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      if (!pdfLinks.some((l) => l.url === m[1])) pdfLinks.push({ url: m[1], text });
      const k = m[1].match(/coursera\.org\/((?:learn|specializations|professional-certificates)\/[a-z0-9-]+)/);
      if (k) add(k[1], 'roadmap PDF');
    }
  } catch (e) {
    console.warn(`roadmap PDF not read (${e.code === 'ENOENT' ? 'pdftohtml is not installed' : e.message})`);
  }
}

// 1c. URLs inside the imported markdown
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) for (const m of fs.readFileSync(p, 'utf8').matchAll(URL_RE)) add(m[1], 'handbook content');
  }
})(CONTENT_DIR);

if (fs.existsSync(RAW))
  fs.writeFileSync(
    path.join(RAW, 'courses-extracted.json'),
    JSON.stringify({ generated: new Date().toISOString(), known: Object.fromEntries(known), courses, pdfLinks }, null, 1),
  );

// 2. programs per book, from content/courses.json
let programs = [];
try {
  programs = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw new Error(`${COURSES_FILE} is not valid JSON: ${e.message}`);
}
if (!Array.isArray(programs)) throw new Error(`${COURSES_FILE} must hold a list`);

const byBook = new Map();
for (const p of programs) {
  if (!p || typeof p.book !== 'string' || typeof p.title !== 'string') throw new Error('courses.json: every entry needs "book" and "title"');
  if (!byBook.has(p.book)) byBook.set(p.book, []);
  byBook.get(p.book).push(p);
}

const linkOf = ({ url }) => {
  if (typeof url !== 'string' || !url) return null;
  if (/^https?:\/\/\S+$/i.test(url)) return url;
  return KEY_RE.test(url) && known.has(url) ? COURSERA + url : null;
};

const books = readRegistry();
const report = [];
for (const b of books) {
  const list = byBook.get(b.slug);
  if (!list) continue;
  b.courseraUrls = list.map((p) => ({ title: p.title, url: linkOf(p), provider: p.provider ?? 'Coursera' }));
  report.push(`${b.slug}: ${b.courseraUrls.filter((c) => c.url).length}/${b.courseraUrls.length} linked`);
}
for (const slug of byBook.keys()) if (!books.some((b) => b.slug === slug)) report.push(`${slug}: not in the registry, skipped`);
if (report.length > 0) writeRegistry(books);
console.log(`extracted: ${courses.length} courses, ${known.size} Coursera URLs/keys, ${pdfLinks.length} PDF links, ${programs.length} programs in courses.json`);
for (const r of report) console.log(`  ${r}`);
