import type * as PageTree from 'fumadocs-core/page-tree';
import { flattenTree } from 'fumadocs-core/page-tree';
import { source } from './source';

type Node = PageTree.Node;
type Folder = PageTree.Folder;

/** Book root folders (sidebar tabs), keyed by book slug (the folder's last URL segment). */
function bookFolders(): Map<string, Folder> {
  const books = new Map<string, Folder>();
  const find = (nodes: Node[]) =>
    nodes.forEach((n) => {
      if (n.type !== 'folder') return;
      if (n.root) {
        // "<track>/<book>/..." from any page of the book
        const first = flattenTree([n])[0];
        const slug = (first?.$id ?? first?.url ?? '').replace(/^\/docs\//, '').split('/')[1];
        if (slug) books.set(slug, n);
      } else find(n.children);
    });
  find(source.getPageTree().children);
  return books;
}

let booksCache: Map<string, Folder> | null = null;
const books = () => (booksCache ??= bookFolders());

/** Full tree of one book, served as /trees/<book>.json and loaded by the browser once. */
export function getBookTree(slug: string): Folder | undefined {
  return books().get(slug);
}

function pathTo(nodes: Node[], url: string): Node[] | null {
  for (const n of nodes) {
    if (n.type === 'page' && n.url === url) return [n];
    if (n.type === 'folder') {
      if (n.index?.url === url) return [n];
      const sub = pathTo(n.children, url);
      if (sub) return [n, ...sub];
    }
  }
  return null;
}

/**
 * Tree carried by the HTML: every book as an empty tab, plus the chain of folders down to the
 * current page. The browser swaps in the full book tree from /trees/<book>.json.
 */
export function getShellTree(url: string): { tree: PageTree.Root; book: string | null } {
  const full = source.getPageTree();
  const chain = pathTo(full.children, url) ?? [];
  const bookFolder = chain.find((n): n is Folder => n.type === 'folder' && !!n.root);
  const book = bookFolder ? [...books()].find(([, f]) => f === bookFolder)?.[0] ?? null : null;

  const shrink = (nodes: Node[]): Node[] =>
    nodes.flatMap((n): Node[] => {
      if (n.type !== 'folder') return chain.includes(n) ? [n] : [];
      if (chain.includes(n)) return [{ ...n, defaultOpen: true, children: shrink(n.children) }];
      if (n.root) return [{ ...n, children: [] }];
      // keep track folders that contain book tabs
      const inner = shrink(n.children);
      return inner.length ? [{ ...n, children: inner }] : [];
    });
  return { tree: { ...full, children: shrink(full.children) }, book };
}

let neighbours: Map<string, { previous?: PageTree.Item; next?: PageTree.Item }> | null = null;

/** Previous/next page in source order, never crossing into another book. */
export function getNeighbours(url: string) {
  if (!neighbours) {
    neighbours = new Map();
    for (const book of books().values()) {
      const list = flattenTree([book]);
      list.forEach((item, i) => neighbours!.set(item.url, { previous: list[i - 1], next: list[i + 1] }));
    }
  }
  return neighbours.get(url) ?? {};
}
