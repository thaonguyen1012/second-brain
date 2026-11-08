import { describe, expect, it } from 'vitest';
import type { ApiItemStatus } from '@/lib/api/client';
import {
  ITEM_BOARD,
  PROJECT_BOARD,
  applyMove,
  groupByStatus,
  isBoardDrag,
  laneOf,
  moveFailureReason,
  moveMessage,
  parseDragId,
  parseView,
  planMove,
  rankMove,
  resolveView,
  rollbackMove,
  settleMove,
  unrankMove,
  viewSearch,
  type Ranks,
} from './status-board';
import { tVi } from './i18n/translate';

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

  it('puts an unknown or missing status into the first lane', () => {
    const odd = { id: 9, status: 'archived' as ApiItemStatus, title: 'x' };
    const bare = { id: 10, title: 'no status' };
    expect(groupByStatus([odd, bare])[0].records).toEqual([odd, bare]);
    expect(laneOf(bare)).toBe('planned');
    expect(laneOf({ id: 1, status: 'done' })).toBe('done');
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

  it('treats a missing status as the first lane', () => {
    const bare = [{ id: 1 }];
    expect(planMove(bare, new Map(), 1, 'planned', 1)).toBeNull();
    expect(planMove(bare, new Map(), 1, 'done', 1)?.from).toBe('planned');
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
  const type = PROJECT_BOARD.dragType;

  it('accepts only drags that carry a card of this board', () => {
    expect(isBoardDrag([type], type)).toBe(true);
    expect(isBoardDrag(['text/plain', type], type)).toBe(true);
    expect(isBoardDrag(['Files'], type)).toBe(false);
    expect(isBoardDrag(['text/plain', 'text/uri-list'], type)).toBe(false);
    expect(isBoardDrag(null, type)).toBe(false);
    // a Dự án card is never dropped on the Thư viện board, and the other way round
    expect(isBoardDrag([PROJECT_BOARD.dragType], ITEM_BOARD.dragType)).toBe(false);
    expect(isBoardDrag([ITEM_BOARD.dragType], PROJECT_BOARD.dragType)).toBe(false);
  });

  it('parses only a positive integer id', () => {
    expect(parseDragId('42')).toBe(42);
    for (const bad of ['', '0', '-1', '1.5', '4e2', ' 4', 'abc', '99999999999999999', null, undefined])
      expect(parseDragId(bad)).toBeNull();
  });
});

describe('moveMessage', () => {
  it('names the record and the new status', () => {
    expect(moveMessage('Acme', 'Đang làm', tVi)).toBe('Đã chuyển “Acme” sang Đang làm');
  });
});

describe('moveFailureReason', () => {
  const e = (status: number, reachable = true, body: unknown = null) => ({ status, reachable, body });

  it('says why in the words of the board', () => {
    expect(moveFailureReason(e(0, false), PROJECT_BOARD, tVi)).toBe('chưa kết nối được máy chủ');
    expect(moveFailureReason(e(401), PROJECT_BOARD, tVi)).toBe('chưa đăng nhập');
    expect(moveFailureReason(e(403), ITEM_BOARD, tVi)).toBe('chưa đăng nhập');
    expect(moveFailureReason(e(404), PROJECT_BOARD, tVi)).toBe('dự án này không còn nữa');
    expect(moveFailureReason(e(404), ITEM_BOARD, tVi)).toBe('item này không còn nữa');
    expect(moveFailureReason(e(400, true, { status: ['Không hợp lệ.'] }), ITEM_BOARD, tVi)).toBe('Không hợp lệ.');
    expect(moveFailureReason(e(400), ITEM_BOARD, tVi)).toBe('dữ liệu không hợp lệ');
    expect(moveFailureReason(e(500), ITEM_BOARD, tVi)).toBe('máy chủ trả lỗi 500');
  });
});

describe('board kinds', () => {
  it('keeps the Dự án literals, so the remembered view and the drag type still work', () => {
    expect(PROJECT_BOARD).toMatchObject({
      dragType: 'application/x-alex-brain-project',
      viewKey: 'alex-brain:projects-view',
    });
    expect(PROJECT_BOARD.words.add.msgid).toBe('Thêm dự án');
  });

  it('gives each board its own lower-case drag type and view key', () => {
    for (const kind of [PROJECT_BOARD, ITEM_BOARD]) expect(kind.dragType).toBe(kind.dragType.toLowerCase());
    expect(ITEM_BOARD.dragType).not.toBe(PROJECT_BOARD.dragType);
    expect(ITEM_BOARD.viewKey).not.toBe(PROJECT_BOARD.viewKey);
  });
});

describe('view', () => {
  it('lets the URL win over the remembered choice, else the list', () => {
    expect(resolveView('board', 'list')).toBe('board');
    expect(resolveView('list', 'board')).toBe('list');
    expect(resolveView(null, 'board')).toBe('board');
    expect(resolveView(null, null)).toBe('list');
    expect(resolveView('kanban', 'nonsense')).toBe('list');
    expect(parseView('board')).toBe('board');
    expect(parseView(undefined)).toBeNull();
  });

  it('writes view=board for the board, drops it for the list, keeps other parameters', () => {
    expect(viewSearch('', 'board')).toBe('view=board');
    expect(viewSearch('view=board', 'list')).toBe('');
    expect(viewSearch('item=12', 'board')).toBe('item=12&view=board');
    expect(viewSearch('item=12&view=board', 'list')).toBe('item=12');
  });
});
