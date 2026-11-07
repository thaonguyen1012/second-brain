// Pure logic of the Item page's notes (DECISIONS 9.8) and of the notes page's "Theo item" view: grouping notes by
// their Items, the words of a note's date and heading, and which markdown links and images may render. No React, no
// API calls; unit-tested in item-notes.test.ts.
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
export function noteDateLabel(note: Pick<NoteLike, 'createdAt' | 'updatedAt'>): string {
  const edited = note.updatedAt.slice(0, 10) !== note.createdAt.slice(0, 10);
  return edited ? `sửa ${formatDate(note.updatedAt)}` : formatDate(note.createdAt);
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

/** What a link in a rendered note becomes: an in-app link, an external link (new tab), or plain text. */
export type MarkdownHref = { kind: 'internal'; href: string } | { kind: 'external'; href: string } | { kind: 'text' };

/**
 * Links in notes: a same-origin path (`/thu-vien/item/?id=12`, the future `[[ ]]` links) stays in the app; http(s)
 * and mailto open outside it; anything else (javascript:, data:, protocol-relative `//host`, relative paths) is shown
 * as text, never as a link.
 */
export function markdownHref(href: string | null | undefined): MarkdownHref {
  const h = (href ?? '').trim();
  if (h.startsWith('/') && !h.startsWith('//') && !h.startsWith('/\\')) return { kind: 'internal', href: h };
  if (/^(https?:\/\/|mailto:)\S+$/i.test(h)) return { kind: 'external', href: h };
  return { kind: 'text' };
}

/** Whether a note's markdown differs from its starting template in more than whitespace (an untouched template). */
export function changedFromTemplate(markdown: string, template: string): boolean {
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
  return squash(markdown) !== squash(template);
}
