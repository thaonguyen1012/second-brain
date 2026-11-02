'use client';
import { useCallback, useMemo } from 'react';
import type { ApiItem } from '@/lib/api/client';
import { loadAllItems } from '@/lib/api/library';
import { useApi } from '@/lib/api/use-api';

const NONE: ApiItem[] = [];

/** Every Item of the owner, loaded in the browser when `enabled`, with an id -> Item map for linked-item badges. */
export function useItemIndex(enabled = true) {
  const res = useApi<ApiItem[]>(enabled ? 'items:all' : null, loadAllItems);
  const items = res.data ?? NONE;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const { mutate } = res;
  /** Adds or replaces one Item after a local create or edit. */
  const put = useCallback(
    (item: ApiItem) => mutate((d) => [item, ...(d ?? []).filter((i) => i.id !== item.id)]),
    [mutate],
  );
  return { items, byId, put, error: res.error, loading: res.loading, reload: res.reload };
}
