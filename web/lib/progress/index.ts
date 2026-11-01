'use client';
import { useSyncExternalStore } from 'react';
import type { ProgressSnapshot, ProgressStore } from './store';
import { LocalStorageProgressStore } from './local-storage-store';
import { ApiProgressStore } from './api-store';

export type { LastVisited, ProgressSnapshot, ProgressStore } from './store';

let store: ProgressStore | null = null;

/** The single place that picks the implementation: NEXT_PUBLIC_PROGRESS_STORE=api uses Django (build time). */
export function getProgressStore(): ProgressStore {
  store ??= process.env.NEXT_PUBLIC_PROGRESS_STORE === 'api' ? new ApiProgressStore() : new LocalStorageProgressStore();
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
