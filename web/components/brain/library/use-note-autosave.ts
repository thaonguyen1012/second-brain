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
  noteKey,
  offeredCopies,
  parseCopy,
  readSlots,
  sameText as same,
  serializeCopy,
  slotName,
  type NoteCopy,
  type NoteText,
  type Slot,
} from '@/lib/note-copies';
import { describeApiError } from '../api-state';

// Saving a note like AFFiNE (DECISIONS 9.8, PROMPT-item-notes step 4): no "Lưu" button. A change is saved after a
// short pause; leaving (closing the editor or the Sheet, another page, hiding or closing the tab) saves at once.
// - Each editor keeps its own copy of what the server lacks in this browser (lib/note-copies.ts) and removes it once
//   the server has it; it never writes over or removes another's. A copy whose writer is gone (a closed or crashed
//   page, a failed save, a conflict) is offered back ("Khôi phục") until it is restored or dropped.
// - A new note is created by its first save that has something in it (an empty note or an untouched template is not
//   a note), with an id of this editor's own (`clientId`): a create sent twice makes one note, and a copy left by a
//   page that closed while creating is first asked about (`?clientId=`): if its create arrived, it is that note's.
// - Every edit says which version it started from (`baseUpdatedAt`): a note saved since (another tab or device)
//   answers 409 and is never overwritten; the page shows the newer note, and this text comes back as the copy.
// - The editors of one note on this page form one line of saves: an editor closed while its save is on the way hands
//   its text, and the version that text was written on, to the next editor of the note, which waits for that save and
//   then goes on from what this page's own saves left on the server (never from a version only seen in a 409).

export type SaveState = 'idle' | 'waiting' | 'saving' | 'saved' | 'error';
export type { NoteText };
export { noteKey };

/** A copy offered back: its text and when it was written. */
export type NoteBackup = NoteCopy;

const DELAY_MS = 800;
/** A save with no answer by then fails like an unreachable server (reason and "Thử lại"), never "Đang lưu…" forever. */
const SAVE_TIMEOUT_MS = 15_000;
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
    // blocked storage: there are simply no copies
    return null;
  }
}

function notify() {
  window.dispatchEvent(new Event(COPY_EVENT));
}

function writeSlot(name: string, copy: NoteCopy | null) {
  try {
    const s = storage();
    if (copy) s?.setItem(name, serializeCopy(copy));
    else s?.removeItem(name);
  } catch {
    // a per-browser safety net only: the server save is the real one
  }
  notify();
}

const slotsUnder = (key: string): Slot[] => {
  const s = storage();
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
  const s = storage();
  if (!s) return '';
  const parts: string[] = [];
  for (const slot of readSlots(s, match))
    parts.push(slot.name, serializeCopy(slot.copy), isLive(slot) ? 'live' : '', ready(slot) ? 'ready' : '');
  return parts.join('\u0000');
}

// The editors of this page that are open or still sending what they had when they closed: their copies are theirs,
// not copies to offer back. Every other copy's writer is gone (or is another tab, whose copy is offered too).
const live = new Set<string>();
const isLive = (slot: Slot) => slot.copy.tab === TAB && live.has(slot.owner);

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

// A new note's copy left by a page that closed while creating it: asked about once (`?clientId=`) before it is
// offered. If its create arrived, the copy becomes that note's (or goes, when the note already has its text).
const asked = new Map<string, 'asking' | 'absent' | 'failed'>();
/** An unanswered question is asked again on a later look, not on every keystroke meanwhile. */
const askAgainAt = new Map<string, number>();
function settle(slot: Slot) {
  const id = slot.copy.clientId;
  const state = id ? asked.get(id) : undefined;
  if (!id || state === 'asking' || state === 'absent') return;
  if (state === 'failed' && Date.now() < (askAgainAt.get(id) ?? 0)) return;
  asked.set(id, 'asking');
  notesApi
    .list({ clientId: id, limit: 1 })
    .then(
      (page) => {
        const made = page.results[0];
        if (!made) {
          asked.set(id, 'absent');
          return;
        }
        asked.delete(id);
        remember(made);
        const now = parseCopy(storage()?.getItem(slot.name) ?? null);
        if (!now) return;
        writeSlot(slot.name, null);
        if (!same(now, textOf(made)) && !isBlankNote(now.markdown))
          writeSlot(slotName(noteKey(made.id), slot.owner || newId()), {
            ...now,
            clientId: undefined,
          });
      },
      // unreachable: offered as a new note's copy (restored, its create sent again answers the note if it was made)
      () => {
        asked.set(id, 'failed');
        askAgainAt.set(id, Date.now() + 30_000);
      },
    )
    .finally(notify);
}
const ready = (slot: Slot) => {
  const id = slot.copy.clientId;
  return !id || asked.get(id) === 'absent' || asked.get(id) === 'failed';
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
    const s = snap ? storage() : null;
    return s ? readSlots(s, match) : [];
  }, [snap, match]);
  useEffect(() => {
    for (const slot of slots) if (isNewNoteKey(slot.key) && !isLive(slot) && slot.copy.clientId) settle(slot);
  }, [slots]);
  return offeredCopies(slots, { live: isLive, server, opening, ready });
}

/**
 * Whether this browser keeps a copy of unsaved text under `key` (`noteKey(id)`, or a new note's key) that differs from
 * `text`, the note as the page shows it: the reading view says so, and the editor offers the copy back.
 */
export function useUnsavedCopy(key: string, text: NoteText | null): boolean {
  const match = useCallback((k: string) => k === key, [key]);
  return useOffered(match, text, null).length > 0;
}

