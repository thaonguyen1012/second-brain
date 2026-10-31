import fs from 'node:fs/promises';
import { createCompiler, type CompileMDXResult } from '@fumadocs/mdx-remote';
import type { TOCItemType } from 'fumadocs-core/toc';
import { mdxOptions } from './mdx-options';

const compiler = createCompiler(mdxOptions);

interface Compiled {
  body: CompileMDXResult['body'];
  toc: TOCItemType[];
  /** CSS for the code-highlight classes used on this page */
  codeCss: string;
  /** reading time of the notes (text outside <details> transcripts), in minutes */
  readingMinutes: number;
}

// small in-process LRU; rendered HTML is additionally cached by Next (ISR)
const MAX = 300;
const cache = new Map<string, Promise<Compiled>>();

export async function loadPage(absolutePath: string): Promise<Compiled> {
  const stat = await fs.stat(absolutePath);
  const key = `${absolutePath}:${stat.mtimeMs}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const job = (async () => {
    const source = await fs.readFile(absolutePath, 'utf8');
    const result = await compiler.compile({ source, filePath: absolutePath });
    const notes = source.replace(/<details[\s\S]*?<\/details>/g, ' ').replace(/```[\s\S]*?```/g, ' ');
    const words = notes.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
    return {
      body: result.body,
      toc: result.toc,
      codeCss: String(result.vfile.data.codeCss ?? ''),
      readingMinutes: Math.max(1, Math.round(words / 220)),
    };
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  while (cache.size > MAX) cache.delete(cache.keys().next().value!);
  return job;
}
