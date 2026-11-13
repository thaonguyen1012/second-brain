'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ApiNote } from '@/lib/api/library';
import { notesApi } from '@/lib/api/library';
import { toApiError } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { MAX_MARKDOWN, changedFromTemplate, isBlankNote } from '@/lib/item-notes';
import { fieldErrors } from '@/lib/labels';
import {
  isNewNoteKey,
  LOCK_GRACE_MS,
  noteKey,
  offeredCopies,
  parseCopy,
  readSlots,
  sameText as same,
  serializeCopy,
  slotName,
  textHash,
  writerLive,
  writtenOverOlder,
  type NoteCopy,
  type NoteText,
  type Slot,
  type StorageLike,
} from '@/lib/note-copies';
import { describeApiError } from '../api-state';

// Saving a note like AFFiNE (DECISIONS 9.8): no "Lưu" button. A change is saved after a
// short pause; leaving (closing the editor or the Sheet, another page, hiding or closing the tab) saves at once.
// - Each editor keeps its own copy of what the server lacks in this browser (lib/note-copies.ts) and removes it once
//   the server has it; it never writes over or removes another's. A copy whose writer is gone (a closed or crashed
//   page, a failed save, a conflict) is offered back ("Khôi phục") until it is restored or dropped. An editor with a
//   copy holds a Web Lock while it is open or still sending, so another tab never offers or drops an open editor's copy.
// - A copy says which version of the note it was written over: a note saved since (by that copy's own save, which may
//   arrive unanswered as a tab closes, or elsewhere) offers it as written over an older version, never as unsaved.
// - A new note is created by its first save that has something in it (an empty note or an untouched template is not
//   a note), with an id of this editor's own (`clientId`): a create sent twice makes one note, and a copy left by a
//   page that closed while creating is first asked about (`?clientId=`): if its create arrived, it is that note's.
// - Every edit says which version it started from (`baseUpdatedAt`): a note saved since (another tab or device)
//   answers 409 and is never overwritten; the page shows the newer note, and this text comes back as the copy. A
//   409 (or a create's 200) that holds a text this page sent and never got the answer to is this page's own save.
// - The editors of one note on this page form one line of saves: an editor closed while its save is on the way hands
//   its text, and the version that text was written on, to the next editor of the note, which waits (once, before its
//   first save) for that save and then goes on from what this page's own saves left on the server (never from a
//   version only seen in a 409). An editor never waits for one that took over from it.

export type SaveState = 'idle' | 'waiting' | 'saving' | 'saved' | 'error';
export type { NoteText };
export { noteKey };

/** A copy offered back: its text and when it was written. */
export type NoteBackup = NoteCopy;
/** How a copy is offered: text the server lacks, or text written over a version the note has been saved after. */
export type CopyOffer = 'unsaved' | 'older';

const DELAY_MS = 800;
/** A save with no answer by then fails like an unreachable server (reason and "Thử lại"), never "Đang lưu…" forever. */
const SAVE_TIMEOUT_MS = 15_000;
/** The longest an editor waits for the closed editor it took over from (whose saves have the limit above). */
const HANDOFF_WAIT_MS = SAVE_TIMEOUT_MS + 1_000;
/**
 * While keys come faster than the editor reports its text (200 ms after the last one), the copy is brought up to date
 * this often (less often for a note slow to read: a tenth of the time at most), so a crashing tab loses only the last
 * keys, not the whole burst.
 */
const PULL_EVERY_MS = 150;
/** A new note's copy whose create was not found (or not asked) is asked about again after this, when it shows. */
const ASK_AGAIN_MS = 30_000;
/** Another tab's copy waits while its editor may be open: the browser is asked again about it this often. */
const LOCKS_AGAIN_MS = 2_000;
const FIELD_NAMES: Record<string, Msg> = {
  title: msg('Tiêu đề'),
  markdown: msg('Nội dung'),
  items: msg('Item'),
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

/** This page load: its copies say so (another page's copy is that page's, open or gone). */
const TAB = newId();
/** Sent on this page when copies (or which editors are live) change: the `storage` event only reaches other tabs. */
const COPY_EVENT = 'alex-brain:note-draft';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // blocked storage: only the copies this page keeps itself (below)
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(COPY_EVENT));
}

// Copies localStorage refused (full, or blocked): kept for this page load, so they are still offered back and handed
// on here, and the tab asks before it goes while a failed save's text is only here
const unstored = new Map<string, string>();

function readCopy(name: string): string | null {
  const here = unstored.get(name);
  if (here !== undefined) return here;
  try {
    return storage()?.getItem(name) ?? null;
  } catch {
    return null;
  }
}

/** localStorage with the copies it refused, as one store. */
function copyStore(): StorageLike | null {
  const s = storage();
  if (unstored.size === 0) return s;
  const names = [...unstored.keys()];
  try {
    for (let i = 0; s && i < s.length; i++) {
      const name = s.key(i);
      if (name !== null && !unstored.has(name)) names.push(name);
    }
  } catch {
    // only the copies kept here
  }
  return { length: names.length, key: (i) => names[i] ?? null, getItem: readCopy };
}

