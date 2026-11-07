// Cursor pages loaded in full, for pages that show every record at once (the Dự án and Thư viện boards and lists).
// Pure: the page passes its own fetchers, so this is unit-tested in pages.test.ts.
import type { Page } from './client';

/** Cap of loadAllPages: 20 pages of 100 records. */
export const MAX_PAGES = 20;

/**
 * Every page of a cursor list in one Page (rows already seen are skipped). `next` stays set when the cap stopped
 * it, so the page can still offer "Tải thêm".
 */
export async function loadAllPages<T extends { id: number }>(
  first: () => Promise<Page<T>>,
  page: (next: string) => Promise<Page<T>>,
  maxPages = MAX_PAGES,
): Promise<Page<T>> {
  const head = await first();
  const results = [...head.results];
  const seen = new Set(results.map((r) => r.id));
  let next = head.next;
  for (let n = 1; next && n < maxPages; n++) {
    const more = await page(next);
    for (const r of more.results) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      results.push(r);
    }
    next = more.next;
  }
  return { results, next };
}
