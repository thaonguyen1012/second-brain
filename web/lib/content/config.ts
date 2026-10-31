import path from 'node:path';

/** Directory holding <track>/<book>/ markdown. Read at runtime, never bundled. */
export const CONTENT_DIR = path.resolve(process.env.CONTENT_DIR ?? path.join(process.cwd(), 'content/docs'));

/** BUILD_SUBSET=slug,slug limits the books loaded (dev / UI work). Empty = all books. */
export const BUILD_SUBSET: string[] = (process.env.BUILD_SUBSET ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function inSubset(bookSlug: string): boolean {
  return BUILD_SUBSET.length === 0 || BUILD_SUBSET.includes(bookSlug);
}
