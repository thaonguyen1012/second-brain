import type * as PageTree from 'fumadocs-core/page-tree';
import { describe, expect, it, vi } from 'vitest';

// A small fixed tree instead of the content scan: track "it" holds two books; book "alpha" has a module folder
// with an index page, book "beta" has a single page. Same shape as the importer's output.
// $id is the content file path ("<track>/<book>/..."), as the loader sets it; folder index pages are index.md.
const page = (url: string, name = url.split('/').pop()!, file = `${url.replace(/^\/docs\//, '')}.md`): PageTree.Item => ({
  type: 'page',
  name,
  url,
  $id: file,
});
const alphaIndex = page('/docs/it/alpha', 'Alpha', 'it/alpha/index.md');
const a1 = page('/docs/it/alpha/m1', 'm1', 'it/alpha/m1/index.md');
const a1Part2 = page('/docs/it/alpha/m1/phan-2');
const a2 = page('/docs/it/alpha/m2');
const intro = page('/docs/it/alpha/intro');
const b1 = page('/docs/it/beta/b1');
const moduleFolder: PageTree.Folder = { type: 'folder', name: 'Module 1', index: a1, children: [a1Part2] };
const alpha: PageTree.Folder = { type: 'folder', name: 'Alpha', root: true, index: alphaIndex, children: [intro, moduleFolder, a2] };
const beta: PageTree.Folder = { type: 'folder', name: 'Beta', root: true, children: [b1] };
const track: PageTree.Folder = { type: 'folder', name: 'IT', children: [alpha, beta] };
const tree: PageTree.Root = { name: 'Docs', children: [track] };

vi.mock('./source', () => ({ source: { getPageTree: () => tree } }));

const { getBookTree, getCrumbs, getNeighbours, getShellTree } = await import('./page-tree');

describe('getBookTree', () => {
  it('finds book root folders by the slug in their page URLs', () => {
    expect(getBookTree('alpha')).toBe(alpha);
    expect(getBookTree('beta')).toBe(beta);
    expect(getBookTree('it')).toBeUndefined();
    expect(getBookTree('gamma')).toBeUndefined();
  });
});

describe('getNeighbours', () => {
  it('follows source order, folder index pages included', () => {
    expect(getNeighbours(intro.url)).toEqual({ previous: alphaIndex, next: a1 });
    expect(getNeighbours(a1.url)).toEqual({ previous: intro, next: a1Part2 });
    expect(getNeighbours(a1Part2.url)).toEqual({ previous: a1, next: a2 });
  });

  it('never crosses into another book', () => {
    expect(getNeighbours(alphaIndex.url).previous).toBeUndefined();
    expect(getNeighbours(a2.url)).toEqual({ previous: a1Part2, next: undefined });
    expect(getNeighbours(b1.url)).toEqual({ previous: undefined, next: undefined });
  });

  it('returns nothing for an unknown URL', () => {
    expect(getNeighbours('/docs/it/alpha/missing')).toEqual({});
  });
});

describe('getShellTree', () => {
  it('keeps only the chain down to the page and every other book as an empty tab', () => {
    const { tree: shell, book } = getShellTree(a1Part2.url);
    expect(book).toBe('alpha');
    const [shellTrack] = shell.children as PageTree.Folder[];
    const [shellAlpha, shellBeta] = shellTrack.children as PageTree.Folder[];
    expect(shellAlpha).toMatchObject({ name: 'Alpha', defaultOpen: true });
    expect(shellAlpha.children).toHaveLength(1);
    expect(shellAlpha.children[0]).toMatchObject({ name: 'Module 1', defaultOpen: true, children: [a1Part2] });
    expect(shellBeta).toMatchObject({ name: 'Beta', root: true, children: [] });
  });

  it('does not mutate the full tree', () => {
    getShellTree(a1Part2.url);
    expect(alpha.children).toHaveLength(3);
    expect(alpha.defaultOpen).toBeUndefined();
  });

  it('treats a folder index page as being inside its folder', () => {
    const { tree: shell, book } = getShellTree(a1.url);
    expect(book).toBe('alpha');
    const shellAlpha = (shell.children[0] as PageTree.Folder).children[0] as PageTree.Folder;
    expect(shellAlpha.children).toEqual([{ ...moduleFolder, defaultOpen: true, children: [] }]);
  });

  it('gives empty book tabs and no book for a page outside every book', () => {
    const { tree: shell, book } = getShellTree('/thu-vien/');
    expect(book).toBeNull();
    const shellTrack = shell.children[0] as PageTree.Folder;
    expect(shellTrack.children.map((f) => (f as PageTree.Folder).children)).toEqual([[], []]);
  });
});

describe('getCrumbs', () => {
  it('starts at the book (skipping the track) and links folders to their index page', () => {
    expect(getCrumbs(a1Part2.url)).toEqual([
      { name: 'Alpha', url: alphaIndex.url },
      { name: 'Module 1', url: a1.url },
    ]);
  });

  it('links a book without an index page to its first page', () => {
    expect(getCrumbs(b1.url)).toEqual([{ name: 'Beta', url: b1.url }]);
  });

  it('is empty for unknown URLs', () => {
    expect(getCrumbs('/docs/it/nowhere')).toEqual([]);
  });
});
