'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ApiNote } from '@/lib/api/library';
import { notesApi } from '@/lib/api/library';
import { toApiError } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { MAX_MARKDOWN, changedFromTemplate, isBlankNote } from '@/lib/item-notes';
import { fieldErrors } from '@/lib/labels';
import { describeApiError } from '../api-state';

// Saving a note like AFFiNE (DECISIONS 9.8, PROMPT-item-notes step 4): no "Lưu" button. A change is saved after a
// short pause; leaving (closing the editor or the Sheet, another page, hiding or closing the tab) saves at once; a copy
// of what is typed stays in this browser until the server has it, so a failed save or a crash never loses text.
// - A new note is created by its first save that has something in it (an empty note or an untouched template is not
//   a note), with an id of this editor's own (`clientId`): a create sent twice (as the page closed, then again from a
//   restored copy) makes one note.
// - Every edit says which version it started from (`baseUpdatedAt`): a note saved since (another tab or device)
//   answers 409 and is never overwritten; the page then shows the newer note, and this text comes back as the copy
//   to restore ("Khôi phục") or drop.
// - Editors of one note on this page take turns: an editor closed while its save is on the way hands its text to the
//   next editor of that note, which waits for that save before sending its own.

export type SaveState = 'idle' | 'waiting' | 'saving' | 'saved' | 'error';

export interface NoteText {
  title: string;
  markdown: string;
}

/** A copy of unsaved text in this browser (localStorage). */
export interface NoteBackup extends NoteText {
  at: string;
  /** A new note's id of the editor that wrote it (its create may have arrived). */
  clientId?: string;
}

const DELAY_MS = 800;
const FIELD_NAMES: Record<string, Msg> = { title: msg('Tiêu đề'), markdown: msg('Nội dung'), items: msg('Item') };

const storageKey = (key: string) => `alex-brain:note-draft:${key}`;
/** A saved note's copy is keyed by its id, wherever it is edited (the Item page, the note page). */
export const noteKey = (id: number) => `note-${id}`;
/** Sent on this page when a copy is written or removed (the `storage` event only reaches other tabs). */
const COPY_EVENT = 'alex-brain:note-draft';

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(key));
  } catch {
    // blocked storage: there is simply no copy
    return null;
  }
}

function parseBackup(raw: string | null): NoteBackup | null {
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
      const clientId = 'clientId' in value && typeof value.clientId === 'string' ? value.clientId : undefined;
      return { title: value.title, markdown: value.markdown, at: value.at, ...(clientId && { clientId }) };
    }
  } catch {
    // a broken copy is no copy
  }
  return null;
}

const readBackup = (key: string) => parseBackup(readRaw(key));

function writeBackup(key: string, text: NoteText | null, clientId?: string, at?: string) {
  try {
    if (text)
      window.localStorage.setItem(
        storageKey(key),
        JSON.stringify({ title: text.title, markdown: text.markdown, at: at ?? new Date().toISOString(), clientId }),
      );
    else window.localStorage.removeItem(storageKey(key));
    window.dispatchEvent(new Event(COPY_EVENT));
  } catch {
    // a per-browser safety net only: the server save is the real one
  }
}

function subscribeCopies(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(COPY_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(COPY_EVENT, onChange);
  };
}

/** The same text as far as the server is concerned (it trims the title). */
const same = (a: NoteText, b: NoteText) => a.title.trim() === b.title.trim() && a.markdown === b.markdown;
const bodyOf = (text: NoteText) => ({ title: text.title.trim(), markdown: text.markdown });
const textOf = (note: ApiNote): NoteText => ({ title: note.title, markdown: note.markdown });

/**
 * Whether this browser keeps a copy of unsaved text under `key` (`noteKey(id)`, or a new note's key) that differs from
 * `text`, the note as the page shows it: the reading view says so, and the editor offers the copy back.
 */
