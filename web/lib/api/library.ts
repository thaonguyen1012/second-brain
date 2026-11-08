// Typed helpers for Thư viện (notes, the full Item list) and the inbox -> Item follow-up. Calls the backend
// through ./client: lists go through api.page(), writes through request().
import type { components, operations } from './schema';
import { api, request, withQuery, type ApiInboxEntry, type ApiItem, type Page } from './client';

type Schemas = components['schemas'];
export type ApiNote = Schemas['Note'];
export type ApiNoteCreate = Schemas['NoteWriteRequest'];
export type ApiNotePatch = Schemas['PatchedNoteWriteRequest'];
export type ApiNoteQuery = NonNullable<operations['listNotes']['parameters']['query']>;
export type ApiNoteSearchHit = Schemas['NoteSearchHit'];
export type ApiItemMentions = Schemas['ItemMentions'];
export type ApiNoteMentions = Schemas['NoteMentions'];

export const notesApi = {
  /** Newest created first; `q` matches title or markdown, `item` keeps notes linked to that Item. */
  list: (query?: ApiNoteQuery): Promise<Page<ApiNote>> => api.page<ApiNote>(withQuery('/api/notes', query)),
  get: (id: number) => request<ApiNote>('GET', `/api/notes/${id}`),
  /** Cmd+K: newest matching notes as title + ~120-character excerpt (never the whole markdown). */
  search: (q: string, limit = 5, signal?: AbortSignal) =>
    request<Schemas['NoteSearch']>('GET', withQuery('/api/notes/search', { q, limit }), undefined, signal),
  /** `keepalive`: the save may outlive the page (autosave while leaving). */
  create: (body: ApiNoteCreate, init?: { keepalive?: boolean }) =>
    request<ApiNote>('POST', '/api/notes', body, undefined, init),
  /** `items` replaces the links (`[]` removes them). */
  update: (id: number, body: ApiNotePatch, init?: { keepalive?: boolean }) =>
    request<ApiNote>('PATCH', `/api/notes/${id}`, body, undefined, init),
  delete: (id: number) => request<void>('DELETE', `/api/notes/${id}`),
  /** The notes whose text links this note (its backlinks, "Được nhắc tới ở"). */
  mentions: (id: number) => request<ApiNoteMentions>('GET', `/api/notes/${id}/mentions`),
};

/**
 * Where an Item is used ("Được nhắc tới ở", DECISIONS 9.8): the opportunities that hold it as evidence (with the
 * stance of each row) and the skills that do (with their freshness), newest evidence first.
 */
export const getItemMentions = (id: number) => request<ApiItemMentions>('GET', `/api/items/${id}/mentions`);

/** Upper bound for loadAllItems(): 10 pages of 200 (the backend's max page size). */
const ITEM_PAGES = 10;

/** Every Item of the owner, for pickers and id -> title lookups (one Item: api.getItem). */
export async function loadAllItems(): Promise<ApiItem[]> {
  let page = await api.listItems({ limit: 200 });
  const out = [...page.results];
  for (let i = 1; page.next && i < ITEM_PAGES; i++) {
    page = await api.page<ApiItem>(page.next);
    out.push(...page.results);
  }
  return out;
}

/** Links an inbox entry to an Item (`null` unlinks); the status is left as it is. */
export const linkInboxItem = (entry: number, item: number | null): Promise<ApiInboxEntry> =>
  api.triageInboxEntry(entry, { item });

/** An Item's image (a cover, poster or project logo; DECISIONS 9.6). Every call answers the whole Item, except remove. */
export const itemImageApi = {
  /** Re-encoded on the server (webp, at most 600 px); replaces the current image. */
  upload: (id: number, file: Blob, signal?: AbortSignal) => {
    const form = new FormData();
    form.append('file', file, file instanceof File ? file.name : 'image');
    return request<ApiItem>('POST', `/api/items/${id}/image`, form, signal);
  },
  /** The OG image of `url` (default: the Item's source), fetched by the next run_jobs (202, imagePending). */
  fetchFromLink: (id: number, url?: string) =>
    request<ApiItem>('POST', `/api/items/${id}/image/fetch`, url ? { url } : {}),
  remove: (id: number) => request<void>('DELETE', `/api/items/${id}/image`),
};
