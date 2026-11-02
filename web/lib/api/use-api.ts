'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './client';

interface State<T> {
  key: string | null;
  data?: T;
  error?: ApiError;
}

export interface ApiResult<T> {
  data: T | undefined;
  error: ApiError | undefined;
  /** True until the answer for the current key arrives (data keeps the previous answer meanwhile). */
  loading: boolean;
  reload: () => void;
  /** Local change after a write (optimistic update). */
  mutate: (fn: (data: T | undefined) => T | undefined) => void;
}

export function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, String(err), false);
}

/**
 * Loads `load()` in the browser whenever `key` changes (null = do not load) and when the tab becomes visible
 * again. Client side only, so pages using it never call Django during `next build`.
 */
export function useApi<T>(key: string | null, load: () => Promise<T>): ApiResult<T> {
  const [state, setState] = useState<State<T>>({ key: null });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const full = key === null ? null : `${key}#${tick}`;
  useEffect(() => {
    if (full === null) return;
    let alive = true;
    loadRef.current().then(
      (data) => alive && setState({ key: full, data }),
      (err: unknown) => alive && setState((s) => ({ key: full, data: s.data, error: toApiError(err) })),
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

  const current = state.key === full;
  return {
    data: state.data,
    error: current ? state.error : undefined,
    loading: full !== null && !current,
    reload,
    mutate,
  };
}
