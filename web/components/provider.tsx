'use client';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { lazy, useEffect, type ReactNode } from 'react';
import { viTranslations } from '@/lib/i18n-vi';

/** Handbooks + second brain (Cmd+K "find everything"); lazy like Fumadocs' default dialog, so off the first load. */
const SearchDialog = lazy(() => import('./search-dialog'));

/**
 * "/" opens search (in addition to ⌘K / Ctrl+K), unless the user is typing, another handler took the key, or
 * the page has its own search box marked `data-local-search` (Ghi chú, Kỹ năng: "/" focuses that box).
 */
function SlashToSearch() {
  const { setOpenSearch } = useSearchContext();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[data-local-search]')) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      setOpenSearch(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpenSearch]);
  return null;
}

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider i18n={{ locale: 'vi', translations: viTranslations }} search={{ SearchDialog }}>
      <SlashToSearch />
      {children}
    </RootProvider>
  );
}
