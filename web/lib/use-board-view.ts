'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseView, resolveView, viewSearch, type BoardView } from './status-board';

interface ViewStore {
  subscribe: (onChange: () => void) => () => void;
  read: () => BoardView | null;
  write: (view: BoardView) => void;
}

// One store per key, made once: useSyncExternalStore needs the same subscribe function on every render.
const stores = new Map<string, ViewStore>();

function storeFor(key: string): ViewStore {
  const known = stores.get(key);
  if (known) return known;
  const listeners = new Set<() => void>();
  const store: ViewStore = {
    // The last view picked in this browser; null when none, on the server, or with blocked storage.
    read: () => {
      try {
        return parseView(window.localStorage.getItem(key));
      } catch {
        return null;
      }
    },
    write: (view) => {
      try {
        window.localStorage.setItem(key, view);
      } catch {
        // a per-viewer convenience only: the URL still carries the view
      }
      for (const l of listeners) l();
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) onChange();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
  stores.set(key, store);
  return store;
}

const serverSnapshot = () => null;

/**
 * The List/Board view of a page and its setter. The URL wins when it names a view; without one, the view last picked
 * in this browser (localStorage `viewKey`), else the list. A remembered board is written into the URL, so the address
 * always says what is on screen. Switching replaces the URL (no history entry, no scroll). Needs a Suspense boundary
 * (useSearchParams).
 *
 * `holdWhile` names a URL parameter that another hook of the page removes first (a deep link such as `?item=12`
 * handled by useOpenFromUrl): the remembered board waits until it is gone, so the two router.replace calls never
 * undo each other.
 */
export function useBoardView(viewKey: string, holdWhile?: string): [BoardView, (view: BoardView) => void] {
  const store = storeFor(viewKey);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const stored = useSyncExternalStore(store.subscribe, store.read, serverSnapshot);
  const fromUrl = params.get('view');
  const view = resolveView(fromUrl, stored);
  const search = params.toString();
  const held = holdWhile !== undefined && params.has(holdWhile);

  const replace = useCallback(
    (next: BoardView) => {
      const s = viewSearch(search, next);
      const path = pathname.endsWith('/') ? pathname : `${pathname}/`; // trailingSlash: true (next.config)
      router.replace(s ? `${path}?${s}` : path, { scroll: false });
    },
    [search, pathname, router],
  );

  useEffect(() => {
    if (!held && parseView(fromUrl) === null && stored === 'board') replace('board');
  }, [held, fromUrl, stored, replace]);

  const setView = useCallback(
    (next: BoardView) => {
      store.write(next);
      replace(next);
    },
    [store, replace],
  );
  return [view, setView];
}
