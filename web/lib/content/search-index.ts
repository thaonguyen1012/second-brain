import fs from 'node:fs';
import type { AdvancedIndex } from 'fumadocs-core/search/server';
import { readFrontmatter } from './scan';
import { source } from '../source';

/** Plain-text sections of a markdown page (no MDX compile), keyed by heading. */
export function markdownSections(body: string) {
  const headings: { id: string; content: string }[] = [];
  const contents: { heading: string | undefined; content: string }[] = [];
  let heading: string | undefined;
  let buf: string[] = [];
  let fence = false;
  const flush = () => {
    const text = buf
      .join('\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>#|]+/g, ' ')
      .replace(/^:::\w*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) contents.push({ heading, content: text });
    buf = [];
  };
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = !fence && line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (h) {
      flush();
      const id = `h${headings.length}`;
      headings.push({ id, content: h[2] });
      heading = id;
    } else buf.push(line);
  }
  flush();
  return { headings, contents };
}

export function buildIndexes(): AdvancedIndex[] {
  return source.getPages().map((page) => {
    const data = page.data as unknown as { absolutePath: string; title: string };
    const { body } = readFrontmatter(fs.readFileSync(data.absolutePath, 'utf8'));
    return {
      id: page.url,
      url: page.url,
      title: data.title,
      tag: page.slugs[1],
      structuredData: markdownSections(body),
    };
  });
}
