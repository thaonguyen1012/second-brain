'use client';
// Translation in client components: `const t = useT()`. The root layout (server) passes the language and, in
// English, the page dictionary; Vietnamese needs no dictionary (the text in the code is the Vietnamese).
import { createContext, use, useMemo, type ReactNode } from 'react';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, defaultLocale, stripLocale, type Locale } from './config';
import { makeT, type Dictionary, type T } from './translate';

interface I18nValue {
  locale: Locale;
  dict: Dictionary | null;
}

const I18nContext = createContext<I18nValue>({ locale: defaultLocale, dict: null });

export function I18nProvider({ locale, dict, children }: I18nValue & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useLocale(): Locale {
  return use(I18nContext).locale;
}

/**
 * The translation function of the current language. A lazily loaded part (Stageshow guides, the intro pictures)
 * passes its own dictionary module, which only its chunk carries: useT(guides).
 */
export function useT(extra?: Dictionary): T {
  const { locale, dict } = use(I18nContext);
  return useMemo(
    () => makeT(locale, locale === 'en' ? (extra && dict ? { ...dict, ...extra } : (extra ?? dict)) : null),
    [locale, dict, extra],
  );
}

/**
 * Switches the language: the cookie that next.config.mjs and Django read, then a full page load, since the pages of
 * both languages share one URL (the client router must not keep the other language's pages). A page opened by its
 * language path (/en/tuan/) goes to its plain URL, where the cookie decides.
 */
export function switchLocale(locale: Locale) {
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  const { pathname, search, hash } = window.location;
  const plain = stripLocale(pathname);
  if (plain === pathname) window.location.reload();
  // A full page load on purpose: the router would keep the root layout of the other language
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  else window.location.assign(`${plain}${search}${hash}`);
}
