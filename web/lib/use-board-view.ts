'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRoutePathname } from '@/lib/use-app-pathname';
import { parseView, resolveView, viewSearch, type BoardView } from './status-board';

interface ViewStore {
  subscribe: (onChange: () => void) => () => void;
  read: () => string | null;
  write: (view: string) => void;
}

// One store per key, made once: useSyncExternalStore needs the same subscribe function on every render.
const stores = new Map<string, ViewStore>();

function storeFor(key: string, alt: string): ViewStore {
  const known = stores.get(key);
  if (known) return known;
  const listeners = new Set<() => void>();
  const store: ViewStore = {
    // The last view picked in this browser; null when none, on the server, or with blocked storage.
    read: () => {
      try {
        return parseView(window.localStorage.getItem(key), alt);
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
 * The view of a page with a list and one other view (`alt`: "board" on Dự án and Thư viện, "items" for "Theo item" on
 * Ghi chú) and its setter; the rules of useBoardView below.
 */
export function useListView<A extends string>(
  viewKey: string,
  alt: A,
  holdWhile?: string,
): ['list' | A, (view: 'list' | A) => void] {
  const store = storeFor(viewKey, alt);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = useRoutePathname();
  const stored = useSyncExternalStore(store.subscribe, store.read, serverSnapshot);
  const fromUrl = params.get('view');
  const view = resolveView(fromUrl, stored, alt);
  const search = params.toString();
  const held = holdWhile !== undefined && params.has(holdWhile);

  const replace = useCallback(
    (next: 'list' | A) => {
      const s = viewSearch(search, next, alt);
      const path = pathname.endsWith('/') ? pathname : `${pathname}/`; // trailingSlash: true (next.config)
      router.replace(s ? `${path}?${s}` : path, { scroll: false });
    },
    [search, pathname, router, alt],
  );

  useEffect(() => {
    if (!held && parseView(fromUrl, alt) === null && stored === alt) replace(alt);
  }, [held, fromUrl, stored, replace, alt]);

  const setView = useCallback(
    (next: 'list' | A) => {
      store.write(next);
      replace(next);
    },
    [store, replace],
  );
  return [view, setView];
}

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
  return useListView(viewKey, 'board', holdWhile);
}
