import fs from 'node:fs';
import path from 'node:path';
import type { VirtualFile } from 'fumadocs-core/source';
import { CONTENT_DIR, inSubset } from './config';

export interface DocPageData {
  title: string;
  description?: string;
  /** absolute path of the markdown file, compiled on demand */
  absolutePath: string;
  [key: string]: unknown;
}

/** Minimal parser for the frontmatter our importer writes (one `key: <JSON value>` per line). */
export function readFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  if (!text.startsWith('---\n')) return { data: {}, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { data: {}, body: text };
  const data: Record<string, unknown> = {};
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    try {
      data[m[1]] = JSON.parse(m[2]);
    } catch {
      data[m[1]] = m[2];
    }
  }
  return { data, body: text.slice(end + 5) };
}

function readHead(file: string): string {
  // frontmatter is at the top; avoid reading whole bodies at startup
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, n).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

/** Scan CONTENT_DIR into fumadocs virtual files (pages carry only frontmatter). */
export function scanContent(): VirtualFile[] {
  const files: VirtualFile[] = [];
  if (!fs.existsSync(CONTENT_DIR)) return files;

  const walk = (dir: string, rel: string, depth: number) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        // depth 1 = <track>/<book>
        if (depth === 1 && !inSubset(e.name)) continue;
        walk(abs, relPath, depth + 1);
      } else if (e.name === 'meta.json') {
        files.push({ type: 'meta', path: relPath, absolutePath: abs, data: JSON.parse(fs.readFileSync(abs, 'utf8')) });
      } else if (e.name.endsWith('.md')) {
        const head = readHead(abs);
        let { data } = readFrontmatter(head);
        if (!data.title && head.length === 4096) data = readFrontmatter(fs.readFileSync(abs, 'utf8')).data;
        files.push({
          type: 'page',
          path: relPath,
          absolutePath: abs,
          data: { ...data, title: String(data.title ?? e.name), absolutePath: abs } as DocPageData,
        });
      }
    }
  };
  walk(CONTENT_DIR, '', 0);
  return files;
}
