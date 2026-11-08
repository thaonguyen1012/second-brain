// Pure logic of the status boards (components/brain/status-board.tsx), used by Dự án and Thư viện: lanes by status,
// the optimistic status move with its rollback, the drag payload, the List/Board choice in the URL and the words of a
// refused move. No React and no fetch, so it is unit-tested in status-board.test.ts; the components only wire it to
// state and to the API.
import type { ApiError, ApiItemStatus } from '@/lib/api/client';
import { firstFieldError, itemStatuses } from '@/lib/labels';
import { msg, type Msg, type T } from '@/lib/i18n/translate';

/** What a board needs of a record. An Item's status is optional in the API schema (the model has a default). */
export interface BoardRecord {
  id: number;
  status?: ApiItemStatus;
}

/** A record with the title its card, its menu and its announcements name. */
export interface BoardCardRecord extends BoardRecord {
  title: string;
}

export interface Lane<T> {
  status: ApiItemStatus;
  records: T[];
}

const knownStatuses = new Set<string>(itemStatuses.map((s) => s.value));

/** The lane of a record: its status, or the first lane for a missing or unknown one, like itemStatusOf(). */
export function laneOf(record: BoardRecord): ApiItemStatus {
  return record.status && knownStatuses.has(record.status) ? record.status : itemStatuses[0].value;
}

/**
 * Cards moved during this visit, id -> rank: a ranked card sits above the unranked ones of its lane, the highest
 * rank first. The list itself keeps the API's order (newest first), so the List view does not reshuffle.
 */
export type Ranks = ReadonlyMap<number, number>;

/** One lane per status in `itemStatuses` order, each in list order with the ranked cards on top. */
export function groupByStatus<T extends BoardRecord>(list: readonly T[], ranks: Ranks = new Map()): Lane<T>[] {
  const lanes: Lane<T>[] = itemStatuses.map((s) => ({ status: s.value, records: [] }));
  const byStatus = new Map(lanes.map((lane) => [lane.status, lane]));
  for (const record of list) (byStatus.get(laneOf(record)) ?? lanes[0]).records.push(record);
  if (ranks.size > 0) {
    // Array.prototype.sort is stable: unranked cards keep their list order
    for (const lane of lanes)
      lane.records.sort((a, b) => {
        const ra = ranks.get(a.id);
        const rb = ranks.get(b.id);
        if (ra !== undefined && rb !== undefined) return rb - ra;
        if (ra !== undefined) return -1;
        if (rb !== undefined) return 1;
        return 0;
      });
  }
  return lanes;
}

/** A planned status change: enough to apply it at once and to undo it if the API refuses. */
export interface Move {
  id: number;
  from: ApiItemStatus;
  to: ApiItemStatus;
  /** The card's rank after the move (top of its new lane). */
  rank: number;
  /** Its rank before the move; undefined = it had not been moved in this visit. */
  rankBefore: number | undefined;
}

/** The move of record `id` to `to` with the next `rank`, or null when the record is unknown or already there. */
export function planMove(
  list: readonly BoardRecord[],
  ranks: Ranks,
  id: number,
  to: ApiItemStatus,
  rank: number,
): Move | null {
  const record = list.find((r) => r.id === id);
  if (!record) return null;
  const from = laneOf(record);
  if (from === to) return null;
  return { id, from, to, rank, rankBefore: ranks.get(id) };
}

/** Optimistic step: the record takes its new status at once. */
export function applyMove<T extends BoardRecord>(list: readonly T[], move: Move): T[] {
  return list.map((r) => (r.id === move.id ? { ...r, status: move.to } : r));
}

/** Optimistic step: the card goes to the top of its new lane. */
export function rankMove(ranks: Ranks, move: Move): Map<number, number> {
  return new Map(ranks).set(move.id, move.rank);
}

/** Success: the server's answer replaces the optimistic record. */
export function settleMove<T extends { id: number }>(list: readonly T[], saved: T): T[] {
  return list.map((r) => (r.id === saved.id ? saved : r));
}

/**
 * Failure: the record gets its old status back, unless something newer already changed it (a reload that never saw
 * the move, a save from the edit dialog); every other field stays as it is now.
 */
export function rollbackMove<T extends BoardRecord>(list: readonly T[], move: Move): T[] {
  return list.map((r) => (r.id === move.id && laneOf(r) === move.to ? { ...r, status: move.from } : r));
}

