// Copies of unsaved note text in this browser (localStorage; DECISIONS 9.8). Each editor (one mount of one) writes
// its own copy, `alex-brain:note-draft:<key>:<owner>`, while the server lacks its text and removes it once the server
// has it: nothing an editor writes ever overwrites or removes another editor's copy (another tab's, a closed one's,
// the copy a page offers back). A copy whose writer is gone (its page closed or crashed, its save failed, a conflict
// stopped it) is what a page offers back ("Có bản nháp chưa lưu"), until it is restored or dropped; an editor open in
// another tab is not gone (writerLive). A copy also names the version of the note it was written over: a note saved
// after that version may hold its text already (its save can arrive unanswered as a tab closes), so it is offered as
// written over an older version, never as unsaved (writtenOverOlder).
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
  /**
   * The version of the note (its `updatedAt`) the text was written over; none for a new note's copy and for copies
   * from before copies said so. A note saved since (here or elsewhere) may hold this text already: the copy is then
   * offered as written over an older version, never as plain unsaved text.
   */
  base?: string;
  /** textHash() of the text a save of its editor was sending as it was written (the version it makes is unknown). */
  sent?: string;
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
      const field = (key: string) => {
        const v = (value as Record<string, unknown>)[key];
        return typeof v === 'string' ? v : undefined;
      };
      const clientId = field('clientId');
      const base = field('base');
      const sent = field('sent');
      return {
        title: value.title,
        markdown: value.markdown,
        at: value.at,
        tab: field('tab') ?? '',
        ...(clientId && { clientId }),
        ...(base && { base }),
        ...(sent && { sent }),
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
    base: copy.base,
    sent: copy.sent,
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

/** A short fingerprint of a text as the server keeps it (FNV-1a, 32 bits): a copy names a text without holding it. */
export function textHash(text: NoteText): string {
  const s = `${text.title.trim()}\u0000${text.markdown}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Whether `note` (the version a page shows) was saved after the version `copy` was written over: by its own save that
 * arrived unanswered (a tab closed right after typing), or elsewhere. The page cannot tell which, so such a copy is
 * offered as written over an older version: restoring it replaces the newer text. A copy whose save was on its way
 * when it was written is not, when that save's text is what the note holds now (only that save arrived since).
 */
export function writtenOverOlder(copy: NoteCopy, note: (NoteText & { updatedAt: string }) | null): boolean {
  if (!copy.base || !note || note.updatedAt === copy.base) return false;
  if (copy.sent && copy.sent === textHash(note)) return false;
  // dates, not strings (the same time may come written with another offset); a page showing an older version than
  // the copy's (a list loaded before) says nothing about it
  return Date.parse(note.updatedAt) > Date.parse(copy.base);
}

/**
 * Who may still be writing a copy (DECISIONS 9.8: a copy is offered only once the place that wrote it is gone).
 * `live`: the editors of this page load (`tab`) that are open or still sending. `held`: the editors whose lock some
 * page holds (navigator.locks, one lock per open editor, released by the browser when its page closes or crashes), as
 * the page last asked at `askedAt` (ms); null before the first answer, undefined without Web Locks (another page's copy
 * is then taken as gone, as before). A copy written shortly before or after that question may be an editor's that had
 * not got its lock yet: it waits for the next question.
 */
export interface Presence {
  tab: string;
  live: ReadonlySet<string>;
  held?: ReadonlySet<string> | null;
  askedAt: number;
}
/** How long before a question a copy may have been written by an editor still getting its lock. */
export const LOCK_GRACE_MS = 500;

export function writerLive(slot: Slot, p: Presence): boolean {
  const { copy, owner } = slot;
  // a copy from before copies had writers: its writer is long gone
  if (!owner || !copy.tab) return false;
  if (copy.tab === p.tab) return p.live.has(owner);
  if (p.held === undefined) return false;
  if (p.held === null || p.held.has(owner)) return true;
  return Date.parse(copy.at) > p.askedAt - LOCK_GRACE_MS;
}

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
