// readMarkdownDir (import-gitbook.mjs --from markdown-dir) on tiny fixture folders written to a temporary folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizePage, planLayout, readMarkdownDir, titleFromName } from './book-import.mjs';
import { mergeBook } from './merge.mjs';

const dirs = [];
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'md-dir-'));
  dirs.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const shape = (nodes) => nodes.map((n) => (n.children.length ? [n.src, n.title, shape(n.children)] : [n.src, n.title]));

describe('readMarkdownDir without SUMMARY.md', () => {
  const files = {
    'README.md': '# My notes\n\nWelcome.\n',
    '10-later/b.md': '# B page\n',
    '2-basics/index.md': '# Basics\n\nIntro, see [first](01-first.md).\n',
    '2-basics/01-first.md': '# First lesson\n\nText.\n',
    '2-basics/02_second-try.md': 'No heading here.\n',
    '2-basics/deep/x.md': '# X\n',
    'notes.txt': 'ignored',
    '.hidden/y.md': '# hidden\n',
    'empty/readme.txt': 'no markdown',
  };

  it('turns folders into modules and files into items, in natural order, with titles from H1 or the name', () => {
    const { tree } = readMarkdownDir(fixture(files));
    expect(shape(tree.children)).toEqual([
      ['README.md', 'My notes'],
      [
        '2-basics/README.md',
        'Basics',
        [
          ['2-basics/01-first.md', 'First lesson'],
          ['2-basics/02_second-try.md', 'Second try'],
          ['2-basics/deep/README.md', 'Deep', [['2-basics/deep/x.md', 'X']]],
        ],
      ],
      ['10-later/README.md', 'Later', [['10-later/b.md', 'B page']]],
    ]);
  });

  it('files index.md as the folder page, gives a page-less folder its title only, and keeps the text', () => {
    const { pages, aliases } = readMarkdownDir(fixture(files));
    expect(pages.get('2-basics/README.md')).toBe(files['2-basics/index.md']);
    expect(aliases.get('2-basics/index.md')).toEqual({ src: '2-basics/README.md', anchor: null });
    expect(pages.get('10-later/README.md')).toBe('# Later\n');
    expect(pages.get('2-basics/01-first.md')).toBe(files['2-basics/01-first.md']);
    expect([...pages.keys()].some((k) => k.includes('hidden') || k.endsWith('.txt'))).toBe(false);
  });

  it('lays out and merges like a zip: the README is the book page, modules become folders or merged pages', () => {
    const { pages, tree } = readMarkdownDir(fixture(files));
    const { files: out } = planLayout(structuredClone(tree));
    expect(out.map((f) => f.out)).toEqual([
      'index.md',
      '2-basics/index.md',
      '2-basics/01-first.md',
      '2-basics/02_second-try.md',
      '2-basics/deep/index.md',
      '2-basics/deep/x.md',
      '10-later/index.md',
      '10-later/b.md',
    ]);
    const merged = mergeBook({ tree, pages, mode: 'module' });
    expect(merged.aliases.get('10-later/b.md')).toEqual({ src: '10-later/10-later.md', anchor: 'b' });
    expect(pages.get('10-later/10-later.md')).toContain('## B page [#b]');
  });

  it('reads a single top folder (an unpacked export) as the book', () => {
    const { tree } = readMarkdownDir(fixture({ 'export/README.md': '# Top\n', 'export/a.md': '# A\n' }));
    expect(shape(tree.children)).toEqual([
      ['README.md', 'Top'],
      ['a.md', 'A'],
    ]);
  });
});

describe('readMarkdownDir with SUMMARY.md', () => {
  it('follows SUMMARY.md like a GitBook zip', () => {
    const root = fixture({
      'SUMMARY.md': '# Summary\n\n* [Intro](README.md)\n* [Part](part/README.md)\n  * [Two](part/b.md)\n  * [One](part/a.md)\n',
      'README.md': '# Intro\n',
      'part/README.md': '# Part\n',
      'part/a.md': '# One\n',
      'part/b.md': '# Two\n\n[back](../README.md)\n',
    });
    const { pages, tree } = readMarkdownDir(root);
    expect(shape(tree.children)).toEqual([
      ['README.md', 'Intro'],
      ['part/README.md', 'Part', [['part/b.md', 'Two'], ['part/a.md', 'One']]],
    ]);
    expect(pages.has('SUMMARY.md')).toBe(false);
    const stats = {};
    const { body } = normalizePage(pages.get('part/b.md'), {
      srcPath: 'part/b.md',
      urlOf: (p) => (p === 'README.md' ? '/docs/it/x/' : null),
      fileUrl: () => null,
      stats,
    });
    expect(body).toContain('[back](/docs/it/x/)');
  });
});

describe('titleFromName', () => {
  it('drops an order prefix and the extension', () => {
    expect(titleFromName('03-the-review.md')).toBe('The review');
    expect(titleFromName('module_2')).toBe('Module 2');
    expect(titleFromName('2024')).toBe('2024');
  });
});
