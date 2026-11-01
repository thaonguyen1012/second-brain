import { api, type ApiProgressSnapshot } from '@/lib/api/client';
import type { LastVisited, ProgressListener, ProgressSnapshot, ProgressStore } from './store';
import { LocalStorageProgressStore } from './local-storage-store';

const EMPTY: ProgressSnapshot = { done: {}, lastVisited: null };
const LAST_VISITED_DEBOUNCE_MS = 1500;
const IMPORTED_KEY = 'alex-brain:progress:imported-to-api';

function fromApi(s: ApiProgressSnapshot): ProgressSnapshot {
  const done: ProgressSnapshot['done'] = {};
  for (const [book, pages] of Object.entries(s.done)) {
    done[book] = {};
    for (const [page, isDone] of Object.entries(pages)) if (isDone) done[book][page] = true;
  }
  return { done, lastVisited: s.lastVisited ?? null };
}

/** Django-backed store (API_CONTRACT.md): loaded once, then kept in memory with optimistic updates. */
export class ApiProgressStore implements ProgressStore {
  private snapshot: ProgressSnapshot = EMPTY;
  private listeners = new Set<ProgressListener>();
  private loading: Promise<void> | null = null;
  private lastVisitedTimer: ReturnType<typeof setTimeout> | null = null;

  private load() {
    this.loading ??= this.reload().then(() => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void this.reload();
      });
    });
  }

  private async reload() {
    try {
      this.snapshot = fromApi(await api.getProgress());
      await this.importFromThisBrowserOnce();
    } catch (err) {
      console.error('progress: load failed', err);
    }
    this.emit();
  }

  /** First run against an empty account: copy the phase 1 localStorage progress of this browser. */
  private async importFromThisBrowserOnce() {
    try {
      if (window.localStorage.getItem(IMPORTED_KEY)) return;
      const empty = Object.keys(this.snapshot.done).length === 0 && !this.snapshot.lastVisited;
      const local = new LocalStorageProgressStore().getAll();
      if (empty) {
        for (const [book, pages] of Object.entries(local.done))
          for (const page of Object.keys(pages)) await api.setPageDone(book, page, true);
        const lv = local.lastVisited;
        if (lv) await api.setLastVisited(lv.bookSlug, lv.pageSlug, lv.title);
        if (Object.keys(local.done).length || lv) this.snapshot = fromApi(await api.getProgress());
      }
      window.localStorage.setItem(IMPORTED_KEY, new Date().toISOString());
    } catch (err) {
      console.error('progress: import from this browser failed', err);
    }
  }

  private emit() {
    for (const l of this.listeners) l(this.snapshot);
  }

  getAll(): ProgressSnapshot {
    if (typeof window === 'undefined') return EMPTY;
    this.load();
    return this.snapshot;
  }

  isDone(bookSlug: string, pageSlug: string): boolean {
    return this.getAll().done[bookSlug]?.[pageSlug] === true;
  }

  setDone(bookSlug: string, pageSlug: string, done: boolean) {
    const current = this.getAll();
    const book = { ...(current.done[bookSlug] ?? {}) };
    if (done) book[pageSlug] = true;
    else delete book[pageSlug];
    this.snapshot = { ...current, done: { ...current.done, [bookSlug]: book } };
    this.emit();
    api.setPageDone(bookSlug, pageSlug, done).catch((err) => {
      console.error('progress: save failed', err);
      void this.reload(); // fall back to the server's truth
    });
  }

  getLastVisited(): LastVisited | null {
    return this.getAll().lastVisited;
  }

  setLastVisited(bookSlug: string, pageSlug: string, title?: string) {
    const current = this.getAll();
    this.snapshot = { ...current, lastVisited: { bookSlug, pageSlug, title, at: new Date().toISOString() } };
    this.emit();
    if (this.lastVisitedTimer) clearTimeout(this.lastVisitedTimer);
    this.lastVisitedTimer = setTimeout(() => {
      api.setLastVisited(bookSlug, pageSlug, title).catch((err) => console.error('progress: save failed', err));
    }, LAST_VISITED_DEBOUNCE_MS);
  }

  subscribe(listener: ProgressListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
