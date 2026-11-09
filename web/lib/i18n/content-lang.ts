// Handbook text quoted outside its lesson keeps its own language on English pages (WCAG 2.2 SC 3.1.2, Language of
// Parts): the last page in the Hôm nay hero, "Gần nhất: …" on Sổ tay, the handbook rows of Cmd+K, and on lesson pages
// the sidebar (also the page name of the table-of-contents bar), breadcrumbs and previous/next links. Most titles are
// English (Coursera names, "31.2. MCP Server"), some Vietnamese ("5.8 Margin Collapse là gì?") and many an English
// title with a Vietnamese label ("… — Phần 2", "⭐ Tóm tắt chương 3 – …", "Khóa 1. …"). So the text is cut where titles
// join their parts and each run of parts with a Vietnamese letter gets lang="vi": a screen reader reads it with a
// Vietnamese voice and never reads an English title with one. Vietnamese pages show the text as it is. The lesson page
// marks its own title, headings and body lang="vi" as one block. Rules: README.md here.
import { createElement, type ReactNode } from 'react';
import type { Locale } from './config';

/** Letters only Vietnamese writes, both cases: ă đ ĩ ũ ơ ư and Ạ-ỹ (U+1EA0-U+1EF9). */
const VIETNAMESE_ONLY = /[ăđĩũơưẠ-ỹ]/i;
/** The accents French, Spanish and Portuguese write too ("clichés", "Ángel", "café"). */
const SHARED = /[àáâãèéêìíòóôõùúý]/i;
/** One Vietnamese syllable (Vietnamese writes one per word): "là", "Khóa", "nào", never "clichés" or "Ángel". */
const SYLLABLE =
  /^(?:ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdđghklmnprstvx])?[aàáâãeèéêiìíoòóôõuùúyý]{1,3}(?:ng|nh|ch|[cmnpt])?$/i;

/** A Vietnamese letter (the letters of coverage.test.ts), a shared accent only inside a Vietnamese syllable. */
function hasVietnamese(text: string): boolean {
  const s = text.normalize();
  return VIETNAMESE_ONLY.test(s) || s.split(/[^\p{L}]+/u).some((w) => SHARED.test(w) && SYLLABLE.test(w));
}

/**
 * `text` as a page in `locale` shows it. On a page that is not Vietnamese, the text is cut after " · ", " — ", " – "
 * and ". ", and each run of parts with a Vietnamese letter goes in <span lang="vi">; a part without letters ("17. ",
 * "2026") goes with its neighbours. Text without a Vietnamese letter, and any text on a Vietnamese page, comes back
 * as it is, so UI text that stands in for a title ("Handbook introduction") passes through unchanged.
 */
export function contentText(text: string | null | undefined, locale: Locale): ReactNode {
  if (!text || locale === 'vi' || !hasVietnamese(text)) return text;
  const nodes: ReactNode[] = [];
  let run = '';
  let vi: boolean | undefined;
  const flush = () => nodes.push(vi ? createElement('span', { lang: 'vi' }, run) : run);
  // each part ends with its separator (no lookbehind: this runs in the home page's first chunk)
  for (const part of text.match(/[\s\S]*?(?:\s[·—–]\s|\.\s|$)/g)!) {
    const partVi = /\p{L}/u.test(part) ? hasVietnamese(part) : vi;
    if (run && vi !== undefined && partVi !== vi) {
      flush();
      run = '';
    }
    run += part;
    vi = partVi;
  }
  flush();
  // A mixed title stays one element: in a flex row (the Fumadocs sidebar's items and separators are flex with a gap)
  // a fragment's text and span would be two flex items, side by side, each wrapping on its own ("Ph/ần/1")
  return nodes.length === 1 ? nodes[0] : createElement('span', null, ...nodes);
}
