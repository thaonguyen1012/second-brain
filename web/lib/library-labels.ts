// Thư viện area: note titles, the words of an Item's source and date, and the Item draft made from an inbox entry.
// Shared labels stay in lib/labels.ts.
import type { ApiInboxEntry, ApiItem, ApiItemRequest, ApiItemType } from '@/lib/api/client';
import type { ApiNote } from '@/lib/api/library';
import { formatDate, hostOf } from '@/lib/labels';
import type { T } from '@/lib/i18n/translate';

/** An Item's source as a row or card shows it: "Sổ tay" for a handbook, the host for a link, else the text itself. */
export function itemSourceLabel(source: string | null | undefined, t: T): string {
  const s = (source ?? '').trim();
  if (!s) return '';
  if (s.startsWith('/docs/')) return t('Sổ tay');
  return /^https?:\/\//i.test(s) ? hostOf(s) || s : s;
}

/** The one date a board card names: finished in Xong, started in Đang làm, else when it was added. */
export function itemDateLabel(item: Pick<ApiItem, 'status' | 'createdAt' | 'startedAt' | 'finishedAt'>, t: T): string {
  if (item.status === 'done' && item.finishedAt) return t('xong {date}', { date: formatDate(item.finishedAt, t) });
  if (item.status === 'active' && item.startedAt) return t('bắt đầu {date}', { date: formatDate(item.startedAt, t) });
  return t('thêm {date}', { date: formatDate(item.createdAt, t) });
}

/**
 * Title shown for a note: its title, else the first non-empty markdown line without its heading, quote, list or task
 * marks (nested ones too), links shown by their text and escapes by their character (as the backend's note_label).
 */
export function noteTitle(note: Pick<ApiNote, 'id' | 'title' | 'markdown'>, t: T): string {
  if (note.title.trim()) return note.title.trim();
  const line = note.markdown
    .split('\n')
    .map((l) =>
      l
        // the editor's empty-line placeholder (`<br />`) is no text
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/^[ \t]*(?:(?:>|(?:[-*+]|\d{1,9}[.)]|#{1,6})(?=[ \t]))[ \t]*)*(?:\[[ xX]\][ \t]+)?/, '')
        // `[Atomic Habits](/thu-vien/item/?id=12)` (a `[[ ]]` link) reads as its text, escaped brackets and all
        .replace(/!?\[((?:\\.|[^\\[\]\n])*)\]\([^()\n]*\)/g, '$1')
        // the editor writes `\[`, `\*`, `\_` for the characters themselves
        .replace(/\\([!-\x2f:-@[-\x60{-~])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .find(Boolean);
  return line ? line.slice(0, 120) : t('Ghi chú #{id}', { id: note.id });
}

/** Hosts whose links are clearly one Item type; everything else falls back to the suggested destination. */
const hostTypes: Record<string, ApiItemType> = {
  'coursera.org': 'course',
  'udemy.com': 'course',
  'edx.org': 'course',
  'imdb.com': 'film',
  'csfd.cz': 'film',
  'letterboxd.com': 'film',
  'goodreads.com': 'book',
  'databazeknih.cz': 'book',
};

/** `suggestedDestination` -> Item type: book -> book, read_later (and the rest) -> article. */
export function itemTypeForEntry(entry: ApiInboxEntry): ApiItemType {
  const host = hostOf(entry.url);
  const byHost = Object.entries(hostTypes).find(([h]) => host === h || host.endsWith(`.${h}`));
  if (byHost) return byHost[1];
  return entry.suggestedDestination === 'book' ? 'book' : 'article';
}

/** Item fields prefilled from the entry's OpenGraph data (title, source, tags); status planned. */
export function itemDraftFromEntry(entry: ApiInboxEntry, title: string): Partial<ApiItemRequest> {
  return {
    title: title.slice(0, 300),
    type: itemTypeForEntry(entry),
    status: 'planned',
    source: (entry.url || entry.ogSiteName || '').slice(0, 2000),
    tags: entry.suggestedTags.map((t) => t.slice(0, 50)),
  };
}
