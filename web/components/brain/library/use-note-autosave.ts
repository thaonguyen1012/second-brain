'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiNote } from '@/lib/api/library';
import { notesApi } from '@/lib/api/library';
import { toApiError } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { MAX_MARKDOWN, changedFromTemplate, isBlankNote } from '@/lib/item-notes';
import { fieldErrors } from '@/lib/labels';
import { describeApiError } from '../api-state';

// Saving a note like AFFiNE (DECISIONS 9.8, PROMPT-item-notes step 4): no "Lưu" button. A change is saved after a
// short pause; leaving (closing the editor or the Sheet, another page, hiding or closing the tab) saves at once; a copy
// of what is typed stays in this browser until the server has it, so a failed save or a crash never loses text. A new
// note is created by its first save that has something in it (an empty note or an untouched template is not a note).

export type SaveState = 'idle' | 'waiting' | 'saving' | 'saved' | 'error';

export interface NoteText {
  title: string;
  markdown: string;
}

/** A copy of unsaved text in this browser (localStorage). */
export interface NoteBackup extends NoteText {
  at: string;
}

const DELAY_MS = 800;
const FIELD_NAMES: Record<string, Msg> = { title: msg('Tiêu đề'), markdown: msg('Nội dung'), items: msg('Item') };

const storageKey = (key: string) => `alex-brain:note-draft:${key}`;
/** A saved note's copy is keyed by its id, wherever it is edited (the Item page, the note page). */
const noteKey = (id: number) => `note-${id}`;

function readBackup(key: string): NoteBackup | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
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
    )
      return { title: value.title, markdown: value.markdown, at: value.at };
  } catch {
    // blocked or broken storage: there is simply no copy
  }
  return null;
}

function writeBackup(key: string, text: NoteText | null) {
  try {
    if (text) window.localStorage.setItem(storageKey(key), JSON.stringify({ ...text, at: new Date().toISOString() }));
    else window.localStorage.removeItem(storageKey(key));
  } catch {
    // a per-browser safety net only: the server save is the real one
  }
}

const same = (a: NoteText, b: NoteText) => a.title === b.title && a.markdown === b.markdown;
const bodyOf = (text: NoteText) => ({ title: text.title.trim(), markdown: text.markdown });

