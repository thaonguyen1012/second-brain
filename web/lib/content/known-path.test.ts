import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { docsSlug, lessonExists } from './known-path';

describe('docsSlug', () => {
  it('reads the slug of a docs path in either language', () => {
    expect(docsSlug('/docs/it/book/m1/')).toEqual(['it', 'book', 'm1']);
    expect(docsSlug('/en/docs/it/book/')).toEqual(['it', 'book']);
    expect(docsSlug('/docs/')).toEqual([]);
    expect(docsSlug('/base/vi/docs/a/', '/base')).toEqual(['a']);
    expect(docsSlug('/inbox/')).toBeNull();
    expect(docsSlug('/docsx/a')).toBeNull();
  });
});

describe('lessonExists (security audit S-17)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));
  fs.mkdirSync(path.join(dir, 'it/book/m2'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'it/book/m1.md'), '');
  fs.writeFileSync(path.join(dir, 'it/book/m2/index.md'), '');

  it('finds a lesson file or a folder index', () => {
    expect(lessonExists(['it', 'book', 'm1'], dir)).toBe(true);
    expect(lessonExists(['it', 'book', 'm2'], dir)).toBe(true);
  });

  it('refuses unknown, empty and odd paths', () => {
    expect(lessonExists(['it', 'book', 'nope'], dir)).toBe(false);
    expect(lessonExists([], dir)).toBe(false);
    expect(lessonExists(['it', '..', 'it', 'book', 'm1'], dir)).toBe(false);
    expect(lessonExists(['it', 'book', 'M1'], dir)).toBe(false);
  });
});
