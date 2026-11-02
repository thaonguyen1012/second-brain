// One-time move of the phase 1 localStorage progress ("old store") to the progress API (DECISIONS 9.4).
// Offered once by components/progress-migration.tsx when the API store is active; the local copy is kept,
// only a marker says it was moved (or that the owner declined).
import { ApiError, api, type ApiProgressSnapshot } from '@/lib/api/client';
import type { LastVisited, ProgressSnapshot } from './store';

/** Same key as LocalStorageProgressStore; read only here, never written. */
const LEGACY_KEY = 'alex-brain:progress:v1';
const MARKER_KEY = 'alex-brain:progress:api-migration';
const CONCURRENCY = 4;

export type MigrationMarker = { status: 'migrated' | 'dismissed'; at: string; moved?: number };

export const apiStoreActive = process.env.NEXT_PUBLIC_PROGRESS_STORE === 'api';

/** The old store's snapshot, or null when there is none (or storage is unavailable). */
export function readLegacyProgress(): ProgressSnapshot | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProgressSnapshot>;
    return { done: parsed.done ?? {}, lastVisited: parsed.lastVisited ?? null };
  } catch {
    return null;
  }
}

function readMarker(): MigrationMarker | null {
  try {
    const raw = window.localStorage.getItem(MARKER_KEY);
    return raw ? (JSON.parse(raw) as MigrationMarker) : null;
  } catch {
    return null;
  }
}

function writeMarker(marker: MigrationMarker) {
  try {
    window.localStorage.setItem(MARKER_KEY, JSON.stringify(marker));
  } catch {
    // storage unavailable: the offer may come back next time, moving again is idempotent
  }
}

/** Cheap synchronous check (no request): API store on, not moved or declined yet, old done pages present. */
export function shouldOfferMigration(): boolean {
  if (!apiStoreActive || typeof window === 'undefined' || readMarker()) return false;
  const legacy = readLegacyProgress();
  return !!legacy && Object.values(legacy.done).some((pages) => Object.keys(pages).length > 0);
}

/** The owner declined: never offer again in this browser. */
export function dismissMigration() {
  writeMarker({ status: 'dismissed', at: new Date().toISOString() });
}

/** Old done pages that the server does not have as done yet. */
export function pendingPages(legacy: ProgressSnapshot, server: ApiProgressSnapshot): [string, string][] {
  const out: [string, string][] = [];
  for (const [book, pages] of Object.entries(legacy.done))
    for (const [page, done] of Object.entries(pages))
      if (done === true && server.done[book]?.[page] !== true) out.push([book, page]);
  return out;
}

/** Nothing left to move (e.g. moved by the earlier automatic import): close the offer quietly. */
export function markNothingToMigrate() {
  writeMarker({ status: 'migrated', at: new Date().toISOString(), moved: 0 });
}

export interface MigrationResult {
  moved: number;
  /** Pages of books the server does not know any more (400): skipped for good. */
  skipped: number;
  /** First error that stopped the move (network, 401, 5xx): the marker is not written, a retry continues. */
  error?: ApiError;
}

/**
 * PUTs every pending page as done (4 at a time), then copies the old "last visited" page when the server has
 * none. Writes the "migrated" marker only when nothing is left to retry.
 */
export async function migrateLegacyProgress(
  legacy: ProgressSnapshot,
  server: ApiProgressSnapshot,
  onProgress?: (handled: number, total: number) => void,
): Promise<MigrationResult> {
  const queue = pendingPages(legacy, server);
  const total = queue.length;
  const result: MigrationResult = { moved: 0, skipped: 0 };
  let next = 0;
  let handled = 0;

  async function worker() {
    while (!result.error && next < queue.length) {
      const [book, page] = queue[next++];
      try {
        await api.setPageDone(book, page, true);
        result.moved++;
      } catch (err) {
        if (err instanceof ApiError && err.reachable && err.status === 400) result.skipped++;
        else result.error ??= err instanceof ApiError ? err : new ApiError(0, String(err), false);
      }
      onProgress?.(++handled, total);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));

  if (!result.error) {
    const lv: LastVisited | null = legacy.lastVisited;
    if (lv && !server.lastVisited) {
      // display only: a failure here must not block the marker
      await api.setLastVisited(lv.bookSlug, lv.pageSlug, lv.title).catch(() => undefined);
    }
    writeMarker({ status: 'migrated', at: new Date().toISOString(), moved: result.moved });
  }
  return result;
}
