'use client';
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRoutePathname } from '@/lib/use-app-pathname';

/**
 * Deep links such as `/thu-vien/?item=12` (Cmd+K results): calls `open(id, params)` once for each numeric
 * `?<name>=` the URL gets, then removes `name` and `alsoRemove` from the URL (router.replace), so a reload or
 * closing the dialog does not open the row again and the same link works a second time.
 * Uses useSearchParams: the page must render the component inside a Suspense boundary.
 */
export function useOpenFromUrl(
  name: string,
  open: (id: number, params: URLSearchParams) => void,
  alsoRemove: readonly string[] = [],
): void {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = useRoutePathname();
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  const raw = params.get(name);
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const search = params.toString();
  const removeKey = alsoRemove.join(',');

  useEffect(() => {
    if (id === null) return;
    const current = new URLSearchParams(search);
    openRef.current(id, current);
    current.delete(name);
    for (const k of removeKey.split(',')) if (k) current.delete(k);
    const rest = current.toString();
    const path = pathname.endsWith('/') ? pathname : `${pathname}/`; // trailingSlash: true (next.config)
    router.replace(rest ? `${path}?${rest}` : path, { scroll: false });
  }, [id, search, name, removeKey, pathname, router]);
}
