// Copies of unsaved note text in this browser (localStorage; DECISIONS 9.8). Each editor (one mount of one) writes
// its own copy, `alex-brain:note-draft:<key>:<owner>`, while the server lacks its text and removes it once the server
// has it: nothing an editor writes ever overwrites or removes another editor's copy (another tab's, a closed one's,
// the copy a page offers back). A copy whose writer is gone (its page closed or crashed, its save failed, a conflict
// stopped it) is what a page offers back ("Có bản nháp chưa lưu"), until it is restored or dropped.
// Pure helpers over a Storage-like object; the editors' side is components/brain/library/use-note-autosave.ts.
import { isBlankNote } from './item-notes';

export interface NoteText {
  title: string;
  markdown: string;
}

/** A copy of unsaved text: when it was written, by which page load and, for a new note, its create's id. */
export interface NoteCopy extends NoteText {
  at: string;
  /** The page load (a tab until it reloads) that wrote it; '' for a copy from before copies had writers. */
  tab: string;
  /** A new note's id of the editor that wrote it (its create may have arrived since). */
  clientId?: string;
}

/** A copy as stored. */
export interface Slot {
  name: string;
  /** `note-<id>`, `new` (the notes page) or `new-item-<id>` (a new note of that Item). */
  key: string;
  /** The editor (one mount) that wrote it; '' for a copy from before copies had writers. */
  owner: string;
  copy: NoteCopy;
}

export type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem'>;

export const COPY_PREFIX = 'alex-brain:note-draft:';
/** A saved note's copies are keyed by its id, wherever it is edited (the Item page, the note page). */
export const noteKey = (id: number) => `note-${id}`;
export const slotName = (key: string, owner: string) => `${COPY_PREFIX}${key}:${owner}`;

const KEY = /^(?:note-\d+|new|new-item-\d+)$/;

/** The key and the writer of a storage name; null for any other name. */
export function parseSlotName(name: string): { key: string; owner: string } | null {
  if (!name.startsWith(COPY_PREFIX)) return null;
  const rest = name.slice(COPY_PREFIX.length);
  const at = rest.indexOf(':');
  const key = at < 0 ? rest : rest.slice(0, at);
  if (!KEY.test(key)) return null;
  return { key, owner: at < 0 ? '' : rest.slice(at + 1) };
}

/** A stored copy, or null for anything broken (a broken copy is no copy). */
export function parseCopy(raw: string | null): NoteCopy | null {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (
      value &&
      typeof value === 'object' &&
      'markdown' in value &&
      'title' in value &&
      'at' in value &&
      typeof value.markdown === 'string' &&
      typeof value.title === 'string' &&
      typeof value.at === 'string'
    ) {
      const tab = 'tab' in value && typeof value.tab === 'string' ? value.tab : '';
      const clientId = 'clientId' in value && typeof value.clientId === 'string' ? value.clientId : undefined;
      return {
        title: value.title,
        markdown: value.markdown,
        at: value.at,
        tab,
        ...(clientId && { clientId }),
      };
    }
  } catch {
    // not JSON
  }
  return null;
}

export const serializeCopy = (copy: NoteCopy) =>
  JSON.stringify({
    title: copy.title,
    markdown: copy.markdown,
    at: copy.at,
    tab: copy.tab,
    clientId: copy.clientId,
  });

/** Every copy stored under a key `match` accepts, in storage order. */
export function readSlots(storage: StorageLike, match: (key: string) => boolean): Slot[] {
  const out: Slot[] = [];
  for (let i = 0; i < storage.length; i++) {
    const name = storage.key(i);
    const parsed = name ? parseSlotName(name) : null;
    if (!name || !parsed || !match(parsed.key)) continue;
    const copy = parseCopy(storage.getItem(name));
    if (copy) out.push({ name, ...parsed, copy });
  }
  return out;
}

/** The same text as far as the server is concerned (it trims the title). */
export const sameText = (a: NoteText, b: NoteText) => a.title.trim() === b.title.trim() && a.markdown === b.markdown;

/**
 * The copies a page offers back, newest first and one per text: written by an editor that is gone (`live` names the
 * ones still open or still sending, whose copies are theirs), with something in them, and different from what the
 * server has (`server`) and from what the editor opens with (`opening`). `ready` holds back a copy until it is known
 * to be one (a new note's copy whose create may have arrived is asked about first).
 */
export function offeredCopies(
  slots: readonly Slot[],
  opts: {
    live: (slot: Slot) => boolean;
    server?: NoteText | null;
    opening?: NoteText | null;
    ready?: (slot: Slot) => boolean;
  },
): Slot[] {
  const out: Slot[] = [];
  const sorted = [...slots].sort((a, b) => Date.parse(b.copy.at) - Date.parse(a.copy.at));
  for (const slot of sorted) {
    const { copy } = slot;
    if (opts.live(slot) || isBlankNote(copy.markdown)) continue;
    if (opts.server && sameText(copy, opts.server)) continue;
    if (opts.opening && sameText(copy, opts.opening)) continue;
    if (opts.ready && !opts.ready(slot)) continue;
    if (out.some((o) => sameText(o.copy, copy))) continue;
    out.push(slot);
  }
  return out;
}

/** The note page's query that opens a new note's copy: `new` -> `id=new`, `new-item-4` -> `id=new&item=4`. */
export function newNoteQuery(key: string): string | null {
  if (key === 'new') return 'id=new';
  const m = /^new-item-(\d+)$/.exec(key);
  return m ? `id=new&item=${m[1]}` : null;
}

export const isNewNoteKey = (key: string) => newNoteQuery(key) !== null;
