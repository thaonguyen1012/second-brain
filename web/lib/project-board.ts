// Pure logic of the Dự án board (components/brain/work/project-board.tsx): lanes by status, the optimistic status
// move with its rollback, the drag payload and loading every cursor page. No React and no fetch, so it is
// unit-tested in project-board.test.ts; the components only wire it to state and to workApi.
import type { ApiItemStatus, Page } from '@/lib/api/client';
import { itemStatuses } from '@/lib/labels';

/** What the board needs of a record (ApiProject has more). */
export interface BoardRecord {
  id: number;
  status: ApiItemStatus;
}

export interface Lane<T> {
  status: ApiItemStatus;
  records: T[];
}

/**
 * Cards moved during this visit, id -> rank: a ranked card sits above the unranked ones of its lane, the highest
 * rank first. The list itself keeps the API's order (newest first), so the List view does not reshuffle.
 */
export type Ranks = ReadonlyMap<number, number>;

/**
 * One lane per status in `itemStatuses` order, each in list order with the ranked cards on top. A status the
 * labels do not know falls into the first lane, like itemStatusOf().
 */
export function groupByStatus<T extends BoardRecord>(list: readonly T[], ranks: Ranks = new Map()): Lane<T>[] {
  const lanes: Lane<T>[] = itemStatuses.map((s) => ({ status: s.value, records: [] }));
  const byStatus = new Map(lanes.map((lane) => [lane.status, lane]));
  for (const record of list) (byStatus.get(record.status) ?? lanes[0]).records.push(record);
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
  if (!record || record.status === to) return null;
  return { id, from: record.status, to, rank, rankBefore: ranks.get(id) };
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
  return list.map((r) => (r.id === move.id && r.status === move.to ? { ...r, status: move.from } : r));
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
export function moveMessage(title: string, statusLabel: string): string {
  return `Đã chuyển “${title}” sang ${statusLabel}`;
}

/**
 * The DataTransfer type a dragged card carries (its id). A lane accepts only drags that carry it, so files and text
 * dragged from other pages are ignored.
 */
export const PROJECT_DRAG_TYPE = 'application/x-alex-brain-project';

export function isProjectDrag(types: Iterable<string> | null | undefined): boolean {
  return !!types && Array.from(types).includes(PROJECT_DRAG_TYPE);
}

/** The id in a drop's payload, or null for anything else. */
export function parseDragId(data: string | null | undefined): number | null {
  if (!data || !/^[1-9]\d{0,15}$/.test(data)) return null;
  const id = Number(data);
  return Number.isSafeInteger(id) ? id : null;
}

/** Cap of loadAllPages: 20 pages of 100 projects. */
export const MAX_PAGES = 20;

/**
 * Every page of a cursor list in one Page (rows already seen are skipped). `next` stays set when the cap stopped
 * it, so the page can still offer "Tải thêm".
 */
export async function loadAllPages<T extends { id: number }>(
  first: () => Promise<Page<T>>,
  page: (next: string) => Promise<Page<T>>,
  maxPages = MAX_PAGES,
): Promise<Page<T>> {
  const head = await first();
  const results = [...head.results];
  const seen = new Set(results.map((r) => r.id));
  let next = head.next;
  for (let n = 1; next && n < maxPages; n++) {
    const more = await page(next);
    for (const r of more.results) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      results.push(r);
    }
    next = more.next;
  }
  return { results, next };
}
