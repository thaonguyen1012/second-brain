// Read/write the book registry block in web/lib/books.ts and compute counts from content.
import fs from 'node:fs';
import path from 'node:path';
import { WEB_DIR, CONTENT_DIR, frontmatter } from './book-import.mjs';

const BOOKS_TS = path.join(WEB_DIR, 'lib/books.ts');
const START = '// BOOKS:START';
const END = '// BOOKS:END';

export function readRegistry() {
  const src = fs.readFileSync(BOOKS_TS, 'utf8');
  const block = src.slice(src.indexOf(START) + START.length, src.indexOf(END));
  return JSON.parse(block.replace(/^\s*export const books: Book\[\] =/, '').replace(/;\s*$/, '').trim());
}

/** The tracks a handbook can be filed under: the slugs of `TrackSlug` in lib/books.ts. */
export function trackSlugs() {
  const type = fs.readFileSync(BOOKS_TS, 'utf8').match(/export type TrackSlug =([^;]+);/);
  return type ? [...type[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]) : [];
}

/** Keep each book's index.md frontmatter in sync with its registry entry (text below untouched). */
function syncFrontmatter(book) {
  const file = path.join(CONTENT_DIR, book.track, book.slug, 'index.md');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  const end = text.startsWith('---\n') ? text.indexOf('\n---\n', 4) : -1;
  const body = end === -1 ? text : text.slice(end + 5);
  const { title, description, track, order, courseraUrls, originalHtml } = book;
  fs.writeFileSync(file, frontmatter({ title, description, track, order, courseraUrls, originalHtml }) + body);
}

export function writeRegistry(books) {
  for (const b of books) syncFrontmatter(b);
  const src = fs.readFileSync(BOOKS_TS, 'utf8');
  const before = src.slice(0, src.indexOf(START) + START.length);
  const after = src.slice(src.indexOf(END));
  fs.writeFileSync(BOOKS_TS, `${before}\nexport const books: Book[] = ${JSON.stringify(books, null, 2)};\n${after}`);
}

/** lessonCount = learning pages of the book (each has its own "Đã học xong" checkbox). */
export function countBook(track, slug) {
  const dir = path.join(CONTENT_DIR, track, slug);
  let lessons = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith('.md')) lessons++;
    }
  })(dir);
  return { lessonCount: lessons };
}

/** Names of the cover drawings (web/public/covers/<name>.svg, rules in components/book-cover.md), sorted. */
export function coverNames() {
  const dir = path.join(WEB_DIR, 'public/covers');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -'.svg'.length))
    .sort();
}

/**
 * The drawing a book gets when none is named: one of `names`, picked by a hash of the slug (FNV-1a), so the same
 * slug keeps its cover on every import and on every machine. Null when there is no drawing to pick from.
 */
export function pickCover(slug, names = coverNames()) {
  if (names.length === 0) return null;
  let h = 0x811c9dc5;
  for (const ch of Buffer.from(slug, 'utf8')) h = Math.imul(h ^ ch, 0x01000193) >>> 0;
  return names[h % names.length];
}

export function registerBook({ slug, title, description = '', track, originalHtml = null, courseraUrls = [], order, cover }) {
  const books = readRegistry();
  const existing = books.find((b) => b.slug === slug);
  const counts = countBook(track, slug);
  const entry = {
    slug,
    title,
    description,
    track,
    order: order ?? existing?.order ?? books.filter((b) => b.track === track).length + 1,
    ...counts,
    courseraUrls: existing?.courseraUrls ?? courseraUrls,
    originalHtml,
    // a named cover wins, a re-import keeps the book's cover, a new book gets one by its slug
    cover: cover ?? existing?.cover ?? pickCover(slug),
  };
  if (existing) Object.assign(existing, entry);
  else books.push(entry);
  writeRegistry(books);
  return entry;
}
