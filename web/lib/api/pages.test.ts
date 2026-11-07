import { describe, expect, it } from 'vitest';
import type { Page } from './client';
import { MAX_PAGES, loadAllPages } from './pages';

describe('loadAllPages', () => {
  const pages: Record<string, Page<{ id: number }>> = {
    '/p2': { results: [{ id: 3 }, { id: 2 }], next: '/p3' },
    '/p3': { results: [{ id: 2 }, { id: 1 }], next: null },
  };

  it('follows next until the end and skips rows already seen', async () => {
    const asked: string[] = [];
    const all = await loadAllPages(
      async () => ({ results: [{ id: 5 }, { id: 4 }], next: '/p2' }),
      async (next) => {
        asked.push(next);
        return pages[next];
      },
    );
    expect(all).toEqual({ results: [{ id: 5 }, { id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }], next: null });
    expect(asked).toEqual(['/p2', '/p3']);
  });

  it('stops at the cap and keeps next for "Tải thêm"', async () => {
    let n = 0;
    const all = await loadAllPages(
      async () => ({ results: [{ id: ++n }], next: '/more' }),
      async () => ({ results: [{ id: ++n }], next: '/more' }),
    );
    expect(all.results).toHaveLength(MAX_PAGES);
    expect(all.next).toBe('/more');
  });

  it('asks once for a single page', async () => {
    let calls = 0;
    const all = await loadAllPages(
      async () => ({ results: [{ id: 1 }], next: null }),
      async () => {
        calls++;
        return { results: [], next: null };
      },
    );
    expect(all).toEqual({ results: [{ id: 1 }], next: null });
    expect(calls).toBe(0);
  });
});
