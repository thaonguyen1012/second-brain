'use client';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { useEffect, type ReactNode } from 'react';
import { viTranslations } from '@/lib/i18n-vi';

/** "/" opens search (in addition to ⌘K / Ctrl+K), unless the user is typing. */
function SlashToSearch() {
  const { setOpenSearch } = useSearchContext();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
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
    <RootProvider i18n={{ locale: 'vi', translations: viTranslations }}>
      <SlashToSearch />
      {children}
    </RootProvider>
  );
}