function writeSlot(name: string, copy: NoteCopy | null) {
  const value = copy ? serializeCopy(copy) : null;
  let stored = false;
  try {
    const s = storage();
    if (s) {
      if (value === null) s.removeItem(name);
      else s.setItem(name, value);
      stored = true;
    }
  } catch {
    // full (the quota) or blocked: kept for this page load below
  }
  if (value === null || stored) unstored.delete(name);
  else unstored.set(name, value);
  notify();
}

const slotsUnder = (key: string): Slot[] => {
  const s = copyStore();
  return s ? readSlots(s, (k) => k === key) : [];
};

function subscribeCopies(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(COPY_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(COPY_EVENT, onChange);
  };
}

/**
 * What the copies under the keys `match` accepts look like now, and whether each is live or ready to offer: a string,
 * so a change elsewhere (another note's copy, a keystroke in another editor) renders nothing here.
 */
function snapshotOf(match: (key: string) => boolean): string {
  const s = copyStore();
  if (!s) return '';
  const parts: string[] = [];
  for (const slot of readSlots(s, match))
    parts.push(slot.name, serializeCopy(slot.copy), isLive(slot) ? 'live' : '', ready(slot) ? 'ready' : '');
  return parts.join('\u0000');
}

// The editors of this page that are open or still sending what they had when they closed: their copies are theirs,
// not copies to offer back. One that has a copy holds a Web Lock named after it meanwhile, so the editors of other tabs
// count too: the browser lets go of a page's locks when it closes or crashes, and the page asks it which are held
// (writerLive). Only while it has a copy: a page holding a lock may be kept out of the back/forward cache. Without
// Web Locks another tab's copy is offered, as before.
const live = new Set<string>();
const LOCK_PREFIX = 'alex-brain:note-editor:';
const lockManager = (): LockManager | null =>
  typeof navigator === 'undefined' ? null : ((navigator as Partial<Navigator>).locks ?? null);
/** The editors with a copy of their own; their lock, once granted (its release); a lock asked for and not granted. */
const withCopy = new Set<string>();
const releases = new Map<string, () => void>();
const requested = new Set<string>();

/** Takes or lets go of `owner`'s lock: held while the editor is live and has a copy. */
function syncLock(owner: string) {
  const want = live.has(owner) && withCopy.has(owner);
  const release = releases.get(owner);
  if (!want && release) {
    releases.delete(owner);
    release();
  }
  const locks = lockManager();
  if (!want || !locks || release || requested.has(owner)) return;
  requested.add(owner);
  void locks
    .request(LOCK_PREFIX + owner, () => {
      requested.delete(owner);
      // let go at once when it is no longer wanted (the copy went, or the editor) before the browser granted it
      if (!live.has(owner) || !withCopy.has(owner)) return undefined;
      return new Promise<void>((resolve) => releases.set(owner, resolve));
    })
    .catch(() => requested.delete(owner));
}

function goLive(owner: string) {
  live.add(owner);
  syncLock(owner);
  notify();
}

function goGone(owner: string) {
  live.delete(owner);
  withCopy.delete(owner);
  syncLock(owner);
  notify();
}

/** The editors whose lock a page held when this page last asked (null until the first answer), and when it asked. */
let heldLocks: Set<string> | null = null;
let askedAt = 0;
let lockQuestion: number | undefined;

/** When the next question goes (a sooner one replaces it), and whether one is on its way. */
let questionAt = 0;
let questionOut = false;

/** Asks the browser which editors hold their lock within `ms` (one question at a time); the copies are read again. */
function askLocks(ms: number) {
  const locks = lockManager();
  if (!locks || questionOut) return;
  const when = Date.now() + ms;
  if (lockQuestion !== undefined) {
    if (questionAt <= when) return;
    window.clearTimeout(lockQuestion);
  }
  questionAt = when;
  lockQuestion = window.setTimeout(() => {
    questionOut = true;
    const at = Date.now();
    locks
      .query()
      .then(
        (state) => {
          const names = (state.held ?? []).map((lock) => lock.name ?? '');
          heldLocks = new Set(names.filter((n) => n.startsWith(LOCK_PREFIX)).map((n) => n.slice(LOCK_PREFIX.length)));
        },
        // no answer: another tab's copies are offered, as without Web Locks
        () => {
          heldLocks = new Set();
        },
      )
      .finally(() => {
        askedAt = at;
        lockQuestion = undefined;
        questionOut = false;
        notify();
      });
  }, ms);
}

function isLive(slot: Slot): boolean {
  const locks = lockManager();
  const alive = writerLive(slot, { tab: TAB, live, held: locks ? heldLocks : undefined, askedAt });
  // another tab's editor that may be open: asked about again (it may close, or crash, any time); a copy written just
  // before the last question (its editor may not have had its lock yet) as soon as that wait is over
  if (alive && locks && slot.copy.tab !== TAB) {
    const graceOver = Date.parse(slot.copy.at) + LOCK_GRACE_MS + 50 - Date.now();
    askLocks(heldLocks === null ? 0 : heldLocks.has(slot.owner) ? LOCKS_AGAIN_MS : Math.max(0, graceOver));
  }
  return alive;
}

