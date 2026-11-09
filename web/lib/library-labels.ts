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

// Note titles read the same as the backend's note_label (backend/library/services.py): the same patterns,
// whitespace set, line ends and cut in code points, so a note has one title everywhere.
const SPACE = '\\t\\n\\v\\f\\r \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff';
const SPACES = new RegExp(`[${SPACE}]+`, 'g');
const TRIM = new RegExp(`^[${SPACE}]+|[${SPACE}]+$`, 'g');
const LINE = /[^\r\n]+/g;
// A line's heading, quote, list and task marks (`## `, `> `, `- `, `1. `, `- [ ] `), nested ones too
const LINE_PREFIX = /^[ \t]*(?:(?:>|(?:[-*+]|[0-9]{1,9}[.)]|#{1,6})(?=[ \t]))[ \t]*)*(?:\[[ xX]\][ \t]+)?/;
// The editor's empty-line placeholder is no text
const EMPTY_LINE = new RegExp(`<br[${SPACE}]*/?>`, 'gi');
// Lines that hold no title (after their marks): a code fence, and a line of only dashes, colons and pipes with a dash
// (a thematic break, a setext underline, a table's delimiter row)
const NO_TITLE = /^(?:`{3,}[^`]*$|~{3,}|(?=[^-]*-)[-:| \t]*$)/;
// Read left to right, so an escaped character is never the start of anything else (`\!` before a link stays a
// `!`, `\[` opens no link) and every match attempt stops at the next bracket, parenthesis or line end that no
// backslash escapes (linear): an escape shows its character, a backslash that ends a line (a hard break) nothing,
// a link or image its text (also with the escaped parentheses the editor writes in a url:
// `(https://en.wikipedia.org/wiki/Atomic_Habits_\(book\))`), a numeric character reference its character (the
// editor writes `&#x20;` for a leading space); inline marks are left out (`_` inside a word, as in file_name, is
// no mark).
const INLINE =
  /\\([!-/:-@[-`{-~])|\\(?=[\r\n]|$)|!?\[((?:\\[^\r\n]|[^\\[\]\r\n])*)\]\((?:\\[^\r\n]|[^()\\\r\n])*\)|&#[xX]([0-9a-fA-F]{1,6});|&#([0-9]{1,7});|[*`~]+|(?<!_)(?<![\p{L}\p{N}])_+|(?<=[\p{L}\p{N}])_+(?!_)(?![\p{L}\p{N}])/gu;

function shown(_match: string, char?: string, text?: string, hex?: string, decimal?: string): string {
  if (char !== undefined) return char;
  if (text !== undefined) return text.replace(INLINE, shown);
  const code = hex ?? decimal;
  if (code) {
    const point = parseInt(code, hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff) ? String.fromCodePoint(point) : '\uFFFD';
  }
  return ' ';
}

/**
 * Title shown for a note: its title, else the first markdown line with text, without its heading, quote, list or
 * task marks (nested ones too), links shown by their text, escapes and character references by their character and
 * inline marks left out, cut at 120 characters (never inside one). Code fences, rules and delimiter rows hold no
 * title.
 */
export function noteTitle(note: Pick<ApiNote, 'id' | 'title' | 'markdown'>, t: T): string {
  const title = note.title.replace(TRIM, '');
  if (title) return title;
  for (const [line] of note.markdown.matchAll(LINE)) {
    const content = line.replace(EMPTY_LINE, ' ').replace(LINE_PREFIX, '');
    if (NO_TITLE.test(content)) continue;
    const text = content.replace(INLINE, shown).replace(SPACES, ' ').trim();
    if (text) return Array.from(text).slice(0, 120).join('');
  }
  return t('Ghi chú #{id}', { id: note.id });
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
