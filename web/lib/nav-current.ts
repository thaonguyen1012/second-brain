'use client';
import { useSyncExternalStore } from 'react';

/**
 * The sidebar row of a page filed under another row than its path says: a tool's full Item page lives at
 * /thu-vien/item/?id=N (note links use that path) but belongs to Công cụ, not Thư viện (owner 14/11/2026). The page
 * names its row here while it is shown and clears it when it goes; components/app-shell.tsx prefers it to the row its
 * path matches.
 */
let named: string | null = null;
const listeners = new Set<() => void>();

export function setNavCurrent(href: string | null): void {
  if (named === href) return;
  named = href;
  for (const listener of listeners) listener();
}

// The same functions on every render, so useSyncExternalStore never resubscribes (as lib/use-board-view.ts)
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => named;
const serverSnapshot = () => null;

export function useNavCurrent(): string | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
