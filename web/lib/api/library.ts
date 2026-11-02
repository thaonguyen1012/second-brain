// Typed helpers for Thư viện (notes, the full Item list) and the inbox -> Item follow-up. Calls the backend
// through ./client: lists go through api.page(), writes through request().
import type { components, operations } from './schema';
import { api, request, withQuery, type ApiInboxEntry, type ApiItem, type Page } from './client';

type Schemas = components['schemas'];
export type ApiNote = Schemas['Note'];
export type ApiNoteCreate = Schemas['NoteWriteRequest'];
export type ApiNotePatch = Schemas['PatchedNoteWriteRequest'];
export type ApiNoteQuery = NonNullable<operations['listNotes']['parameters']['query']>;

export const notesApi = {
  /** Newest created first; `q` matches title or markdown, `item` keeps notes linked to that Item. */
  list: (query?: ApiNoteQuery): Promise<Page<ApiNote>> => api.page<ApiNote>(withQuery('/api/notes', query)),
  create: (body: ApiNoteCreate) => request<ApiNote>('POST', '/api/notes', body),
  /** `items` replaces the links (`[]` removes them). */
  update: (id: number, body: ApiNotePatch) => request<ApiNote>('PATCH', `/api/notes/${id}`, body),
  delete: (id: number) => request<void>('DELETE', `/api/notes/${id}`),
};

/** Upper bound for loadAllItems(): 10 pages of 200 (the backend's max page size). */
const ITEM_PAGES = 10;

/** Every Item of the owner, for pickers and id -> title lookups (there is no GET /api/items/{id}). */
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
