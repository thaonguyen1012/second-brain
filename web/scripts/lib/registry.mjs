// Read/write the book registry block in web/lib/books.ts and compute counts from content.
import fs from 'node:fs';
import path from 'node:path';
import { WEB_DIR, CONTENT_DIR } from './book-import.mjs';

const BOOKS_TS = path.join(WEB_DIR, 'lib/books.ts');
const START = '// BOOKS:START';
const END = '// BOOKS:END';

export function readRegistry() {
  const src = fs.readFileSync(BOOKS_TS, 'utf8');
  const block = src.slice(src.indexOf(START) + START.length, src.indexOf(END));
  return JSON.parse(block.replace(/^\s*export const books: Book\[\] =/, '').replace(/;\s*$/, '').trim());
}

export function writeRegistry(books) {
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

export function registerBook({ slug, title, description = '', track, originalHtml = null, courseraUrls = [], order }) {
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
  };
  if (existing) Object.assign(existing, entry);
  else books.push(entry);
  writeRegistry(books);
  return entry;
}
