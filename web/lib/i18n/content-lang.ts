// Handbook text quoted outside its lesson keeps its own language on English pages (WCAG 2.2 SC 3.1.2, Language of
// Parts): the last page in the Hôm nay hero, "Gần nhất: …" on Sổ tay, and on lesson pages the sidebar (also the
// page name of the table-of-contents bar), breadcrumbs and previous/next links. Most titles are English (Coursera
// names, "31.2. MCP Server"), some Vietnamese ("5.8 Margin Collapse là gì?") and many an English title with a
// Vietnamese label ("… — Phần 2", "⭐ Tóm tắt chương 3 – …", "Khóa 1. …"). So the text is cut where titles join their
// parts and each run of parts with a Vietnamese letter gets lang="vi": a screen reader reads it with a Vietnamese
// voice and never reads an English title with one. Vietnamese pages show the text as it is. The lesson page marks its
// own title, headings and body lang="vi" as one block. Rules: README.md here.
import { createElement, Fragment, type ReactNode } from 'react';
import type { Locale } from './config';

/** ă â đ ê ô ơ ư and every tone-marked vowel, both cases: the letters of coverage.test.ts (Ạ-ỹ: U+1EA0-U+1EF9). */
const VIETNAMESE = /[àáâãèéêìíòóôõùúýăđĩũơưẠ-ỹ]/i;

/**
 * `text` as a page in `locale` shows it. On a page that is not Vietnamese, the text is cut after " · ", " — ", " – "
 * and ". ", and each run of parts with a Vietnamese letter goes in <span lang="vi">; a part without letters ("17. ",
 * "2026") goes with its neighbours. Text without a Vietnamese letter, and any text on a Vietnamese page, comes back
 * as it is, so UI text that stands in for a title ("Handbook introduction") passes through unchanged.
 */
export function contentText(text: string | null | undefined, locale: Locale): ReactNode {
  if (!text || locale === 'vi' || !VIETNAMESE.test(text.normalize())) return text;
  const nodes: ReactNode[] = [];
  let run = '';
  let vi: boolean | undefined;
  const flush = () => nodes.push(vi ? createElement('span', { lang: 'vi' }, run) : run);
  // each part ends with its separator (no lookbehind: this runs in the home page's first chunk)
  for (const part of text.match(/[\s\S]*?(?:\s[·—–]\s|\.\s|$)/g)!) {
    const partVi = /\p{L}/u.test(part) ? VIETNAMESE.test(part.normalize()) : vi;
    if (run && vi !== undefined && partVi !== vi) {
      flush();
      run = '';
    }
    run += part;
    vi = partVi;
  }
  flush();
  return nodes.length === 1 ? nodes[0] : createElement(Fragment, null, ...nodes);
}