const textOf = (note: ApiNote): NoteText => ({
  title: note.title,
  markdown: note.markdown,
});
const bodyOf = (text: NoteText) => ({
  title: text.title.trim(),
  markdown: text.markdown,
});
/** When a version was saved (dates, not strings: the server's offset changes with summer time). */
const savedAt = (n: ApiNote) => Date.parse(n.updatedAt);
const later = (a: ApiNote, b: ApiNote | undefined) => (b && savedAt(b) > savedAt(a) ? b : a);

/** The newest version of each note this page has seen (its own saves, a 409's body, a newer fetch). */
const known = new Map<number, ApiNote>();
const remember = (n: ApiNote) => known.set(n.id, later(n, known.get(n.id)));

/**
 * Per note, this page's line of saves: the version they go on from (the last own answer, or what the open editor
 * started from), and the text a closed editor still sends, with the version it was written on.
 */
interface Lineage {
  base: ApiNote;
  pending?: {
    owner: string;
    text: NoteText;
    base: ApiNote;
    done: Promise<void>;
  };
}
const lineages = new Map<number, Lineage>();

/** Resolves when `p` settles, or after `ms` at the latest. */
const settled = (p: Promise<unknown>, ms: number) =>
  new Promise<void>((resolve) => {
    const limit = window.setTimeout(resolve, ms);
    const end = () => {
      window.clearTimeout(limit);
      resolve();
    };
    p.then(end, end);
  });

// A new note's copy left by a page that closed while creating it: asked about (`?clientId=`) before it is offered. If
// its create arrived, the copy becomes that note's (or goes, when the note already has its text). Not found, it is
// offered, and asked about again on a later look (a create on a slow network may arrive after the question).
const asked = new Map<string, 'absent' | 'failed'>();
const askingIds = new Set<string>();
/** An answered question is asked again on a later look, not on every keystroke meanwhile. */
const askAgainAt = new Map<string, number>();
function settle(slot: Slot) {
  const id = slot.copy.clientId;
  if (!id || askingIds.has(id)) return;
  if (asked.has(id) && Date.now() < (askAgainAt.get(id) ?? 0)) return;
  askingIds.add(id);
  notesApi
    .list({ clientId: id, limit: 1 })
    .then(
      (page) => {
        const made = page.results[0];
        if (!made) {
          asked.set(id, 'absent');
          askAgainAt.set(id, Date.now() + ASK_AGAIN_MS);
          return;
        }
        asked.delete(id);
        remember(made);
        const now = parseCopy(readCopy(slot.name));
        if (!now) return;
        writeSlot(slot.name, null);
        // the note's copy from now on, written over the version its create made: a note edited since (elsewhere)
        // offers it as written over an older version, never as unsaved text
        if (!same(now, textOf(made)) && !isBlankNote(now.markdown))
          writeSlot(slotName(noteKey(made.id), slot.owner || newId()), {
            ...now,
            clientId: undefined,
            base: made.createdAt,
          });
      },
      // unreachable: offered as a new note's copy (restored, its create sent again answers the note if it was made)
      () => {
        asked.set(id, 'failed');
        askAgainAt.set(id, Date.now() + ASK_AGAIN_MS);
      },
    )
    .finally(() => {
      askingIds.delete(id);
      notify();
    });
}
/** A new note's copy is offered once its question was answered (and while it is asked again). */
const ready = (slot: Slot) => {
  const id = slot.copy.clientId;
  return !id || asked.has(id);
};

/** The copies offered back under the keys `match` accepts (see offeredCopies), asking about new notes' copies. */
function useOffered(match: (key: string) => boolean, server: NoteText | null, opening: NoteText | null): Slot[] {
  const snap = useSyncExternalStore(
    subscribeCopies,
    () => snapshotOf(match),
    () => '',
  );
  // `snap` stands for the store: read again whenever it changes
  const slots = useMemo(() => {
    const s = snap ? copyStore() : null;
    return s ? readSlots(s, match) : [];
  }, [snap, match]);
  useEffect(() => {
    for (const slot of slots) if (isNewNoteKey(slot.key) && !isLive(slot) && slot.copy.clientId) settle(slot);
  }, [slots]);
  return offeredCopies(slots, { live: isLive, server, opening, ready });
}

/** A note as a page shows it: its text and, for a saved note, the version. */
type ShownNote = NoteText & { updatedAt?: string };

/** How the copy `slot` is offered beside `note` as the page shows it. */
const offerOf = (slot: Slot, note: ShownNote | null): CopyOffer =>
  note?.updatedAt && writtenOverOlder(slot.copy, { ...note, updatedAt: note.updatedAt }) ? 'older' : 'unsaved';

/**
 * Whether this browser keeps a copy of unsaved text under `key` (`noteKey(id)`, or a new note's key) that differs from
 * `note` as the page shows it, and how it is offered: the reading view says so, and the editor offers the copy back.
 */
export function useUnsavedCopy(key: string, note: ShownNote | null): CopyOffer | null {
  const match = useCallback((k: string) => k === key, [key]);
  const first = useOffered(match, note, null)[0];
  return first ? offerOf(first, note) : null;
}

/**
 * The new notes whose unsaved text this browser keeps (`new`, `new-item-<id>`), newest first, each with the title of
 * its newest copy: the notes list.
 */
