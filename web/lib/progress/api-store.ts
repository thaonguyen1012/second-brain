import { api, type ApiProgressSnapshot } from '@/lib/api/client';
import type { LastVisited, ProgressListener, ProgressSnapshot, ProgressStore } from './store';

const EMPTY: ProgressSnapshot = { done: {}, lastVisited: null };
const LAST_VISITED_DEBOUNCE_MS = 1500;

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
    } catch (err) {
      console.error('progress: load failed', err);
    }
    this.emit();
  }

  /** Reload from the server now (after the one-time move of the old localStorage progress, migration.ts). */
  refresh(): Promise<void> {
    return this.reload();
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
