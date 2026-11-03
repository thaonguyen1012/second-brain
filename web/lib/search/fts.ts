import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SortedResult } from 'fumadocs-core/search';
import { BUILD_SUBSET } from '../content/config';

const SEARCH_DB = path.resolve(process.env.SEARCH_DB ?? path.join(process.cwd(), 'data/search.sqlite'));

let db: DatabaseSync | null = null;
let warned = false;

function open(): DatabaseSync | null {
  if (db) return db;
  if (!fs.existsSync(SEARCH_DB)) {
    if (!warned) {
      console.warn(
        `[search] Index not found at ${SEARCH_DB}. Search returns no results until you run "npm run search:rebuild".`,
      );
      warned = true;
    }
    return null;
  }
  db = new DatabaseSync(SEARCH_DB, { readOnly: true });
  return db;
}

/** Each word must match; the last one also matches as a prefix (search-as-you-type). */
function toFtsQuery(query: string): string | null {
  const words = query.normalize('NFC').match(/[\p{L}\p{N}]+/gu);
  if (!words?.length) return null;
  return words.map((w, i) => `"${w}"${i === words.length - 1 ? '*' : ''}`).join(' ');
}

interface Row {
  url: string;
  anchor: string;
  page_title: string;
  heading: string;
  snippet: string;
}

export function searchIndex(query: string, books: string[] = []): SortedResult[] {
  const database = open();
  const match = toFtsQuery(query);
  if (!database || !match) return [];

  const scope = books.length ? books : BUILD_SUBSET;
  const where = scope.length ? `AND book IN (${scope.map(() => '?').join(',')})` : '';
  const rows = database
    .prepare(
      `SELECT url, anchor, page_title, heading,
              snippet(sections, -1, '', '', '…', 16) AS snippet
       FROM sections WHERE sections MATCH ? ${where}
       ORDER BY bm25(sections, 10.0, 5.0, 1.0) LIMIT 60`,
    )
    .all(match, ...scope) as unknown as Row[];

  // group by page, keeping rank order of each page's best hit
  const pages = new Map<string, { title: string; hits: Row[] }>();
  for (const r of rows) {
    const p = pages.get(r.url) ?? { title: r.page_title, hits: [] };
    p.hits.push(r);
    pages.set(r.url, p);
  }
  const out: SortedResult[] = [];
  for (const [url, p] of [...pages].slice(0, 20)) {
    out.push({ id: url, type: 'page', url, content: p.title });
    // ids carry the hit index: several hits without an anchor share one target URL, and the
    // search list keys rows by id (duplicate keys leave stale rows on screen)
    p.hits.slice(0, 3).forEach((h, i) => {
      const target = h.anchor ? `${url}#${h.anchor}` : url;
      if (h.heading) out.push({ id: `${target}:h${i}`, type: 'heading', url: target, content: h.heading });
      if (h.snippet) out.push({ id: `${target}:t${i}`, type: 'text', url: target, content: h.snippet });
    });
  }
  return out;
}