export function useNewNoteCopies(): { key: string; title: string }[] {
  const slots = useOffered(isNewNoteKey, null, null);
  const out: { key: string; title: string }[] = [];
  for (const s of slots) if (!out.some((o) => o.key === s.key)) out.push({ key: s.key, title: s.copy.title });
  return out;
}

/**
 * The page asks before the tab goes while a failed save's text is still not on the server: an open editor's, whatever
 * became of its copy (storage full or blocked, the copy dropped elsewhere), or the copy of an editor closed since.
 * Per editor: whether that is still so.
 */
const failedSaves = new Map<string, () => boolean>();
let guarded = false;
function guardTab() {
  if (guarded || typeof window === 'undefined') return;
  guarded = true;
  window.addEventListener('beforeunload', (e) => {
    for (const [owner, unsaved] of failedSaves) if (!unsaved()) failedSaves.delete(owner);
    if (failedSaves.size === 0) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

/** Why a save failed, in words for the save status (not "could not load", the wording of a failed read). */
export function saveErrorText(err: unknown, t: T): string {
  const e = toApiError(err);
  if (e.timedOut) return t('Máy chủ không trả lời.');
  if (e.status === 400) return fieldErrors(e.body, t, FIELD_NAMES) || t('Máy chủ không nhận nội dung này.');
  if (!e.reachable || e.status === 401 || e.status === 403) return describeApiError(e, t).title;
  if (e.status === 404) return t('Ghi chú không còn trên máy chủ.');
  if (e.status === 409) return t('Ghi chú vừa được lưu ở nơi khác');
  return t('Máy chủ trả lỗi {status}.', { status: e.status });
}

function conflictNote(err: unknown): ApiNote | null {
  const e = toApiError(err);
  if (e.status !== 409 || !e.body || typeof e.body !== 'object' || !('note' in e.body)) return null;
  return (e.body as { note: ApiNote }).note;
}

export function useNoteAutosave({
  note: initial,
  items,
  template = '',
  initialTitle = '',
  draftKey,
  onSaved,
  onConflict,
  fresh,
  pull,
}: {
  /** The note being edited; null for a new note, created by its first save. */
  note: ApiNote | null;
  /** A new note's links to Items when it is created (the Item page: that Item; the note page: what was picked). */
  items?: () => number[];
  /** What a new note starts from: left untouched, nothing is created. */
  template?: string;
  /** A new note's title as the page shows it (the Item's on the Item page). */
  initialTitle?: string;
  /** The key of a new note's copies in this browser until it is created (`new-item-4`, `new`); then `note-<id>`. */
  draftKey: string;
  /** The server's note after each save (`created`: this editor's note just got its id). */
  onSaved: (note: ApiNote, created: boolean) => void;
  /**
   * Show `note` instead (remount the editor with it): it was saved elsewhere since this edit started (this text stays
   * as the copy, offered back), or, with nothing unsaved here, a newer version arrived (`fresh`). `linkError`: an Item
   * picked meanwhile could not be put on it (why).
   */
  onConflict?: (note: ApiNote, linkError?: string) => void;
  /** The note as the page last fetched it: newer than what this editor knows and nothing unsaved here, it shows. */
  fresh?: ApiNote | null;
  /** The editor's markdown right now (null while unchanged): read before a save that cannot wait for `change`. */
  pull?: () => string | null;
}) {
  const t = useT();
  const [owner] = useState(newId);
  // Where this editor starts: the text a closed editor of this note still sends (with the version it was written
  // on), else the newest version of the note this page knows
  const [setup] = useState(() => {
    const handed = initial ? lineages.get(initial.id)?.pending : undefined;
    if (initial && handed) return { base: handed.base, opening: handed.text, handed };
    const base = initial ? later(initial, known.get(initial.id)) : null;
    const opening = base ? textOf(base) : { title: initialTitle, markdown: template };
    return { base, opening, handed: undefined };
  });
  const start: NoteText = setup.base ? textOf(setup.base) : setup.opening;
  const note = useRef<ApiNote | null>(setup.base);
  const saved = useRef<NoteText>(start);
  const latest = useRef<NoteText>(setup.opening);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);
  // Every request of this editor, one after the other (a text save and an Items save never cross: each starts from
  // the version the one before it answered)
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(false);
  const failed = useRef(false);
  // After a conflict this editor sends nothing more: its text is the copy the next editor of the note offers
  const stopped = useRef(false);
  // The closed editor this one took over from: its save goes first, waited for once, before this one's first save of
  // its text or Items (never an editor that took over from this one: that one waits for this one); a save that never
  // answers is given up on with its time limit
  const handOff = useRef<Promise<void> | null>(null);
  const afterHandOff = useCallback(
    () => (handOff.current ??= setup.handed ? settled(setup.handed.done, HANDOFF_WAIT_MS) : Promise.resolve()),
    [setup],
  );
  // Texts this editor's line sent and got no answer to (a time limit, a lost connection, a page closing, the closed
  // editor it took over from): a 409 or a create's 200 that holds one is this page's own save that arrived
  const unanswered = useRef<NoteText[]>(setup.handed ? [setup.handed.text] : []);
  // The text of the save on its way: a copy written meanwhile names it (that save may arrive and its answer not)
  const sending = useRef<NoteText | null>(null);
  // Items saves not finished, and a version saved elsewhere that waits for them: the page shows it once, with them
  const picks = useRef(0);
  const heldConflict = useRef<{ note: ApiNote; linkError?: string } | null>(null);
  const onSavedRef = useRef(onSaved);
  const onConflictRef = useRef(onConflict);
  const pullRef = useRef(pull);
  const itemsRef = useRef(items);
  const [current, setCurrent] = useState<ApiNote | null>(setup.base);
  const [state, setState] = useState<SaveState>(same(setup.opening, start) ? 'idle' : 'waiting');
  const [error, setError] = useState<string | null>(null);
  // the text cannot be saved as it is (empty, too long): saying "Thử lại" would not help
  const [invalid, setInvalid] = useState(false);
  // A new note's own id; a restored copy brings the id its create was sent with
  const [firstClientId] = useState(newId);
  const clientId = useRef(firstClientId);
  useEffect(() => {
    onSavedRef.current = onSaved;
    onConflictRef.current = onConflict;
    pullRef.current = pull;
    itemsRef.current = items;
  });

  const copyKey = current ? noteKey(current.id) : draftKey;
  const matchKey = useCallback((k: string) => k === copyKey, [copyKey]);
  const offered = useOffered(matchKey, current ? textOf(current) : null, setup.opening);

  const ownName = useCallback(
    () => slotName(note.current ? noteKey(note.current.id) : draftKey, owner),
    [draftKey, owner],
  );
  /** Keeps `text` as this editor's copy while the server lacks it; null (or a note with nothing in it) removes it. */
  const keep = useCallback(
    (text: NoteText | null) => {
      const name = ownName();
      if (!text || isBlankNote(text.markdown)) {
        if (readCopy(name) != null) writeSlot(name, null);
        withCopy.delete(owner);
        syncLock(owner);
        return;
      }
      // the lock is asked for first: another tab that sees the copy before it is granted waits (LOCK_GRACE_MS)
      withCopy.add(owner);
      syncLock(owner);
      writeSlot(name, {
        title: text.title,
        markdown: text.markdown,
        at: new Date().toISOString(),
        tab: TAB,
        ...(note.current ? { base: note.current.updatedAt } : { clientId: clientId.current }),
        ...(sending.current && { sent: textHash(sending.current) }),
      });
    },
    [ownName, owner],
  );

  /** After a failed save: whether its text is still not on the server (the tab asks before it goes meanwhile). */
  const stillUnsaved = useCallback(() => {
    if (!failed.current) return false;
    // an open editor shows the text (its copy may be missing); a closed one left it in its copy, until that goes
    if (mounted.current) return !same(latest.current, saved.current) && !isBlankNote(latest.current.markdown);
    return readCopy(ownName()) != null;
  }, [ownName]);

  const show = useCallback(
    (next: SaveState, why: string | null = null, kind: 'failed' | 'invalid' = 'failed') => {
      failed.current = next === 'error';
      if (failed.current) {
        failedSaves.set(owner, stillUnsaved);
        guardTab();
      }
      if (!mounted.current) return;
      setState(next);
      setError(why);
      setInvalid(next === 'error' && kind === 'invalid');
    },
    [owner, stillUnsaved],
  );

  /** Why `text` is not sent: '' when there is nothing to save yet (no error), null when it can be sent. */
  const problem = useCallback(
    (text: NoteText): string | null => {
      if (isBlankNote(text.markdown)) return note.current ? t('Ghi chú cần có nội dung.') : '';
      if (!note.current && template && !changedFromTemplate(text.markdown, template)) return '';
      if (text.markdown.length > MAX_MARKDOWN) return t('Nội dung dài quá {max} ký tự.', { max: t.num(MAX_MARKDOWN) });
      return null;
    },
    [t, template],
  );

  const enqueue = useCallback(<R>(request: () => Promise<R>): Promise<R> => {
    const next = queue.current.then(request, request);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  /** An answer to this editor's own save: the version its next save starts from, and this page's line goes on. */
  const took = useCallback((answer: ApiNote) => {
    note.current = answer;
    // a request sent before it from an older version can no longer arrive (it would answer 409)
    unanswered.current = [];
    remember(answer);
    const line = lineages.get(answer.id);
    if (line) line.base = later(answer, line.base);
    else lineages.set(answer.id, { base: answer });
    if (mounted.current) setCurrent(answer);
  }, []);

  /** Whether `newer` holds this editor's text, or a text this page sent without getting the answer: its own save. */
  const ours = useCallback(
    (newer: ApiNote) =>
      same(latest.current, textOf(newer)) || unanswered.current.some((text) => same(text, textOf(newer))),
    [],
  );

  /** Goes on from what this page's own saves of the note left on the server (a closed editor's, handed over). */
  const follow = useCallback(() => {
    const base = note.current ? lineages.get(note.current.id)?.base : undefined;
    if (!base || !note.current || savedAt(base) <= savedAt(note.current)) return;
    note.current = base;
    saved.current = textOf(base);
    if (mounted.current) setCurrent(base);
  }, []);

  /** Takes the editor's text as it is now (it reports changes 200 ms late); before a save that cannot wait. */
  const catchUp = useCallback(() => {
    let markdown: string | null | undefined;
    try {
      markdown = pullRef.current?.();
    } catch {
      // the editor is already gone: what it reported last is the text
      return;
    }
    if (markdown == null || markdown === latest.current.markdown) return;
    latest.current = { ...latest.current, markdown };
    if (!same(latest.current, saved.current)) keep(latest.current);
  }, [keep]);

  /**
   * Saved elsewhere since this edit started: what this page has not saved stays as this editor's copy (the editor
   * that shows the newer note offers it back) and nothing more is sent. A newer version with this very text is this
   * page's own save (sent again as the page was hidden): it simply goes on from it. An Items save waiting behind goes
   * onto the newer version first; the page then shows it (saveItems).
   */
  const conflict = useCallback(
    (newer: ApiNote) => {
      if (stopped.current) return;
      remember(newer);
      // a closed editor caught up as it closed
      if (mounted.current) catchUp();
      if (same(latest.current, textOf(newer))) {
        took(newer);
        saved.current = textOf(newer);
        keep(null);
        show('saved');
        return;
      }
      stopped.current = true;
      window.clearTimeout(timer.current);
      keep(same(latest.current, saved.current) ? null : latest.current);
      // a closed editor's copy waits for the next opening of the note; an open one is replaced now
      if (!mounted.current) return;
      if (picks.current > 0) heldConflict.current = { note: newer };
      else onConflictRef.current?.(newer);
    },
    [catchUp, keep, show, took],
  );

  /**
   * Saves the latest text now; resolves true when nothing typed is left unsaved. One request at a time: a call while
   * one runs joins it, and text typed meanwhile is sent right after it.
   */
  const run = useCallback(
    (keepalive = false): Promise<boolean> => {
      if (stopped.current) return Promise.resolve(false);
      if (inFlight.current) return inFlight.current;
      const loop = async (): Promise<boolean> => {
        // the closed editor this one took over from sends first; then this one goes on from what it left
        await afterHandOff();
        for (;;) {
          follow();
          if (stopped.current) return false;
          const text = latest.current;
          if (same(text, saved.current)) {
            keep(null);
            show(note.current ? 'saved' : 'idle');
            return true;
          }
          const why = problem(text);
          if (why === '') {
            keep(null);
            show('idle');
            return true;
          }
          if (why) {
            show('error', why, 'invalid');
            return false;
          }
          show('saving');
          const creating = !note.current;
          // the same time limit for a request that may outlive the page (a closed editor, a hidden tab): a dead
          // connection ends in "Máy chủ không trả lời." and "Thử lại", and the next editor of the note goes on
          const init = { timeoutMs: SAVE_TIMEOUT_MS, ...(keepalive && { keepalive }) };
          sending.current = text;
          let answer: ApiNote;
          let made = true;
          try {
            answer = await enqueue(async () => {
              if (note.current) {
                const done = await notesApi.update(
                  note.current.id,
                  { ...bodyOf(text), baseUpdatedAt: note.current.updatedAt },
                  init,
                );
                took(done);
                return done;
              }
              const res = await notesApi.createOnce(
                {
                  ...bodyOf(text),
                  items: itemsRef.current?.() ?? [],
                  clientId: clientId.current,
                },
                init,
              );
              made = res.created;
              return res.note;
            });
          } catch (err) {
            sending.current = null;
            const newer = conflictNote(err);
            if (newer && ours(newer)) {
              // this page's own save arrived and its answer did not (a time limit, a closed editor's): go on from it
              took(newer);
              saved.current = textOf(newer);
              continue;
            }
            if (newer) {
              conflict(newer);
              return false;
            }
            // no answer: the text may still arrive, and a 409 holding it later is this save
            unanswered.current = [...unanswered.current.slice(-3), text];
            show('error', saveErrorText(err, t));
            return false;
          }
          sending.current = null;
          if (creating) {
            // the note has its id: this editor's copy and saves belong to it from now on
            writeSlot(slotName(draftKey, owner), null);
            // an earlier create with this id made the note (its answer was lost, or a closed page sent it): edited
            // since (elsewhere: a version after the create, with a text this page never sent), it shows as it is now
            // and this text stays as the copy to restore; otherwise this text goes on from it
            const elsewhere = !made && answer.updatedAt !== answer.createdAt && !ours(answer);
            took(answer);
            if (elsewhere && !same(textOf(answer), text)) {
              onSavedRef.current(answer, true);
              conflict(answer);
              return false;
            }
          }
          // what the server has now (an earlier create of this id answers the note as it was made)
          saved.current = textOf(answer);
          keep(same(latest.current, saved.current) ? null : latest.current);
          onSavedRef.current(answer, creating);
        }
      };
      const done = loop().finally(() => {
        inFlight.current = null;
      });
      inFlight.current = done;
      return done;
    },
    [afterHandOff, conflict, draftKey, enqueue, follow, keep, ours, owner, problem, show, t, took],
  );

  /** The editor's text changed: keep a copy here and save after a pause. */
  const change = useCallback(
    (text: NoteText) => {
      latest.current = text;
      window.clearTimeout(timer.current);
      if (stopped.current) {
        // the conflict's copy follows the last keystrokes until this editor goes
        if (!same(text, saved.current)) keep(text);
        return;
      }
      if (same(text, saved.current)) {
        keep(null);
        if (!inFlight.current) show(note.current ? 'saved' : 'idle');
        return;
      }
      keep(text);
      show('waiting');
      timer.current = window.setTimeout(() => void run(), DELAY_MS);
    },
    [keep, run, show],
  );

  /** Saves now ("Xong", Cmd/Ctrl+Enter, "Thử lại"); resolves true when nothing is left unsaved. */
  const flush = useCallback(
    (keepalive = false) => {
      window.clearTimeout(timer.current);
      catchUp();
      return run(keepalive);
    },
    [catchUp, run],
  );

  /**
   * Something was typed (its markdown follows through `change`): "Đang lưu…" at once, not 200 ms later, and the copy
   * keeps up during a burst of keys (PULL_EVERY_MS). Should no markdown follow (the text came back to what is saved),
   * the save after the pause finds that out and says so.
   */
  const nextPull = useRef(0);
  const touch = useCallback(() => {
    if (stopped.current) return;
    if (!failed.current) show('waiting');
    const now = Date.now();
    if (now >= nextPull.current) {
      const began = performance.now();
      catchUp();
      nextPull.current = now + Math.max(PULL_EVERY_MS, 10 * (performance.now() - began));
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      catchUp();
      void run();
    }, DELAY_MS);
  }, [catchUp, run, show]);

  /**
   * The page may go away (hidden, closed, another page): send what is left with keepalive, so the request outlives
   * the page. A request already running may die with the page: an edit is sent once more beside it (the same text
   * from the same version, so the second answers 409 or writes the same); a new note waits for its create (sent
   * again, its client id would answer the same note) and keeps its copy in this browser.
   */
  const leave = useCallback(() => {
    window.clearTimeout(timer.current);
    if (stopped.current) return;
    catchUp();
    const text = latest.current;
    if (same(text, saved.current)) return;
    if (inFlight.current && note.current && problem(text) === null) {
      const body = { ...bodyOf(text), baseUpdatedAt: note.current.updatedAt };
      // its answer is not read: arriving first, it makes the running save's 409, which holds this text
      unanswered.current = [...unanswered.current.slice(-3), text];
      void notesApi.update(note.current.id, body, { keepalive: true }).catch(() => undefined);
      return;
    }
    void run(true);
  }, [catchUp, problem, run]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') leave();
    };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [leave]);

  // A newer version fetched by the page (another tab or device saved it): shown at once when nothing here is unsaved;
  // otherwise this editor's next save meets it as a conflict
  const freshAt = fresh?.updatedAt;
  useEffect(() => {
    if (!fresh || !note.current || fresh.id !== note.current.id || savedAt(fresh) <= savedAt(note.current)) return;
    if (stopped.current || inFlight.current || !same(latest.current, saved.current)) return;
    remember(fresh);
    onConflictRef.current?.(fresh);
    // `fresh` is read through its date: a new object of the same version changes nothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshAt]);

  // Unmounting (the editor or the Sheet closed, a client-side navigation): save what is left; the request finishes
  // on its own and still reports through onSaved. The next editor of this note on this page goes on from it.
  // (Through refs: this runs once, at the real unmount, whatever the callbacks became.)
  const last = useRef({ run, catchUp });
  useEffect(() => {
    last.current = { run, catchUp };
  });
  useEffect(() => {
    mounted.current = true;
    goLive(owner);
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      last.current.catchUp();
      const text = latest.current;
      const emptied = note.current !== null && isBlankNote(text.markdown);
      if (stopped.current || emptied || same(text, saved.current)) {
        // after a conflict the text is the copy the next opening offers; an emptied note keeps what the server has
        // (deleting a note is its own action)
        goGone(owner);
        return;
      }
      const done = last.current.run(true);
      const base = note.current;
      const entry = base
        ? {
            owner,
            text,
            base,
            done: done.then(
              () => undefined,
              () => undefined,
            ),
          }
        : undefined;
      if (entry) {
        const line = lineages.get(entry.base.id);
        if (line) line.pending = entry;
        else lineages.set(entry.base.id, { base: entry.base, pending: entry });
      }
      void done.finally(() => {
        goGone(owner);
        const line = entry ? lineages.get(entry.base.id) : undefined;
        if (line && line.pending === entry) delete line.pending;
      });
    };
  }, [owner]);

  // Mounted: an editor that goes on with a closed editor's text keeps its own copy of it at once (that save may fail
  // and the page crash), and the closed editor's copy goes when its save ends; one that starts from the server's note
  // starts this page's line of saves there and drops copies that only repeat that note.
  useEffect(() => {
    const id = initial?.id;
    if (setup.handed && id !== undefined) {
      keep(setup.opening);
      const theirs = slotName(noteKey(id), setup.handed.owner);
      void setup.handed.done.then(() => {
        if (readCopy(theirs) != null) writeSlot(theirs, null);
      });
    } else if (setup.base) {
      const line = lineages.get(setup.base.id);
      if (!line) lineages.set(setup.base.id, { base: setup.base });
      else if (!line.pending) line.base = setup.base;
      for (const s of slotsUnder(noteKey(setup.base.id))) if (same(s.copy, start)) writeSlot(s.name, null);
    }
    if (!same(setup.opening, start)) timer.current = window.setTimeout(() => void run(), DELAY_MS);
    // once, for the text the page opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shownCopy = offered[0] ?? null;

  /** The offered copy as it is now (its editor may have written its last keystrokes after it was first offered). */
  const freshCopy = (slot: Slot): NoteCopy => parseCopy(readCopy(slot.name)) ?? slot.copy;
  /** Drops `copy` and every other copy of the same text under its key, except this editor's own and live ones. */
  const dropSame = (key: string, copy: NoteText) => {
    for (const s of slotsUnder(key)) if (s.owner !== owner && !isLive(s) && same(s.copy, copy)) writeSlot(s.name, null);
  };

  /**
   * A pick made on version `from` put onto `newer` (what was added or removed here) and saved; or `newer` as it is and
   * why the pick could not go on it.
   */
  const pickOnto = async (
    from: ApiNote,
    newer: ApiNote,
    next: number[],
  ): Promise<{ note: ApiNote; failure?: unknown }> => {
    const added = next.filter((i) => !from.items.includes(i));
    const removed = from.items.filter((i) => !next.includes(i));
    const merged = [
      ...newer.items.filter((i) => !removed.includes(i)),
      ...added.filter((i) => !newer.items.includes(i)),
    ];
    try {
      const answer = await notesApi.update(
        newer.id,
        { items: merged, baseUpdatedAt: newer.updatedAt },
        { timeoutMs: SAVE_TIMEOUT_MS },
      );
      remember(answer);
      return { note: answer };
    } catch (again) {
      // saved elsewhere once more, or the server is gone: the newest note shows without the pick, and says so
      return { note: conflictNote(again) ?? newer, failure: again };
    }
  };

  const linkErrorOf = (onto: { failure?: unknown }) =>
    onto.failure === undefined ? undefined : saveErrorText(onto.failure, t);

  return {
    state,
    error,
    /** The error is about the text itself (empty, too long): no "Thử lại". */
    invalid,
    /** The server's copy (null until a new note's first save). */
    note: current,
    /** The text the editor opens with (the note, or the newer text a closed editor of it is still sending). */
    opening: setup.opening,
    change,
    touch,
    flush,
    /**
     * Saves the note's Items (the note page's picker) after any text save on its way, from the version it answered;
     * null for a note not created yet (its create sends them). Saved elsewhere meanwhile (met by this save, or by the
     * text save before it), the pick goes onto that version (what was added or removed here) and the page shows it
     * (text not saved here stays as the copy), saying so when the pick could not be saved.
     */
    saveItems: (next: number[]): Promise<ApiNote | null> => {
      picks.current += 1;
      return enqueue(async () => {
        if (!note.current) return null;
        await afterHandOff();
        if (stopped.current) {
          // the text save before it met a version saved elsewhere: the page shows that version with this pick on it
          const from = note.current;
          const onto = await pickOnto(from, later(from, known.get(from.id)), next);
          heldConflict.current = { note: onto.note, linkError: linkErrorOf(onto) };
          return onto.note;
        }
        follow();
        const from = note.current;
        try {
          const answer = await notesApi.update(
            from.id,
            { items: next, baseUpdatedAt: from.updatedAt },
            { timeoutMs: SAVE_TIMEOUT_MS },
          );
          took(answer);
          return answer;
        } catch (err) {
          const newer = conflictNote(err);
          if (!newer) throw err;
          const onto = await pickOnto(from, newer, next);
          conflict(onto.note);
          if (heldConflict.current) heldConflict.current.linkError = linkErrorOf(onto);
          // nothing to show again (the newer version holds this text): the picker says the pick was not saved
          else if (onto.failure) throw onto.failure;
          return onto.note;
        }
      }).finally(() => {
        picks.current -= 1;
        const shown = heldConflict.current;
        if (picks.current > 0 || !shown) return;
        heldConflict.current = null;
        onConflictRef.current?.(shown.note, shown.linkError);
      });
    },
    /** A copy of unsaved text from an earlier visit, a conflict or another tab; restore or drop it. */
    recovered: shownCopy?.copy ?? null,
    /** How it is offered: unsaved text, or text written over a version the note has been saved after since. */
    recoveredOffer: shownCopy ? offerOf(shownCopy, current) : null,
    dropRecovered: () => {
      if (shownCopy) dropSame(shownCopy.key, freshCopy(shownCopy));
    },
    /** Takes the copy as the text (and saves it); the caller shows it in the fields. */
    takeRecovered: (): NoteText | null => {
      if (!shownCopy) return null;
      const copy = freshCopy(shownCopy);
      // a new note's copy keeps its create's id: if that create arrived, the server answers the same note
      if (!note.current && copy.clientId) clientId.current = copy.clientId;
      const text = { title: copy.title, markdown: copy.markdown };
      // this editor's own copy holds it first, then the restored copy goes
      change(text);
      dropSame(shownCopy.key, copy);
      return text;
    },
  };
}