export function useNoteAutosave({
  note: initial,
  items,
  template = '',
  draftKey,
  onSaved,
  pull,
}: {
  /** The note being edited; null for a new note, created by its first save. */
  note: ApiNote | null;
  /** A new note's links to Items when it is created (the Item page: that Item; the note page: what was picked). */
  items?: () => number[];
  /** What a new note starts from: left untouched, nothing is created. */
  template?: string;
  /** The key of a new note's copy in this browser until it is created (`new-item-4`, `new`); then `note-<id>`. */
  draftKey: string;
  /** The server's note after each save (`created` on the first save of a new note). */
  onSaved: (note: ApiNote, created: boolean) => void;
  /** The editor's markdown right now (null while unchanged): read before a save that cannot wait for `change`. */
  pull?: () => string | null;
}) {
  const t = useT();
  const [start] = useState<NoteText>(() => ({ title: initial?.title ?? '', markdown: initial?.markdown ?? template }));
  const note = useRef<ApiNote | null>(initial);
  const saved = useRef<NoteText>(start);
  const latest = useRef<NoteText>(start);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(false);
  const failed = useRef(false);
  const onSavedRef = useRef(onSaved);
  const pullRef = useRef(pull);
  const itemsRef = useRef(items);
  const [current, setCurrent] = useState<ApiNote | null>(initial);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  // A copy left in this browser by an earlier visit that the server never got (read once, on mount)
  const [recovered, setRecovered] = useState<NoteBackup | null>(() => {
    if (typeof window === 'undefined') return null;
    const copy = readBackup(initial ? noteKey(initial.id) : draftKey);
    return copy && !same(copy, start) ? copy : null;
  });
  useEffect(() => {
    onSavedRef.current = onSaved;
    pullRef.current = pull;
    itemsRef.current = items;
  });
  // A copy that only repeats the server's text (a save that left with the page did arrive) is dropped
  useEffect(() => {
    const key = initial ? noteKey(initial.id) : draftKey;
    const copy = readBackup(key);
    if (copy && same(copy, start)) writeBackup(key, null);
    // once, for the text the page opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keyNow = useCallback(() => (note.current ? noteKey(note.current.id) : draftKey), [draftKey]);

  const show = useCallback((next: SaveState, why: string | null = null) => {
    failed.current = next === 'error';
    if (!mounted.current) return;
    setState(next);
    setError(why);
  }, []);

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

  /**
   * Saves the latest text now; resolves true when nothing typed is left unsaved. One request at a time: a call while
   * one runs joins it, and text typed meanwhile is sent right after it.
   */
  const run = useCallback(
    (keepalive = false): Promise<boolean> => {
      if (inFlight.current) return inFlight.current;
      const loop = async (): Promise<boolean> => {
        for (;;) {
          const text = latest.current;
          if (same(text, saved.current)) {
            writeBackup(keyNow(), null);
            show(note.current ? 'saved' : 'idle');
            return true;
          }
          const why = problem(text);
          if (why === '') {
            writeBackup(keyNow(), null);
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
            answer = note.current
              ? await notesApi.update(note.current.id, bodyOf(text), { keepalive })
              : await notesApi.create({ ...bodyOf(text), items: itemsRef.current?.() ?? [] }, { keepalive });
          } catch (err) {
            const e = toApiError(err);
            show('error', (e.status === 400 && fieldErrors(e.body, t, FIELD_NAMES)) || describeApiError(e, t).title);
            return false;
          }
          note.current = answer;
          saved.current = text;
          if (mounted.current) setCurrent(answer);
          if (created) {
            // the copy now belongs to the note's id
            writeBackup(draftKey, null);
            if (!same(latest.current, text)) writeBackup(keyNow(), latest.current);
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
    [draftKey, keyNow, problem, show, t],
  );

  /** Takes the editor's text as it is now (it reports changes 200 ms late); before a save that cannot wait. */
  const catchUp = useCallback(() => {
    const markdown = pullRef.current?.();
    if (markdown == null || markdown === latest.current.markdown) return;
    latest.current = { ...latest.current, markdown };
    writeBackup(keyNow(), latest.current);
  }, [keyNow]);

  /** The editor's text changed: keep a copy here and save after a pause. */
  const change = useCallback(
    (text: NoteText) => {
      latest.current = text;
      window.clearTimeout(timer.current);
      if (same(text, saved.current)) {
        writeBackup(keyNow(), null);
        if (!inFlight.current) show(note.current ? 'saved' : 'idle');
        return;
      }
      writeBackup(keyNow(), text);
      show('waiting');
      timer.current = window.setTimeout(() => void run(), DELAY_MS);
    },
    [keyNow, run, show],
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

  /** Something was typed (the markdown follows): "Đang lưu…" at once, not 200 ms later. */
  const touch = useCallback(() => {
    if (!failed.current) show('waiting');
  }, [show]);

  /**
   * The page may go away (hidden, closed, another page): send what is left with keepalive, so the request outlives
   * the page. A request already running may die with the page: an edit is sent once more beside it (the same text,
   * so the order does not matter); a new note waits for its create (a second one would make two notes) and keeps
   * its copy in this browser.
   */
  const leave = useCallback(() => {
    window.clearTimeout(timer.current);
    catchUp();
    const text = latest.current;
    if (same(text, saved.current)) return;
    if (inFlight.current && note.current && problem(text) === null) {
      void notesApi.update(note.current.id, bodyOf(text), { keepalive: true }).catch(() => undefined);
      return;
    }
    void run(true);
  }, [catchUp, problem, run]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') leave();
    };
    // Only a failed save makes the browser ask before the tab goes: the text is then only here (and in the copy)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!failed.current || same(latest.current, saved.current)) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [leave]);

  // Unmounting (the editor or the Sheet closed, a client-side navigation): save what is left; the request finishes
  // on its own and still reports through onSaved.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(timer.current);
      catchUp();
      if (!same(latest.current, saved.current)) void run(true);
    };
  }, [catchUp, run]);

  return {
    state,
    error,
    /** The server's copy (null until a new note's first save). */
    note: current,
    change,
    touch,
    flush,
    /** A copy of unsaved text from an earlier visit that differs from the server's; restore or drop it. */
    recovered,
    dropRecovered: () => {
      writeBackup(keyNow(), null);
      setRecovered(null);
    },
    /** Takes the copy as the text (and saves it); the caller shows it in the fields. */
    takeRecovered: (): NoteText | null => {
      const copy = recovered;
      setRecovered(null);
      if (!copy) return null;
      const text = { title: copy.title, markdown: copy.markdown };
      change(text);
      return text;
    },
  };
}
