// Progress store abstraction. Phase 1: localStorage. Phase 2: an API-backed store talking to Django
// (see API_CONTRACT.md) implements the same interface; the UI only uses this interface.

/** Page identity: book slug + page path inside the book ('' for the book's index page). */
export interface LastVisited {
  bookSlug: string;
  pageSlug: string;
  /** Page title at visit time, for display only. */
  title?: string;
  /** ISO timestamp. */
  at: string;
}

export interface ProgressSnapshot {
  /** done[bookSlug][pageSlug] === true when the page is marked "Đã học xong". */
  done: Record<string, Record<string, true>>;
  lastVisited: LastVisited | null;
}

export type ProgressListener = (snapshot: ProgressSnapshot) => void;

export interface ProgressStore {
  getAll(): ProgressSnapshot;
  isDone(bookSlug: string, pageSlug: string): boolean;
  setDone(bookSlug: string, pageSlug: string, done: boolean): void;
  getLastVisited(): LastVisited | null;
  setLastVisited(bookSlug: string, pageSlug: string, title?: string): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: ProgressListener): () => void;
}
