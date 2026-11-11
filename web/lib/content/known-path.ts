import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_DIR, inSubset } from './config';

const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Whether a lesson URL's slug names a markdown file under CONTENT_DIR (`<slug>.md` or `<slug>/index.md`), checked
 * before the docs page renders: an unknown path would otherwise be rendered as a 404 and cached on disk for good,
 * since the route never revalidates (security audit S-17). Segments outside the importer's slug alphabet never match.
 */
export function lessonExists(slug: string[], dir = CONTENT_DIR): boolean {
  if (!slug.length || !slug.every((s) => SEGMENT.test(s))) return false;
  if (slug.length >= 2 && !inSubset(slug[1])) return false;
  const base = path.join(dir, ...slug);
  return fs.existsSync(`${base}.md`) || fs.existsSync(path.join(base, 'index.md'));
}

/** The slug of a /docs/ request path (with or without /vi or /en and a base path), or null for another route. */
export function docsSlug(pathname: string, basePath = ''): string[] | null {
  const rest = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  const m = rest.match(/^(?:\/(?:vi|en))?\/docs(?:\/(.*))?$/);
  if (!m) return null;
  return (m[1] ?? '').split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
}
