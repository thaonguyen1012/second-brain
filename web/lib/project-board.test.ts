import { describe, expect, it } from 'vitest';
import type { ApiItemStatus, Page } from '@/lib/api/client';
import {
  MAX_PAGES,
  PROJECT_DRAG_TYPE,
  applyMove,
  groupByStatus,
  isProjectDrag,
  loadAllPages,
  moveMessage,
  parseDragId,
  planMove,
  rankMove,
  rollbackMove,
  settleMove,
  unrankMove,
  type Ranks,
} from './project-board';

interface P {
  id: number;
  status: ApiItemStatus;
  title: string;
}

const p = (id: number, status: ApiItemStatus, title = `P${id}`): P => ({ id, status, title });

// newest first, like GET /api/projects
const list: P[] = [p(8, 'active'), p(7, 'planned'), p(6, 'done'), p(5, 'active'), p(4, 'dropped'), p(3, 'planned')];

const ids = (lanes: ReturnType<typeof groupByStatus<P>>) => lanes.map((l) => [l.status, l.records.map((r) => r.id)]);

describe('groupByStatus', () => {
  it('makes one lane per status in itemStatuses order, keeping list order inside a lane', () => {
    expect(ids(groupByStatus(list))).toEqual([
      ['planned', [7, 3]],
      ['active', [8, 5]],
      ['done', [6]],
      ['dropped', [4]],
    ]);
  });

  it('keeps empty lanes', () => {
    expect(ids(groupByStatus([p(1, 'done')]))).toEqual([
      ['planned', []],
      ['active', []],
      ['done', [1]],
      ['dropped', []],
    ]);
  });

  it('puts ranked cards on top of their lane, highest rank first', () => {
    const ranks: Ranks = new Map([
      [3, 1],
      [5, 2],
      [4, 3],
    ]);
    expect(ids(groupByStatus(list, ranks))).toEqual([
      ['planned', [3, 7]],
      ['active', [5, 8]],
      ['done', [6]],
      ['dropped', [4]],
    ]);
  });

  it('puts an unknown status into the first lane', () => {
    const odd = { id: 9, status: 'archived' as ApiItemStatus, title: 'x' };
    expect(groupByStatus([odd])[0].records).toEqual([odd]);
  });

  it('does not change the list', () => {
    const copy = structuredClone(list);
    groupByStatus(list, new Map([[3, 1]]));
    expect(list).toEqual(copy);
  });
});

describe('planMove', () => {
  it('records from, to and both ranks', () => {
    expect(planMove(list, new Map([[7, 4]]), 7, 'done', 5)).toEqual({
      id: 7,
      from: 'planned',
      to: 'done',
      rank: 5,
      rankBefore: 4,
    });
    expect(planMove(list, new Map(), 8, 'planned', 1)?.rankBefore).toBeUndefined();
  });

  it('is null for the same status or an unknown id', () => {
    expect(planMove(list, new Map(), 8, 'active', 1)).toBeNull();
    expect(planMove(list, new Map(), 99, 'done', 1)).toBeNull();
  });
});

describe('a move', () => {
  const move = planMove(list, new Map(), 7, 'done', 1)!;

  it('applies at once and lands on top of the new lane', () => {
    const moved = applyMove(list, move);
    const ranks = rankMove(new Map(), move);
    expect(moved.find((r) => r.id === 7)?.status).toBe('done');
    expect(ids(groupByStatus(moved, ranks))[2]).toEqual(['done', [7, 6]]);
    expect(moved.map((r) => r.id)).toEqual(list.map((r) => r.id)); // the List view keeps its order
    expect(list.find((r) => r.id === 7)?.status).toBe('planned'); // immutable
  });

  it('takes the server answer on success', () => {
    const saved = { ...p(7, 'done'), title: 'Renamed on the server' };
    const settled = settleMove(applyMove(list, move), saved);
    expect(settled.find((r) => r.id === 7)).toBe(saved);
    expect(settled).toHaveLength(list.length);
  });

  it('rolls back to the old status and the old place on failure', () => {
    const before = new Map([[3, 1]]);
    const m = planMove(list, before, 7, 'active', 2)!;
    const ranks = rankMove(before, m);
    const moved = applyMove(list, m);
    expect(ids(groupByStatus(moved, ranks))[1]).toEqual(['active', [7, 8, 5]]);

    const back = rollbackMove(moved, m);
    const backRanks = unrankMove(ranks, m);
    expect(back).toEqual(list);
    expect(backRanks).toEqual(before);
    expect(ids(groupByStatus(back, backRanks))[0]).toEqual(['planned', [3, 7]]);
  });

  it('restores an earlier rank when the card had been moved before', () => {
    const m = planMove(list, new Map([[7, 1]]), 7, 'done', 2)!;
    expect(unrankMove(rankMove(new Map([[7, 1]]), m), m)).toEqual(new Map([[7, 1]]));
  });

  it('does not undo something newer', () => {
    // a reload answered before the PATCH: the record already shows its old status
    const reloaded = list.map((r) => (r.id === 7 ? { ...r, title: 'fresh' } : r));
    expect(rollbackMove(reloaded, move)).toEqual(reloaded);
    // the card was moved again since: its rank belongs to the newer move
    const newer = new Map([[7, 5]]);
    expect(unrankMove(newer, move)).toBe(newer);
  });
});

describe('drag payload', () => {
  it('accepts only drags that carry a card', () => {
    expect(isProjectDrag([PROJECT_DRAG_TYPE])).toBe(true);
    expect(isProjectDrag(['text/plain', PROJECT_DRAG_TYPE])).toBe(true);
    expect(isProjectDrag(['Files'])).toBe(false);
    expect(isProjectDrag(['text/plain', 'text/uri-list'])).toBe(false);
    expect(isProjectDrag(null)).toBe(false);
  });

  it('parses only a positive integer id', () => {
    expect(parseDragId('42')).toBe(42);
    for (const bad of ['', '0', '-1', '1.5', '4e2', ' 4', 'abc', '99999999999999999', null, undefined])
      expect(parseDragId(bad)).toBeNull();
  });
});

describe('moveMessage', () => {
  it('names the project and the new status', () => {
    expect(moveMessage('Acme', 'Đang làm')).toBe('Đã chuyển “Acme” sang Đang làm');
  });
});

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
