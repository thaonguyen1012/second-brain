'use client';
import { api, type ApiOpportunity } from '@/lib/api/client';

// Open opportunities for "bằng chứng cho cơ hội…" pickers, loaded once per page view (decision=open, 200 max).
let cache: Promise<ApiOpportunity[]> | null = null;

export function loadOpenOpportunities(): Promise<ApiOpportunity[]> {
  cache ??= api.listOpportunities({ decision: 'open', limit: 200 }).then(
    (page) => page.results,
    (err: unknown) => {
      cache = null; // retry on the next open
      throw err;
    },
  );
  return cache;
}
