// Thư viện area: note titles and the Item draft made from an inbox entry. Shared labels stay in lib/labels.ts.
import type { ApiInboxEntry, ApiItemRequest, ApiItemType } from '@/lib/api/client';
import type { ApiNote } from '@/lib/api/library';
import { hostOf } from '@/lib/labels';

/** Title shown for a note: its title, else the first non-empty markdown line without heading/quote marks. */
export function noteTitle(note: Pick<ApiNote, 'id' | 'title' | 'markdown'>): string {
  if (note.title.trim()) return note.title.trim();
  const line = note.markdown
    .split('\n')
    .map((l) => l.replace(/^\s*(#{1,6}\s+|>\s*|[-*+]\s+)/, '').trim())
    .find(Boolean);
  return line ? line.slice(0, 120) : `Ghi chú #${note.id}`;
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