/** Failure: the card's old place in its old lane (its old rank, or none), unless it was moved again since. */
export function unrankMove(ranks: Ranks, move: Move): Ranks {
  if (ranks.get(move.id) !== move.rank) return ranks;
  const next = new Map(ranks);
  if (move.rankBefore === undefined) next.delete(move.id);
  else next.set(move.id, move.rankBefore);
  return next;
}

/** The polite announcement of a move (screen readers), the same for a drag and the card menu. */
export function moveMessage(title: string, statusLabel: string, t: T): string {
  return t('Đã chuyển “{title}” sang {status}', { title, status: statusLabel });
}

/** Why a status change failed, as the end of "Không đổi được trạng thái: ...". */
export function moveFailureReason(e: Pick<ApiError, 'status' | 'reachable' | 'body'>, kind: BoardKind, t: T): string {
  if (!e.reachable) return t('chưa kết nối được máy chủ');
  if (e.status === 401 || e.status === 403) return t('chưa đăng nhập');
  if (e.status === 404) return t(kind.words.gone);
  if (e.status === 400) return firstFieldError(e.body, t) ?? t('dữ liệu không hợp lệ');
  return t('máy chủ trả lỗi {status}', { status: e.status });
}

/** A board's sentences about its records, whole (an English noun needs its own article and plural). */
export interface BoardWords {
  /** The lane's button: "Thêm dự án". */
  add: Msg;
  /** Its accessible name: "Thêm dự án vào cột {lane}". */
  addToLane: Msg;
  /** An empty lane: "Chưa có dự án". */
  none: Msg;
  /** An empty lane under a drag: "Thả dự án vào đây". */
  dropHere: Msg;
  /** Read after a card's title, which opens its edit dialog: "sửa dự án". */
  edit: Msg;
  /** A lane's count as a screen reader hears it: "{n} dự án". */
  count: Msg;
  /** A move refused with 404: "dự án này không còn nữa". */
  gone: Msg;
}

/** What differs between the boards of the app. */
export interface BoardKind {
  words: BoardWords;
  /**
   * The DataTransfer type a dragged card carries (its id). A lane accepts only drags that carry its own type, so
   * files, text, links from other pages and cards of another board are ignored. Lower case: browsers lower-case it.
   */
  dragType: string;
  /** localStorage key of the List/Board choice last made in this browser. */
  viewKey: string;
}

export const PROJECT_BOARD: BoardKind = {
  words: {
    add: msg('Thêm dự án'),
    addToLane: msg('Thêm dự án vào cột {lane}'),
    none: msg('Chưa có dự án'),
    dropHere: msg('Thả dự án vào đây'),
    edit: msg('sửa dự án'),
    count: msg('{n} dự án'),
    gone: msg('dự án này không còn nữa'),
  },
  dragType: 'application/x-alex-brain-project',
  viewKey: 'alex-brain:projects-view',
};

export const ITEM_BOARD: BoardKind = {
  words: {
    add: msg('Thêm item'),
    addToLane: msg('Thêm item vào cột {lane}'),
    none: msg('Chưa có item'),
    dropHere: msg('Thả item vào đây'),
    edit: msg('sửa item'),
    count: msg('{n} item'),
    gone: msg('item này không còn nữa'),
  },
  dragType: 'application/x-alex-brain-item',
  viewKey: 'alex-brain:library-view',
};

export function isBoardDrag(types: Iterable<string> | null | undefined, dragType: string): boolean {
  return !!types && Array.from(types).includes(dragType);
}

/** The id in a drop's payload, or null for anything else. */
export function parseDragId(data: string | null | undefined): number | null {
  if (!data || !/^[1-9]\d{0,15}$/.test(data)) return null;
  const id = Number(data);
  return Number.isSafeInteger(id) ? id : null;
}

/** The two views of a page with a board: the list (default) and the board (`?view=board`). */
export type BoardView = 'list' | 'board';

export function parseView(value: string | null | undefined): BoardView | null {
  return value === 'board' || value === 'list' ? value : null;
}

/** The URL's view wins, then the one last picked in this browser, else the list. */
export function resolveView(fromUrl: string | null, stored: string | null): BoardView {
  return parseView(fromUrl) ?? parseView(stored) ?? 'list';
}

/** The query string for `view`: `view=board` for the board, no parameter for the list; other parameters kept. */
export function viewSearch(search: string, view: BoardView): string {
  const q = new URLSearchParams(search);
  if (view === 'board') q.set('view', 'board');
  else q.delete('view');
  return q.toString();
}
