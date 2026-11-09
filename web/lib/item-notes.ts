// Pure logic of the Item page's notes (DECISIONS 9.8) and of the notes page's "Theo item" view: grouping notes by
// their Items, the words of a note's date and heading, and which markdown links and images may render. No React, no
// API calls; unit-tested in item-notes.test.ts.
import type { T } from '@/lib/i18n/translate';
import { formatDate } from '@/lib/labels';

/** Backend limit for a note's `markdown` (API_CONTRACT.md). */
export const MAX_MARKDOWN = 200_000;

/** A note as these helpers need it (ApiNote has more). */
export interface NoteLike {
  id: number;
  title: string;
  items: readonly number[];
  createdAt: string;
  updatedAt: string;
}

/** One group of the "Theo item" view: an Item and its notes, or `item: null` for "Ghi chú rời" (no Item). */
export interface NoteGroup<N extends NoteLike> {
  item: number | null;
  notes: N[];
}

/**
 * Notes grouped by Item (DECISIONS 9.8 point 5). A note linked to two Items shows in both groups (point 4); a note
 * without an Item goes to the one `item: null` group ("Ghi chú rời"), always last. Inside a group the notes keep the
 * given order (the API's: newest first); groups follow their newest note, so the Item written about most recently
 * comes first.
 */
export function groupNotesByItem<N extends NoteLike>(notes: readonly N[]): NoteGroup<N>[] {
  const groups = new Map<number, NoteGroup<N>>();
  const loose: N[] = [];
  for (const note of notes) {
    if (note.items.length === 0) loose.push(note);
    for (const item of new Set(note.items)) {
      const group = groups.get(item);
      if (group) group.notes.push(note);
      else groups.set(item, { item, notes: [note] });
    }
  }
  const out = [...groups.values()];
  if (loose.length) out.push({ item: null, notes: loose });
  return out;
}

/** "sửa 07/11/2026" when the note changed on a later day than it was written, else the day it was written. */
export function noteDateLabel(note: Pick<NoteLike, 'createdAt' | 'updatedAt'>, t: T): string {
  const edited = note.updatedAt.slice(0, 10) !== note.createdAt.slice(0, 10);
  return edited ? t('sửa {date}', { date: formatDate(note.updatedAt, t) }) : formatDate(note.createdAt, t);
}

/**
 * The heading a note gets on its Item's page: its own title, except when it only repeats the Item's title (the title
 * "Viết ghi chú" gives a new note), which the page already shows above it; null for none.
 */
export function noteHeading(title: string, itemTitle: string): string | null {
  const t = title.trim();
  if (!t) return null;
  return t.toLocaleLowerCase('vi') === itemTitle.trim().toLocaleLowerCase('vi') ? null : t;
}

/**
 * What a link in a rendered note becomes: a page of the app (client navigation), a same-origin file or API address
 * (a plain link: Django answers it, not the Next router), an external link (new tab), or plain text.
 */
export type MarkdownHref =
  | { kind: 'internal'; href: string }
  | { kind: 'file'; href: string }
  | { kind: 'external'; href: string }
  | { kind: 'text' };

const SAME_ORIGIN = /^\/(?![/\\])/;
/** Same-origin addresses that are not pages of the app: Django's API and attachments, static files. */
const NOT_A_PAGE = /^\/(api|files|admin|vendor|original|img|covers)\//;

/**
 * Links in notes: a same-origin page (`/thu-vien/item/?id=12`, the future `[[ ]]` links) stays in the app, a
 * same-origin file or API address is a plain link; http(s) and mailto open outside the app; anything else
 * (javascript:, data:, protocol-relative `//host`, relative paths) is shown as text, never as a link.
 */
export function markdownHref(href: string | null | undefined): MarkdownHref {
  const h = (href ?? '').trim();
  if (SAME_ORIGIN.test(h)) return NOT_A_PAGE.test(h) ? { kind: 'file', href: h } : { kind: 'internal', href: h };
  if (/^(https?:\/\/|mailto:)\S+$/i.test(h)) return { kind: 'external', href: h };
  return { kind: 'text' };
}

/**
 * Whether a note's image may load: same-origin pictures only (an Item image, the app's /img/ and /covers/ files, an
 * attachment with an image extension), never another site and never other API addresses (an image of /api/export
 * would build the whole export each time the note shows).
 */
export function noteImageSrc(src: string | null | undefined): string | null {
  const s = (src ?? '').trim();
  if (!SAME_ORIGIN.test(s)) return null;
  if (/^\/api\/items\/\d+\/image(\?[\w=&-]*)?$/.test(s)) return s;
  if (/^\/(img|covers|files)\/[^?#]+\.(png|jpe?g|gif|webp|avif|svg)$/i.test(s)) return s;
  return null;
}

/**
 * The placeholder the editor (Milkdown) writes for an empty paragraph or list item, so that an empty item survives a
 * save (`- <br />`). Readers treat it as an empty line; nothing else in a note may be raw HTML.
 */
const EMPTY_LINE = /<br\s*\/?>/gi;

/** The markdown without the editor's empty-line placeholders and without any whitespace: what was really written. */
const essence = (markdown: string) => markdown.replace(EMPTY_LINE, '').replace(/\s+/g, '');

/**
 * Whether a note's markdown differs from its starting template in more than whitespace and the editor's empty-line
 * placeholders (an untouched template, as typed or as the editor saves it).
 */
export function changedFromTemplate(markdown: string, template: string): boolean {
  return essence(markdown) !== essence(template);
}

/** Whether a note has no text at all (only whitespace and empty-line placeholders). */
export function isBlankNote(markdown: string): boolean {
  return essence(markdown) === '';
}
