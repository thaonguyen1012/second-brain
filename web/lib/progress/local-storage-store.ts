import type { LastVisited, ProgressListener, ProgressSnapshot, ProgressStore } from './store';

const KEY = 'alex-brain:progress:v1';
const EMPTY: ProgressSnapshot = { done: {}, lastVisited: null };

/** localStorage implementation; every storage access is guarded (private mode, quota, SSR). */
export class LocalStorageProgressStore implements ProgressStore {
  private snapshot: ProgressSnapshot = EMPTY;
  private listeners = new Set<ProgressListener>();
  private loaded = false;

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ProgressSnapshot>;
        this.snapshot = { done: parsed.done ?? {}, lastVisited: parsed.lastVisited ?? null };
      }
    } catch {
      this.snapshot = EMPTY;
    }
    try {
      window.addEventListener('storage', (e) => {
        if (e.key !== KEY) return;
        this.loaded = false;
        this.load();
        this.emit();
      });
    } catch {
      // no window (server render)
    }
  }

  private save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.snapshot));
    } catch {
      // storage unavailable or full: keep the in-memory state
    }
    this.emit();
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
    this.save();
  }

  getLastVisited(): LastVisited | null {
    return this.getAll().lastVisited;
  }

  setLastVisited(bookSlug: string, pageSlug: string, title?: string) {
    const current = this.getAll();
    this.snapshot = { ...current, lastVisited: { bookSlug, pageSlug, title, at: new Date().toISOString() } };
    this.save();
  }

  subscribe(listener: ProgressListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
