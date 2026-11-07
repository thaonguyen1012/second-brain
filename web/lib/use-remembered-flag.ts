'use client';
import { useEffect, useSyncExternalStore } from 'react';

// A yes/no a page remembers between visits in this browser (localStorage), for the geometry of its loading skeleton
// (DESIGN.md D27): Thư viện remembers whether its rows had pictures. A per-viewer convenience only: blocked storage
// reads as no.

const listeners = new Map<string, Set<() => void>>();

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // nothing to keep then: the skeleton falls back to the plain geometry
  }
  for (const l of listeners.get(key) ?? []) l();
}

function subscribeTo(key: string) {
  return (onChange: () => void) => {
    const set = listeners.get(key) ?? new Set();
    listeners.set(key, set);
    set.add(onChange);
    return () => set.delete(onChange);
  };
}

const subscribers = new Map<string, (onChange: () => void) => () => boolean>();
const serverSnapshot = () => false;

/**
 * `current` when it is known (the data has loaded), else the value remembered from the last visit; a known value is
 * remembered for the next one.
 */
export function useRememberedFlag(key: string, current: boolean | null): boolean {
  let subscribe = subscribers.get(key);
  if (!subscribe) {
    subscribe = subscribeTo(key);
    subscribers.set(key, subscribe);
  }
  const remembered = useSyncExternalStore(subscribe, () => read(key), serverSnapshot);
  useEffect(() => {
    if (current !== null && current !== remembered) write(key, current);
  }, [key, current, remembered]);
  return current ?? remembered;
}
