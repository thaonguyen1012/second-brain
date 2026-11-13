'use client';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type * as PageTree from 'fumadocs-core/page-tree';
import { useLocale } from '@/lib/i18n/client';
import type { Locale } from '@/lib/i18n/config';
import { contentText } from '@/lib/i18n/content-lang';
import { SkipLink } from '@/components/skip-link';

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

/**
 * The tree with every title through contentText (lang="vi" on its Vietnamese parts), folder index pages included:
 * an index page's own title is the page name of the table-of-contents bar on that page.
 */
function markTitles(nodes: PageTree.Node[], locale: Locale): PageTree.Node[] {
  const mark = <N extends PageTree.Node>(n: N): N =>
    typeof n.name === 'string' ? { ...n, name: contentText(n.name, locale) } : n;
  return nodes.map((n) =>
    n.type === 'folder'
      ? { ...mark(n), ...(n.index && { index: mark(n.index) }), children: markTitles(n.children, locale) }
      : mark(n),
  );
}

/**
 * DocsLayout whose sidebar starts with the server's shell tree and loads the full book tree. The skip link before it
 * jumps the lesson tree to the lesson (DocsPage's `#nd-page`, focusable while the skip link's focus is on it).
 */
export function LazyDocsLayout({ book, tree, ...props }: Props) {
  const locale = useLocale();
  const [full, setFull] = useState<PageTree.Folder | null>(null);
  useEffect(() => {
    if (!book) return;
    let alive = true;
    fetchTree(book).then((t) => alive && setFull(t));
    return () => {
      alive = false;
    };
  }, [book]);
  // TreeContextProvider memoizes on the root $id, so the loaded tree needs its own id. The titles are marked
  // after replaceBook, which compares book names as strings; Vietnamese pages show the tree as it is.
  const current = useMemo(() => {
    const shown = full
      ? { ...tree, $id: `${tree.$id ?? 'root'}:${book}`, children: replaceBook(tree.children, full) }
      : tree;
    return locale === 'vi' ? shown : { ...shown, children: markTitles(shown.children, locale) };
  }, [tree, full, book, locale]);
  return (
    <>
      <SkipLink target="nd-page" />
      <DocsLayout tree={current} {...props} />
    </>
  );
}
