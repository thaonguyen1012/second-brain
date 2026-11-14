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

/** The open table-of-contents popover below xl (Base UI's Collapsible root, `data-open` while open). */
const openPopover = () => document.querySelector<HTMLElement>('[data-toc-popover][data-open]');
/** The open sidebar drawer below md. */
const openDrawer = () => document.querySelector<HTMLElement>('#nd-sidebar-mobile[data-state="open"]');
/** The top bar's button that opened the drawer (outside it; the drawer is `aria-controls` of every such button). */
const drawerButton = () =>
  document.querySelector<HTMLElement>('[aria-controls="nd-sidebar-mobile"]:not(#nd-sidebar-mobile *)');

/**
 * Fumadocs' two overlays of a lesson, the table-of-contents popover (below xl) and the sidebar drawer (below md), are
 * not modal and stayed open when the keyboard focus left them: the next stops were the links under them, hidden
 * (WCAG 2.4.11, 2.4.3), and Escape did nothing. Each closes as the focus moves on to the page behind it (the button
 * that opens the drawer excepted), and Escape inside one closes it and gives the focus to its button. Closed through
 * Fumadocs' own controls, so its state follows: the popover's trigger (checked open first: it toggles) and the
 * drawer's backdrop (it only closes). The page behind is Fumadocs' layout root, `#nd-docs-layout`: the top bar, the
 * sidebar or drawer, the popover and the lesson at every width. A popup, menu or dialog in a portal outside it, opened
 * from an overlay (the drawer's language chooser and handbook switcher, Base UI popovers that take the focus) or over
 * it (Cmd+K), leaves the overlay open, and the overlay gets the focus back when the popup closes (closing the drawer
 * took its popup with it and dropped the focus to <body>). A Cmd+K pick of a heading of the lesson shown is the one
 * exception: only the hash changes, so Fumadocs keeps the drawer open and the page stays, and the dialog hands the
 * focus to that heading instead (components/search-dialog.tsx), which closes the overlay as it arrives. A pick of
 * another page changes the pathname, which closes the drawer. lib/lesson-landmarks.test.ts follows the markup this
 * reads.
 */
function useOverlaysCloseOnFocusOut() {
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const to = e.target;
      if (!(to instanceof Element) || !to.closest('#nd-docs-layout')) return;
      const popover = openPopover();
      if (popover && !popover.contains(to)) popover.querySelector<HTMLElement>('[data-toc-popover-trigger]')?.click();
      const drawer = openDrawer();
      if (drawer && !drawer.contains(to) && !to.closest('[aria-controls="nd-sidebar-mobile"]'))
        (drawer.previousElementSibling as HTMLElement | null)?.click();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const at = document.activeElement;
      const popover = openPopover();
      if (popover && at && popover.contains(at)) {
        const trigger = popover.querySelector<HTMLElement>('[data-toc-popover-trigger]');
        trigger?.click();
        trigger?.focus();
        return;
      }
      const drawer = openDrawer();
      if (drawer && at && drawer.contains(at)) {
        (drawer.previousElementSibling as HTMLElement | null)?.click();
        drawerButton()?.focus();
      }
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}

/**
 * DocsLayout whose sidebar starts with the server's shell tree and loads the full book tree. The skip link before it
 * jumps the lesson tree to the lesson (DocsPage's `#nd-page`, focusable while the skip link's focus is on it).
 */
export function LazyDocsLayout({ book, tree, ...props }: Props) {
  const locale = useLocale();
  useOverlaysCloseOnFocusOut();
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
