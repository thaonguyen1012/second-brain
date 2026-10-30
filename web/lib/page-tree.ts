import type * as PageTree from 'fumadocs-core/page-tree';
import { flattenTree } from 'fumadocs-core/page-tree';
import { source } from './source';

type Node = PageTree.Node;
type Folder = PageTree.Folder;

function contains(folder: Folder, url: string): boolean {
  if (folder.index?.url === url) return true;
  return folder.children.some((c) =>
    c.type === 'folder' ? contains(c, url) : c.type === 'page' ? c.url === url : false,
  );
}

/** Folders off the current path keep only their sub-folders (their pages are dropped). */
function collapse(folder: Folder): Folder {
  return {
    ...folder,
    defaultOpen: false,
    children: folder.children.filter((c) => c.type !== 'page').map((c) => (c.type === 'folder' ? collapse(c) : c)),
  };
}

function pruneChildren(nodes: Node[], url: string): Node[] {
  return nodes.map((n) => {
    if (n.type !== 'folder') return n;
    if (contains(n, url)) return { ...n, defaultOpen: true, children: pruneChildren(n.children, url) };
    // other handbooks: only the tab entry is needed
    if (n.root) return { ...n, children: [] };
    return collapse(n);
  });
}

/**
 * The full tree has ~19k pages; serializing it into every page would make the export huge.
 * Each page gets: its own handbook with every chapter, the lessons of the current chapter,
 * and an empty entry for each other handbook (sidebar tab).
 */
export function getPrunedTree(url: string): PageTree.Root {
  const full = source.getPageTree();
  return { ...full, children: pruneChildren(full.children, url) };
}

let neighbours: Map<string, { previous?: PageTree.Item; next?: PageTree.Item }> | null = null;

/** Previous/next page in source order, never crossing into another handbook. */
export function getNeighbours(url: string) {
  if (!neighbours) {
    neighbours = new Map();
    const books: Folder[] = [];
    const find = (nodes: Node[]) =>
      nodes.forEach((n) => {
        if (n.type !== 'folder') return;
        if (n.root) books.push(n);
        else find(n.children);
      });
    find(source.getPageTree().children);
    for (const book of books) {
      const list = flattenTree([book]);
      list.forEach((item, i) =>
        neighbours!.set(item.url, { previous: list[i - 1], next: list[i + 1] }),
      );
    }
  }
  return neighbours.get(url) ?? {};
}
