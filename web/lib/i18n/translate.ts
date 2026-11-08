// The translation function shared by server and client components (no hooks, no next/* imports).
//
// The Vietnamese text stays in the code and is its own key (gettext style): t('Thêm item') shows that text in
// Vietnamese and looks it up in the English dictionary (lib/i18n/en/) in English. A missing English entry falls
// back to the Vietnamese text; lib/i18n/coverage.test.ts fails before that can ship.
import { createElement, Fragment, type ReactNode } from 'react';
import { intlLocale, type Locale } from './config';

/**
 * A UI string kept in data (label lists, nav rows) and translated where it is shown: t(label). It is an object on
 * purpose, so TypeScript refuses `{label}` in JSX or in a string prop until it goes through t().
 */
export interface Msg {
  readonly msgid: string;
  /** Tells two English translations of the same Vietnamese text apart (rare). */
  readonly context?: string;
}

export const msg = (msgid: string, context?: string): Msg => (context ? { msgid, context } : { msgid });

export const isMsg = (value: unknown): value is Msg =>
  typeof value === 'object' && value !== null && typeof (value as Msg).msgid === 'string';

/** English that depends on a count; the count is the `n` variable. Vietnamese has one form. */
export interface Plural {
  one: string;
  other: string;
}

export type Entry = string | Plural;
export type Dictionary = Readonly<Record<string, Entry>>;

/** Values for {placeholders}; `n` is the count: it picks the plural form and is printed with digit grouping. */
export type Vars = Readonly<Record<string, string | number>>;

/** Values for t.rich(): a node for {name}, a function for <tag>text</tag>. */
export type RichValues = Readonly<Record<string, ReactNode | ((chunks: ReactNode) => ReactNode)>>;

/** The dictionary key of a text: the Vietnamese text, after `context::` when it has a context. */
export const dictKey = (msgid: string, context?: string) => (context ? `${context}::${msgid}` : msgid);

export interface T {
  /** The text in the current language, {placeholders} filled from `vars`. */
  (text: string | Msg, vars?: Vars | null, context?: string): string;
  /** The same with markup: `<b>…</b>` calls values.b(chunks), `{kbd}` inserts values.kbd. */
  rich(text: string | Msg, values?: RichValues | null, context?: string): ReactNode;
  /** A number with the language's digit grouping: 4746 -> "4.746" / "4,746". */
  num(n: number, options?: Intl.NumberFormatOptions): string;
  readonly locale: Locale;
  /** BCP 47 tag for Intl: "vi-VN" or "en-GB". */
  readonly intl: string;
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function numberFormat(intl: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const id = options ? `${intl}|${JSON.stringify(options)}` : intl;
  let f = numberFormats.get(id);
  if (!f) {
    f = new Intl.NumberFormat(intl, options);
    numberFormats.set(id, f);
  }
  return f;
}

const warned = new Set<string>();

/** The entry for `key` in the current language: the dictionary's, else the Vietnamese text itself. */
function lookup(dict: Dictionary | null, msgid: string, context: string | undefined, vars: Vars | null | undefined) {
  if (!dict) return msgid;
  const entry = dict[dictKey(msgid, context)];
  if (entry === undefined) {
    // Text without Vietnamese letters ("Inbox", a course name) reads the same in English
    if (process.env.NODE_ENV !== 'production' && !warned.has(msgid) && /[^\x00-\x7f]/.test(msgid)) {
      warned.add(msgid);
      console.warn(`i18n: no English for ${JSON.stringify(dictKey(msgid, context))}`);
    }
    return msgid;
  }
  if (typeof entry === 'string') return entry;
  return vars?.n === 1 ? entry.one : entry.other;
}

const PLACEHOLDER = /\{(\w+)\}/g;
const TAG = /<(\w+)>([\s\S]*?)<\/\1>/g;

export function makeT(locale: Locale, dict: Dictionary | null): T {
  const intl = intlLocale[locale];
  const num = (n: number, options?: Intl.NumberFormatOptions) => numberFormat(intl, options).format(n);
  const show = (name: string, value: string | number) =>
    name === 'n' && typeof value === 'number' ? num(value) : String(value);

  const resolve = (text: string | Msg, vars: Vars | null | undefined, context: string | undefined) =>
    typeof text === 'string' ? lookup(dict, text, context, vars) : lookup(dict, text.msgid, text.context, vars);

  const t = ((text: string | Msg, vars?: Vars | null, context?: string) => {
    const template = resolve(text, vars, context);
    if (!vars) return template;
    return template.replace(PLACEHOLDER, (whole, name: string) =>
      name in vars ? show(name, vars[name]) : whole,
    );
  }) as T;

  t.rich = (text, values, context) => {
    const count = values && typeof values.n === 'number' ? { n: values.n } : null;
    const template = resolve(text, count, context);
    // Placeholders are filled after the tags are cut out, so a value (a title, a URL) can never open a tag
    const fill = (piece: string, out: ReactNode[]) => {
      let last = 0;
      for (const m of piece.matchAll(PLACEHOLDER)) {
        const value = values?.[m[1]];
        if (value === undefined || typeof value === 'function') continue;
        if (m.index > last) out.push(piece.slice(last, m.index));
        out.push(typeof value === 'number' ? show(m[1], value) : value);
        last = m.index + m[0].length;
      }
      if (last < piece.length) out.push(piece.slice(last));
    };
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of template.matchAll(TAG)) {
      if (m.index > last) fill(template.slice(last, m.index), out);
      const wrap = values?.[m[1]];
      const inner: ReactNode[] = [];
      fill(m[2], inner);
      out.push(typeof wrap === 'function' ? wrap(inner.length === 1 ? inner[0] : inner) : inner);
      last = m.index + m[0].length;
    }
    if (last < template.length) fill(template.slice(last), out);
    if (out.length === 1) return out[0];
    return out.map((node, i) => createElement(Fragment, { key: i }, node));
  };

  t.num = num;
  Object.defineProperty(t, 'locale', { value: locale });
  Object.defineProperty(t, 'intl', { value: intl });
  return t;
}

/** Vietnamese without a dictionary: for tests and for code that runs before a language is known. */
export const tVi: T = makeT('vi', null);