export function useUnsavedCopy(key: string, text: NoteText | null): boolean {
  const raw = useSyncExternalStore(subscribeCopies, () => readRaw(key), () => null);
  const copy = parseBackup(raw);
  return copy !== null && !(text && same(copy, text));
}
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

// What the editors of this page know about each note (one owner, one page): the newest version the server sent, and
// the text an editor that is gone still has on its way.
const newest = new Map<number, ApiNote>();
const sending = new Map<number, { text: NoteText; done: Promise<boolean>; owner: object }>();
/** Editors whose last save failed: the page asks before the tab goes while one is left, even after they closed. */
const failing = new Set<object>();
let guarded = false;
function guardTab() {
  if (guarded || typeof window === 'undefined') return;
  guarded = true;
  window.addEventListener('beforeunload', (e) => {
    if (failing.size === 0) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

/** When a version was saved (dates, not strings: the server's offset changes with summer time). */
const savedAt = (n: ApiNote) => Date.parse(n.updatedAt);
const later = (a: ApiNote, b: ApiNote | undefined) => (b && savedAt(b) > savedAt(a) ? b : a);

/** Why a save failed, in words for the save status (not "could not load", the wording of a failed read). */
export function saveErrorText(err: unknown, t: T): string {
  const e = toApiError(err);
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
  /** The key of a new note's copy in this browser until it is created (`new-item-4`, `new`); then `note-<id>`. */
  draftKey: string;
  /** The server's note after each save (`created` on the first save of a new note). */
  onSaved: (note: ApiNote, created: boolean) => void;
  /**
   * Show `note` instead (remount the editor with it): it was saved elsewhere since this edit started (this text
   * stays as the copy, offered back), or, with nothing unsaved here, a newer version arrived (`fresh`).
   */
  onConflict?: (note: ApiNote) => void;
  /** The note as the page last fetched it: newer than what this editor knows and nothing unsaved here, it shows. */
  fresh?: ApiNote | null;
  /** The editor's markdown right now (null while unchanged): read before a save that cannot wait for `change`. */
  pull?: () => string | null;
}) {
  const t = useT();
  const [me] = useState(() => ({}));
  // The note as the server last sent it (newer than `initial` when another editor of it saved meanwhile)
  const [server] = useState<ApiNote | null>(() => (initial ? later(initial, newest.get(initial.id)) : null));
  const [start] = useState<NoteText>(() =>
    server ? textOf(server) : { title: initialTitle, markdown: template },
  );
  // What the editor opens with: the text an editor of this note that is gone still sends, else the note
  const [opening] = useState<NoteText>(() => (server && sending.get(server.id)?.text) || start);
  const note = useRef<ApiNote | null>(server);
  const saved = useRef<NoteText>(start);
  const latest = useRef<NoteText>(opening);
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
  const [current, setCurrent] = useState<ApiNote | null>(server);
  const [state, setState] = useState<SaveState>(same(opening, start) ? 'idle' : 'waiting');
  const [error, setError] = useState<string | null>(null);
  // A copy left in this browser by an earlier visit, a conflict or another tab, that differs from what opens: offered
  // back, and kept in this browser until it is restored or dropped (a save of this editor's text never removes it)
  const [found] = useState<{ key: string; copy: NoteBackup } | null>(() => {
    if (typeof window === 'undefined') return null;
    const key = initial ? noteKey(initial.id) : draftKey;
    const copy = readBackup(key);
    return copy && !same(copy, opening) ? { key, copy } : null;
  });
  const [recovered, setRecovered] = useState<NoteBackup | null>(found?.copy ?? null);
  const kept = useRef(found);
  // A new note's own id; a restored copy brings the id its create was sent with
  const [firstClientId] = useState(newId);
  const clientId = useRef(firstClientId);
  useEffect(() => {
    onSavedRef.current = onSaved;
    onConflictRef.current = onConflict;
    pullRef.current = pull;
    itemsRef.current = items;
  });

  const keyNow = useCallback(() => (note.current ? noteKey(note.current.id) : draftKey), [draftKey]);
  /** A copy of `text` (unsaved) in this browser; null: nothing unsaved here, a copy found on opening stays. */
  const backup = useCallback(
    (text: NoteText | null) => {
      const key = keyNow();
      const old = kept.current?.key === key ? kept.current.copy : null;
      if (!text && old) writeBackup(key, old, old.clientId, old.at);
      else writeBackup(key, text, note.current ? undefined : clientId.current);
    },
    [keyNow],
  );

  const show = useCallback(
    (next: SaveState, why: string | null = null) => {
      failed.current = next === 'error';
      if (failed.current) {
        failing.add(me);
        guardTab();
      } else failing.delete(me);
      if (!mounted.current) return;
      setState(next);
      setError(why);
    },
    [me],
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

  const enqueue = useCallback(<R,>(request: () => Promise<R>): Promise<R> => {
    const next = queue.current.then(request, request);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  /** The server's answer to a save of this editor: the version the next one starts from. */
  const took = useCallback((answer: ApiNote) => {
    note.current = answer;
    newest.set(answer.id, later(answer, newest.get(answer.id)));
    if (mounted.current) setCurrent(answer);
  }, []);

  /** Saved elsewhere since this edit started: this text stays as the copy, the page shows the newer note. */
  const conflict = useCallback(
    (newer: ApiNote) => {
      if (stopped.current) return;
      stopped.current = true;
      window.clearTimeout(timer.current);
      newest.set(newer.id, later(newer, newest.get(newer.id)));
      if (!same(latest.current, textOf(newer))) writeBackup(noteKey(newer.id), latest.current);
      show('error', t('Ghi chú vừa được lưu ở nơi khác.'));
      onConflictRef.current?.(newer);
    },
    [show, t],
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
          // an editor of this note that closed with text on its way goes first
          const id = note.current?.id;
          const before = id === undefined ? undefined : sending.get(id);
          if (before && before.owner !== me) {
            await before.done;
            const now = later(note.current!, newest.get(id!));
            note.current = now;
            // what that save left on the server is what this editor's text is compared with
            if (now !== server) saved.current = textOf(now);
          }
          const text = latest.current;
          if (same(text, saved.current)) {
            backup(null);
            show(note.current ? 'saved' : 'idle');
            return true;
          }
          const why = problem(text);
          if (why === '') {
            backup(null);
            show('idle');
            return true;
          }
          if (why) {
            show('error', why);
            return false;
          }
          show('saving');
          const created = !note.current;
          let answer: ApiNote;
          try {
            answer = await enqueue(async () => {
              const made = note.current
                ? await notesApi.update(
                    note.current.id,
                    { ...bodyOf(text), baseUpdatedAt: note.current.updatedAt },
                    { keepalive },
                  )
                : await notesApi.create(
                    { ...bodyOf(text), items: itemsRef.current?.() ?? [], clientId: clientId.current },
                    { keepalive },
                  );
              took(made);
              return made;
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
          // what the server has now (a create sent again answers the note as it was made)
          saved.current = textOf(answer);
          if (created) {
            // the draft copy now belongs to the note's id (unless another editor wrote its own copy meanwhile, or it
            // is the copy found on opening, which stays until restored or dropped)
            const copy = readBackup(draftKey);
            const old = kept.current?.key === draftKey ? kept.current.copy : null;
            if (old) writeBackup(draftKey, old, old.clientId, old.at);
            else if (!copy || !copy.clientId || copy.clientId === clientId.current) writeBackup(draftKey, null);
            if (!same(latest.current, saved.current)) backup(latest.current);
          }
          onSavedRef.current(answer, created);
        }
      };
      const done = loop().finally(() => {
        inFlight.current = null;
      });
      inFlight.current = done;
      return done;
    },
    [backup, conflict, draftKey, enqueue, me, problem, server, show, t, took],
  );

  /** Takes the editor's text as it is now (it reports changes 200 ms late); before a save that cannot wait. */
  const catchUp = useCallback(() => {
    const markdown = pullRef.current?.();
    if (markdown == null || markdown === latest.current.markdown) return;
    latest.current = { ...latest.current, markdown };
    backup(latest.current);
  }, [backup]);

  /** The editor's text changed: keep a copy here and save after a pause. */
  const change = useCallback(
    (text: NoteText) => {
      latest.current = text;
      window.clearTimeout(timer.current);
      if (same(text, saved.current)) {
        backup(null);
        if (!inFlight.current) show(note.current ? 'saved' : 'idle');
        return;
      }
      backup(text);
      show('waiting');
      timer.current = window.setTimeout(() => void run(), DELAY_MS);
    },
    [backup, run, show],
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
    if (inFlight.current || !same(latest.current, saved.current)) return;
    newest.set(fresh.id, later(fresh, newest.get(fresh.id)));
    onConflictRef.current?.(fresh);
    // `fresh` is read through its date: a new object of the same version changes nothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshAt]);

  // Mounted: a copy that only repeats what opens is dropped; text handed over by a closed editor is saved.
  useEffect(() => {
    const key = initial ? noteKey(initial.id) : draftKey;
    const copy = readBackup(key);
    if (copy && same(copy, opening)) writeBackup(key, null);
    if (!same(opening, start)) timer.current = window.setTimeout(() => void run(), DELAY_MS);
    // once, for the text the page opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unmounting (the editor or the Sheet closed, a client-side navigation): save what is left; the request finishes
  // on its own and still reports through onSaved. The next editor of this note on this page waits for it.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      catchUp();
      if (stopped.current || same(latest.current, saved.current)) {
        // after a conflict the text is the copy the next editor offers: nothing to send, nothing to ask about
        failing.delete(me);
        return;
      }
      const done = run(true);
      const id = note.current?.id;
      if (id === undefined) return;
      const entry = { text: latest.current, done, owner: me };
      sending.set(id, entry);
      void done.finally(() => {
        if (sending.get(id) === entry) sending.delete(id);
      });
    };
  }, [catchUp, me, run]);

  return {
    state,
    error,
    /** The server's copy (null until a new note's first save). */
    note: current,
    /** The text the editor opens with (the note, or the newer text a closed editor of it is still sending). */
    opening,
    change,
    touch,
    flush,
    /**
     * Saves the note's Items (the note page's picker) after any text save on its way, from the version it answered;
     * null for a note not created yet (its create sends them) or after a conflict (the page shows the newer note).
     */
    saveItems: (next: number[]): Promise<ApiNote | null> =>
      enqueue(async () => {
        if (!note.current || stopped.current) return null;
        try {
          const answer = await notesApi.update(note.current.id, { items: next, baseUpdatedAt: note.current.updatedAt });
          took(answer);
          return answer;
        } catch (err) {
          const newer = conflictNote(err);
          if (!newer) throw err;
          conflict(newer);
          return null;
        }
      }),
    /** A copy of unsaved text from an earlier visit, a conflict or another tab; restore or drop it. */
    recovered,
    dropRecovered: () => {
      kept.current = null;
      writeBackup(initial ? noteKey(initial.id) : draftKey, null);
      setRecovered(null);
    },
    /** Takes the copy as the text (and saves it); the caller shows it in the fields. */
    takeRecovered: (): NoteText | null => {
      const copy = recovered;
      setRecovered(null);
      kept.current = null;
      if (!copy) return null;
      // a new note's copy keeps its create's id: if that create arrived, the server answers the same note
      if (!note.current && copy.clientId) clientId.current = copy.clientId;
      const text = { title: copy.title, markdown: copy.markdown };
      change(text);
      return text;
    },
  };
}
