'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** The two views of Dự án: the list (default, no parameter) and the board (`?view=board`). */
export type ProjectsView = 'list' | 'board';

const STORAGE_KEY = 'alex-brain:projects-view';
const listeners = new Set<() => void>();

/** The last view picked in this browser; null when none, on the server, or with blocked storage. */
function readStored(): ProjectsView | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'board' || v === 'list' ? v : null;
  } catch {
    return null;
  }
}

function writeStored(view: ProjectsView) {
  try {
    window.localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // a per-viewer convenience only: the URL still carries the view
  }
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

const serverSnapshot = () => null;

/**
 * The current view and its setter. The URL wins when it names a view; without one, the view last picked in this
 * browser (localStorage), else the list. A remembered board is written into the URL, so the address always says
 * what is on screen. Switching replaces the URL (no history entry, no scroll). Needs a Suspense boundary
 * (useSearchParams).
 */
export function useProjectsView(): [ProjectsView, (view: ProjectsView) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const stored = useSyncExternalStore(subscribe, readStored, serverSnapshot);
  const fromUrl = params.get('view');
  const view: ProjectsView = fromUrl === 'board' || fromUrl === 'list' ? fromUrl : (stored ?? 'list');

  const replace = useCallback(
    (next: ProjectsView) => {
      const q = new URLSearchParams(params.toString());
      if (next === 'board') q.set('view', 'board');
      else q.delete('view');
      const s = q.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (fromUrl === null && stored === 'board') replace('board');
  }, [fromUrl, stored, replace]);

  const setView = useCallback(
    (next: ProjectsView) => {
      writeStored(next);
      replace(next);
    },
    [replace],
  );
  return [view, setView];
}
