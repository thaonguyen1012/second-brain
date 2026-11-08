// Translation in server components: `const t = await getT()`. The language is the root param of app/[lang]/
// (next.config.mjs rewrites every page to /vi/... or /en/... by the `lang` cookie), read through next/root-params so
// nothing has to pass it down. Server only: next/root-params fails the build when a client component imports it.
import { lang } from 'next/root-params';
import { defaultLocale, isLocale, type Locale } from './config';
import { enAll, enPage } from './en';
import { makeT, type Dictionary, type T } from './translate';

export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : defaultLocale;
}

export async function getT(): Promise<T> {
  const locale = await getLocale();
  return makeT(locale, locale === 'en' ? enAll : null);
}

/** What the root layout hands to the browser: the page dictionary in English, nothing in Vietnamese. */
export function pageDictionary(locale: Locale): Dictionary | null {
  return locale === 'en' ? enPage : null;
}
