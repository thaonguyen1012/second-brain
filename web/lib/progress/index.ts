'use client';
import { useSyncExternalStore } from 'react';
import type { ProgressSnapshot, ProgressStore } from './store';
import { LocalStorageProgressStore } from './local-storage-store';

export type { LastVisited, ProgressSnapshot, ProgressStore } from './store';

let store: ProgressStore | null = null;

/** The single place that picks the implementation (phase 2: return an API-backed store here). */
export function getProgressStore(): ProgressStore {
  store ??= new LocalStorageProgressStore();
  return store;
}

const EMPTY: ProgressSnapshot = { done: {}, lastVisited: null };

/** Current progress snapshot; re-renders on every change (also from other tabs). */
export function useProgress(): ProgressSnapshot {
  const s = getProgressStore();
  return useSyncExternalStore(
    (cb) => s.subscribe(cb),
    () => s.getAll(),
    () => EMPTY,
  );
}

/** "/docs/<track>/<book>/<rest>/" -> { bookSlug, pageSlug } */
export function pageIdentity(url: string): { bookSlug: string; pageSlug: string } {
  const parts = url.replace(/^\/docs\//, '').split('/').filter(Boolean);
  return { bookSlug: parts[1] ?? '', pageSlug: parts.slice(2).join('/') };
}
