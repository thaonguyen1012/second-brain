'use client';
import { useEffect, useState, type ComponentProps } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type * as PageTree from 'fumadocs-core/page-tree';

type Props = ComponentProps<typeof DocsLayout> & { book: string | null };

const cache = new Map<string, Promise<PageTree.Folder | null>>();

function fetchTree(book: string) {
  let job = cache.get(book);
  if (!job) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    job = fetch(`${base}/trees/${book}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<PageTree.Folder>) : null))
      .catch(() => null);
    cache.set(book, job);
  }
  return job;
}

function replaceBook(nodes: PageTree.Node[], full: PageTree.Folder): PageTree.Node[] {
  return nodes.map((n) => {
    if (n.type !== 'folder') return n;
    if (n.root && n.name === full.name) return full;
    return { ...n, children: replaceBook(n.children, full) };
  });
}

/** DocsLayout whose sidebar starts with the server's shell tree and loads the full book tree. */
export function LazyDocsLayout({ book, tree, ...props }: Props) {
  const [full, setFull] = useState<PageTree.Folder | null>(null);
  useEffect(() => {
    if (!book) return;
    let alive = true;
    fetchTree(book).then((t) => alive && setFull(t));
    return () => {
      alive = false;
    };
  }, [book]);
  // TreeContextProvider memoizes on the root $id, so the loaded tree needs its own id
  const current = full
    ? { ...tree, $id: `${tree.$id ?? 'root'}:${book}`, children: replaceBook(tree.children, full) }
    : tree;
  return <DocsLayout tree={current} {...props} />;
}
