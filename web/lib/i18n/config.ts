// Languages of the app UI (owner, 08/11/2026: an English version beside the Vietnamese one). Shared by the server
// (next/root-params) and the browser, so it imports nothing.
//
// One URL per page for both languages: the `lang` cookie picks the language and the rewrites in next.config.mjs send
// /thu-vien/ to the prerendered /vi/thu-vien/ or /en/thu-vien/ (app/[lang]/). Vietnamese stays the default (no
// cookie, any other value). next.config.mjs repeats the cookie name and the two codes: keep them in step.

export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'vi';

/** The cookie that holds the chosen language; next.config.mjs and Django (backend/core/middleware.py) read it. */
export const LOCALE_COOKIE = 'lang';

/** One year, renewed on every switch. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isLocale = (value: unknown): value is Locale => value === 'vi' || value === 'en';

/** BCP 47 tags for Intl (numbers, dates, sorting). English is British: day before month, 24-hour clock. */
export const intlLocale: Record<Locale, string> = { vi: 'vi-VN', en: 'en-GB' };

/** Each language named in itself, for the switch and Fumadocs' language list. */
export const localeNames: Record<Locale, string> = { vi: 'Tiếng Việt', en: 'English' }; // i18n-ignore: endonyms

/** "/en/thu-vien" -> "/thu-vien", "/vi" -> "/"; a path without a language is returned unchanged. */
export function stripLocale(path: string): string {
  const m = /^\/(?:vi|en)(?=\/|$)/.exec(path);
  return m ? path.slice(m[0].length) || '/' : path;
}
