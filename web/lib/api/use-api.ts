'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, type Page } from './client';

interface State<T> {
  /** `key#tick` of the last answer. */
  key: string | null;
  /** `key` (without the tick) that `data` belongs to. */
  base: string | null;
  data?: T;
  error?: ApiError;
}

export interface ApiResult<T> {
  data: T | undefined;
  error: ApiError | undefined;
  /** True until the answer for the current key arrives (data keeps the previous answer meanwhile). */
  loading: boolean;
  /**
   * The key `data` was loaded for. After a failed load under a new key `data` is cleared (never the old
   * filter's rows under the new filter); after a failed reload of the same key it is kept and `error` is set.
   */
  dataKey: string | null;
  reload: () => void;
  /** Local change after a write (optimistic update). */
  mutate: (fn: (data: T | undefined) => T | undefined) => void;
  /** Like mutate, but only while `data` still belongs to `dataKey` (for answers that arrive late). */
  mutateFor: (dataKey: string | null, fn: (data: T | undefined) => T | undefined) => void;
}

export function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, String(err), false);
}

/**
 * Loads `load()` in the browser whenever `key` changes (null = do not load) and when the tab becomes visible
 * again. Client side only, so pages using it never call Django during `next build`.
 */
export function useApi<T>(key: string | null, load: () => Promise<T>): ApiResult<T> {
  const [state, setState] = useState<State<T>>({ key: null, base: null });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const full = key === null ? null : `${key}#${tick}`;
  useEffect(() => {
    if (full === null) return;
    let alive = true;
    const base = full.slice(0, full.lastIndexOf('#'));
    loadRef.current().then(
      (data) => alive && setState({ key: full, base, data }),
      (err: unknown) =>
        alive &&
        setState((s) => ({
          key: full,
          base,
          // keep the shown rows only when they answer the same key (a failed reload, not a new filter)
          data: s.base === base ? s.data : undefined,
          error: toApiError(err),
        })),
    );
    return () => {
      alive = false;
    };
  }, [full]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const mutate = useCallback((fn: (data: T | undefined) => T | undefined) => {
    setState((s) => ({ ...s, data: fn(s.data) }));
  }, []);
  const mutateFor = useCallback((dataKey: string | null, fn: (data: T | undefined) => T | undefined) => {
    setState((s) => (s.base === dataKey ? { ...s, data: fn(s.data) } : s));
  }, []);

  const current = state.key === full;
  return {
    data: state.data,
    error: current ? state.error : undefined,
    loading: full !== null && !current,
    dataKey: state.base,
    reload,
    mutate,
    mutateFor,
  };
}

/**
 * "Tải thêm" for a cursor list loaded with useApi: fetches `next` and appends it. Dropped if the list's key
 * changed while the page was loading (another filter); rows already shown (inserted locally) are skipped.
 */
export async function appendNextPage<R extends { id: number }>(res: ApiResult<Page<R>>): Promise<void> {
  const next = res.data?.next;
  if (!next) return;
  const dataKey = res.dataKey;
  const page = await api.page<R>(next);
  res.mutateFor(dataKey, (d) => {
    if (!d || d.next !== next) return d; // already appended, or replaced by a reload
    const seen = new Set(d.results.map((r) => r.id));
    return { results: [...d.results, ...page.results.filter((r) => !seen.has(r.id))], next: page.next };
  });
}
