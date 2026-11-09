import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KIND_PATHS, linkHref } from './note-links';

describe('linkHref', () => {
  it('is the deep link of each kind of record', () => {
    expect(linkHref('item', 12)).toBe('/thu-vien/item/?id=12');
    expect(linkHref('note', 3)).toBe('/thu-vien/ghi-chu/?id=3');
    expect(linkHref('opportunity', 7)).toBe('/co-hoi/?id=7');
    expect(linkHref('skill', 5)).toBe('/phat-trien/ky-nang/?id=5');
  });

  it('uses the paths the backend reads out of a note (backend/library/links.py PATHS)', () => {
    const source = readFileSync(path.join(__dirname, '../../backend/library/links.py'), 'utf8');
    const block = /^PATHS[^{]*\{([^}]*)\}/m.exec(source)?.[1] ?? '';
    const backend = Object.fromEntries(
      [...block.matchAll(/"([^"]+)":\s*NoteLink\.Kind\.(\w+)/g)].map(([, p, kind]) => [kind.toLowerCase(), p]),
    );
    expect(backend).toEqual(KIND_PATHS);
  });
});