/** The new notes whose unsaved text this browser keeps (`new`, `new-item-<id>`), newest first: the notes list. */
export function useNewNoteCopies(): string[] {
  const slots = useOffered(isNewNoteKey, null, null);
  return [...new Set(slots.map((s) => s.key))];
}

/** The page asks before the tab goes while a copy whose save failed is still there (it is not on the server). */
const failing = new Set<string>();
let guarded = false;
function guardTab() {
  if (guarded || typeof window === 'undefined') return;
  guarded = true;
  window.addEventListener('beforeunload', (e) => {
    const s = storage();
    for (const name of failing) if (s?.getItem(name) == null) failing.delete(name);
    if (failing.size === 0) return;
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
   * as the copy, offered back), or, with nothing unsaved here, a newer version arrived (`fresh`).
   */
  onConflict?: (note: ApiNote) => void;
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
        if (storage()?.getItem(name) != null) writeSlot(name, null);
        return;
      }
      writeSlot(name, {
        title: text.title,
        markdown: text.markdown,
        at: new Date().toISOString(),
        tab: TAB,
        ...(!note.current && { clientId: clientId.current }),
      });
    },
    [ownName],
  );

  const show = useCallback(
    (next: SaveState, why: string | null = null, kind: 'failed' | 'invalid' = 'failed') => {
      failed.current = next === 'error';
      if (failed.current) {
        failing.add(ownName());
        guardTab();
      }
      if (!mounted.current) return;
      setState(next);
      setError(why);
      setInvalid(next === 'error' && kind === 'invalid');
    },
    [ownName],
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
    remember(answer);
    const line = lineages.get(answer.id);
    if (line) line.base = later(answer, line.base);
    else lineages.set(answer.id, { base: answer });
    if (mounted.current) setCurrent(answer);
  }, []);

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
   * page's own save (sent again as the page was hidden): it simply goes on from it.
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
      if (mounted.current) onConflictRef.current?.(newer);
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
        for (;;) {
          // a closed editor of this note with text on its way goes first; then this one goes on from what it left
          const id = note.current?.id;
          const before = id === undefined ? undefined : lineages.get(id)?.pending;
          if (before && before.owner !== owner) await before.done;
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
          const init = keepalive ? { keepalive } : { timeoutMs: SAVE_TIMEOUT_MS };
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
            const newer = conflictNote(err);
            if (newer) {
              conflict(newer);
              return false;
            }
            show('error', saveErrorText(err, t));
            return false;
          }
          if (creating) {
            // the note has its id: this editor's copy and saves belong to it from now on
            writeSlot(slotName(draftKey, owner), null);
            took(answer);
            if (!made && answer.updatedAt !== answer.createdAt && !same(textOf(answer), text)) {
              // an earlier create with this id made the note, and it was edited since (elsewhere): it shows as it is
              // now, this text stays as the copy to restore
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
    [conflict, draftKey, enqueue, follow, keep, owner, problem, show, t, took],
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
   * Something was typed (its markdown follows through `change`): "Đang lưu…" at once, not 200 ms later. Should no
   * markdown follow (the text came back to what is saved), the save after the pause finds that out and says so.
   */
  const touch = useCallback(() => {
    if (stopped.current) return;
    if (!failed.current) show('waiting');
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
    live.add(owner);
    notify();
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      last.current.catchUp();
      const text = latest.current;
      const emptied = note.current !== null && isBlankNote(text.markdown);
      if (stopped.current || emptied || same(text, saved.current)) {
        // after a conflict the text is the copy the next opening offers; an emptied note keeps what the server has
        // (deleting a note is its own action)
        live.delete(owner);
        notify();
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
        live.delete(owner);
        const line = entry ? lineages.get(entry.base.id) : undefined;
        if (line && line.pending === entry) delete line.pending;
        notify();
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
        if (storage()?.getItem(theirs) != null) writeSlot(theirs, null);
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
  const freshCopy = (slot: Slot): NoteCopy => parseCopy(storage()?.getItem(slot.name) ?? null) ?? slot.copy;
  /** Drops `copy` and every other copy of the same text under its key, except this editor's own and live ones. */
  const dropSame = (key: string, copy: NoteText) => {
    for (const s of slotsUnder(key)) if (s.owner !== owner && !isLive(s) && same(s.copy, copy)) writeSlot(s.name, null);
  };

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
     * null for a note not created yet (its create sends them). Saved elsewhere meanwhile, the pick goes onto that
     * version (what was added or removed here) and the page shows it (text not saved here stays as the copy).
     */
    saveItems: (next: number[]): Promise<ApiNote | null> =>
      enqueue(async () => {
        if (!note.current || stopped.current) return null;
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
          const added = next.filter((i) => !from.items.includes(i));
          const removed = from.items.filter((i) => !next.includes(i));
          const merged = [
            ...newer.items.filter((i) => !removed.includes(i)),
            ...added.filter((i) => !newer.items.includes(i)),
          ];
          let shown = newer;
          try {
            shown = await notesApi.update(
              newer.id,
              { items: merged, baseUpdatedAt: newer.updatedAt },
              { timeoutMs: SAVE_TIMEOUT_MS },
            );
          } catch (again) {
            // saved elsewhere once more, or the server is gone: the newest note shows without the pick
            shown = conflictNote(again) ?? newer;
          }
          conflict(shown);
          return shown;
        }
      }),
    /** A copy of unsaved text from an earlier visit, a conflict or another tab; restore or drop it. */
    recovered: shownCopy?.copy ?? null,
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
