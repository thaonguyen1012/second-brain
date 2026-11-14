'use client';
import NextLink from 'next/link';
import NextImage from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { RootProvider } from 'fumadocs-ui/provider/base';
import { FrameworkProvider, type Framework } from 'fumadocs-core/framework';
import { useSearchContext, type SearchLink } from 'fumadocs-ui/contexts/search';
import { lazy, useEffect, useMemo, type ReactNode } from 'react';
import { navAreas } from '@/lib/app-nav';
import { locales, localeNames, type Locale } from '@/lib/i18n/config';
import { I18nProvider, switchLocale, useT } from '@/lib/i18n/client';
import type { Dictionary } from '@/lib/i18n/translate';
import { singleKeyShortcut } from '@/lib/single-key-shortcuts';
import { useAppPathname } from '@/lib/use-app-pathname';

/** Handbooks + second brain (Cmd+K "find everything"); lazy like Fumadocs' default dialog, so off the first load. */
const SearchDialog = lazy(() => import('./search-dialog'));

/** Fumadocs' language list: its docs sidebar switch calls switchLocale (one URL per page, lib/i18n/config.ts). */
const fumadocsLocales = locales.map((locale) => ({ locale, name: localeNames[locale] }));

/**
 * "/" opens search (in addition to ⌘K / Ctrl+K), unless the user is typing, another handler took the key,
 * single-key shortcuts are off (⌘K still opens it), or the page has its own search box marked `data-local-search`
 * (Ghi chú, Kỹ năng: "/" focuses that box).
 */
function SlashToSearch() {
  const { setOpenSearch } = useSearchContext();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.defaultPrevented || !singleKeyShortcut(e)) return;
      if (document.querySelector('[data-local-search]')) return;
      e.preventDefault();
      setOpenSearch(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpenSearch]);
  return null;
}

/** Fumadocs and the app, inside the language: search's first links are the sidebar's areas in that language. */
function Inner({ locale, fumadocs, children }: { locale: Locale; fumadocs?: Dictionary; children: ReactNode }) {
  const t = useT();
  // What the dialog lists before anything is typed: the sidebar's six areas, Inbox and the guides
  const links = useMemo<SearchLink[]>(
    () => [
      ...navAreas.slice(0, 1).map((n): SearchLink => [t(n.title), n.href]),
      ['Inbox', '/inbox/'],
      ...navAreas.slice(1).map((n): SearchLink => [t(n.title), n.href]),
      [t('Hướng dẫn'), '/huong-dan/'],
    ],
    [t],
  );
  return (
    <RootProvider
      i18n={{
        locale,
        locales: fumadocsLocales,
        onLocaleChange: (v) => switchLocale(v as Locale),
        translations: fumadocs as Record<string, string> | undefined,
      }}
      search={{ SearchDialog, links }}
    >
      <SlashToSearch />
      {children}
    </RootProvider>
  );
}

/**
 * The app's providers. Fumadocs gets Next's router through its framework seam, with the path read without the
 * language (useAppPathname): pages are prerendered at /vi/... and /en/..., and its sidebar and footer compare that
 * path with the page tree's /docs/... links.
 */
export function Provider({
  locale,
  dict,
  fumadocs,
  children,
}: {
  locale: Locale;
  dict: Dictionary | null;
  /**
   * Fumadocs' own strings: lib/i18n-vi.ts on Vietnamese pages (English is its default), and in both languages the
   * language chooser's name (app/[lang]/layout.tsx).
   */
  fumadocs?: Dictionary;
  children: ReactNode;
}) {
  return (
    <FrameworkProvider
      usePathname={useAppPathname}
      useRouter={useRouter}
      useParams={useParams as () => Record<string, string | string[]>}
      // Fumadocs' own Next adapter passes these the same way; its prop types are looser than Next's
      Link={NextLink as Framework['Link']}
      Image={NextImage as Framework['Image']}
    >
      <I18nProvider locale={locale} dict={dict}>
        <Inner locale={locale} fumadocs={fumadocs}>
          {children}
        </Inner>
      </I18nProvider>
    </FrameworkProvider>
  );
}
