'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { ArrowRight, CircleAlert, Plus } from 'lucide-react';
import type { ApiItemStatus, Page } from '@/lib/api/client';
import { toApiError, type ApiResult } from '@/lib/api/use-api';
import { itemStatusOf, itemStatuses } from '@/lib/labels';
import {
  applyMove,
  groupByStatus,
  isBoardDrag,
  laneOf,
  moveFailureReason,
  moveMessage,
  parseDragId,
  planMove,
  rankMove,
  rollbackMove,
  settleMove,
  unrankMove,
  type BoardCardRecord,
  type BoardKind,
  type Ranks,
} from '@/lib/status-board';
import { cn } from '@/lib/utils';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from './brain-card';
import { RowMenu } from './row-menu';

// Bảng: the records of a page in one lane per status (DESIGN.md §6 "Board"), shared by Dự án and Thư viện; a page
// passes its BoardKind (wording, drag type) and the card's body and menu. A card moves by native HTML5 drag and drop
// or by its menu ("Chuyển sang ..."), both through useStatusMoves: optimistic, then the server's answer, or back to
// where it was with one alert.

export type MoveVia = 'drag' | 'menu';

export interface MoveFailure {
  id: number;
  title: string;
  from: ApiItemStatus;
  reason: string;
}

export interface StatusMoves<T extends BoardCardRecord> {
  ranks: Ranks;
  pending: ReadonlySet<number>;
  failure: MoveFailure | null;
  dismissFailure: () => void;
  /** The text of the polite live region (BoardStatus). */
  announcement: string;
  /** The card that takes the focus after a move from its menu: it is a new element in another lane. */
  focusId: number | null;
  clearFocus: () => void;
  /** Resolves false when the API refused the move (the card is back where it was). */
  move: (record: T, to: ApiItemStatus, via: MoveVia) => Promise<boolean>;
  /** A record saved from a dialog (new, or with another status) lands on top of its lane like a moved card. */
  bump: (id: number) => void;
}

/**
 * Status moves of a list loaded with useApi (shared by a page's List and Bảng): the card changes lane at once and
 * goes to the top of it, `save(id, status)` follows, and the server's record replaces it; on failure the old status
 * and place come back and `failure` says why. Each move is announced in `announcement`. A card is not moved again
 * while its save is pending.
 */
export function useStatusMoves<T extends BoardCardRecord>(
  result: ApiResult<Page<T>>,
  kind: BoardKind,
  save: (id: number, status: ApiItemStatus) => Promise<T>,
): StatusMoves<T> {
  const { mutate } = result;
  const list = result.data?.results;
  const seq = useRef(0);
  const [ranks, setRanks] = useState<Ranks>(() => new Map());
  const [pending, setPending] = useState<ReadonlySet<number>>(() => new Set());
  const [failure, setFailure] = useState<MoveFailure | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [focusId, setFocusId] = useState<number | null>(null);

  const update = useCallback(
    (fn: (rows: T[]) => T[]) => mutate((d) => d && { ...d, results: fn(d.results) }),
    [mutate],
  );

  const move = async (record: T, to: ApiItemStatus, via: MoveVia): Promise<boolean> => {
    if (via === 'menu') setFocusId(record.id);
    if (!list || pending.has(record.id)) return true;
    const plan = planMove(list, ranks, record.id, to, seq.current + 1);
    if (!plan) return true;
    seq.current = plan.rank;
    update((rows) => applyMove(rows, plan));
    setRanks((r) => rankMove(r, plan));
    setPending((s) => new Set(s).add(record.id));
    const message = moveMessage(record.title, itemStatusOf(to).label);
    // the same words twice in a row (moved back and forth) must still change the region to be read out again
    setAnnouncement((prev) => (prev === message ? `${message} ` : message));
    try {
      const saved = await save(record.id, to);
      update((rows) => settleMove(rows, saved));
      // a retry that worked: the alert's "... vẫn ở <old lane>" about this card is no longer true
      setFailure((f) => (f?.id === record.id ? null : f));
      return true;
    } catch (err) {
      update((rows) => rollbackMove(rows, plan));
      setRanks((r) => unrankMove(r, plan));
      setFailure({ id: record.id, title: record.title, from: plan.from, reason: moveFailureReason(toApiError(err), kind.noun) });
      // back in its old lane the card is a new element again: the focus follows it there
      if (via === 'menu') setFocusId(record.id);
      return false;
    } finally {
      setPending((s) => {
        const next = new Set(s);
        next.delete(record.id);
        return next;
      });
    }
  };

  const bump = useCallback((id: number) => {
    seq.current += 1;
    const rank = seq.current;
    setRanks((r) => new Map(r).set(id, rank));
  }, []);
  // stable: the card's focus effect depends on it
  const clearFocus = useCallback(() => setFocusId(null), []);

  return {
    ranks,
    pending,
    failure,
    dismissFailure: () => setFailure(null),
    announcement,
    focusId,
    clearFocus,
    move,
    bump,
  };
}

/** The one alert of a refused move, with a close action; the card is already back in its lane. */
export function MoveFailedAlert({ failure, onClose }: { failure: MoveFailure; onClose: () => void }) {
  return (
    <Alert variant="error">
      <CircleAlert aria-hidden />
      <AlertTitle>Không đổi được trạng thái: {failure.reason}</AlertTitle>
      <AlertDescription>
        “{failure.title}” vẫn ở {itemStatusOf(failure.from).label}.
      </AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={onClose}>
          Đóng
        </Button>
      </AlertAction>
    </Alert>
  );
}

/**
 * The polite live region that reads every move out, and the alert of a refused one. Always mounted, outside the
 * board, so the first move is read too. Moves are announced here, not in the page's visible notice: a line appearing
 * above the board would push it down. A fragment: a wrapper would take a gap slot in the page's column.
 */
export function BoardStatus<T extends BoardCardRecord>({ moves }: { moves: StatusMoves<T> }) {
  return (
    <>
      <p className="sr-only" role="status">
        {moves.announcement}
      </p>
      {moves.failure && <MoveFailedAlert failure={moves.failure} onClose={moves.dismissFailure} />}
    </>
  );
}

interface Drag {
  id: number;
  from: ApiItemStatus;
}

/**
 * The lane track: a 4-column grid once the board's own width allows ~14rem lanes (@4xl, 56rem: the sidebar takes
 * part of a 1024px screen); below that the lanes keep 18rem and scroll sideways inside the board, which bleeds into
 * the page gutters so the next lane peeks at the screen edge (the page itself never scrolls sideways). `relative`:
 * the screen-reader-only text in the lanes is absolutely positioned and would otherwise widen the page.
 */
const SCROLLER = 'relative -mx-4 snap-x scroll-px-4 overflow-x-auto sm:-mx-8 sm:scroll-px-8 @4xl:mx-0 @4xl:overflow-visible';
const TRACK = 'flex w-max gap-3 px-4 sm:px-8 @4xl:grid @4xl:w-full @4xl:grid-cols-4 @4xl:px-0';
const LANE = 'flex min-h-40 w-72 shrink-0 snap-start flex-col gap-2 rounded-xl bg-well p-2 @4xl:w-auto';

function BoardCard({
  title,
  status,
  noun,
  pending,
  dimmed,
  focus,
  onFocused,
  onDragStart,
  onDragEnd,
  onOpen,
  onMove,
  menu,
  children,
}: {
  title: string;
  status: ApiItemStatus;
  noun: string;
  pending: boolean;
  dimmed: boolean;
  focus: boolean;
  onFocused: () => void;
  onDragStart: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onMove: (to: ApiItemStatus) => void;
  /** The record's own menu entries, before "Chuyển sang ...". */
  menu: ReactNode;
  /** Meta lines and footer under the title. */
  children: ReactNode;
}) {
  const titleRef = useRef<HTMLButtonElement>(null);
  // After a move from the menu the card is a new element in another lane: give it the focus the menu had.
  useEffect(() => {
    if (!focus) return;
    const frame = window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) titleRef.current?.focus();
      onFocused();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focus, onFocused]);

  return (
    <li
      draggable={!pending}
      aria-busy={pending || undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-3 transition-opacity duration-150 motion-reduce:transition-none',
        !pending && 'cursor-grab active:cursor-grabbing',
        dimmed && 'opacity-50',
      )}
    >
      <div className="flex items-start gap-1">
        <button
          ref={titleRef}
          type="button"
          onClick={onOpen}
          className={cn(
            'min-w-0 flex-1 cursor-pointer rounded-sm py-0.5 text-start text-sm font-medium underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !dimmed && 'hover:underline',
          )}
        >
          <span className="line-clamp-2 break-words">{title}</span>
          <span className="sr-only">, sửa {noun}</span>
        </button>
        <span className="-me-1.5 -mt-0.5 shrink-0">
          <RowMenu label={`Thao tác cho "${title}"`}>
            {menu}
            <MenuSeparator />
            {itemStatuses
              .filter((s) => s.value !== status)
              .map((s) => (
                <MenuItem key={s.value} disabled={pending} onClick={() => onMove(s.value)}>
                  <ArrowRight aria-hidden />
                  Chuyển sang {s.label}
                </MenuItem>
              ))}
          </RowMenu>
        </span>
      </div>
      {children}
    </li>
  );
}

function BoardLane({
  kind,
  status,
  count,
  drag,
  current,
  onDropCard,
  onAdd,
  children,
}: {
  kind: BoardKind;
  status: ApiItemStatus;
  count: number;
  /** The card being dragged, one frame after dragstart (the empty lane's drop area, the target ring). */
  drag: Drag | null;
  /** The drag from its first event on (set synchronously on dragstart); null for drags from elsewhere. */
  current: () => Drag | null;
  onDropCard: (id: number, to: ApiItemStatus) => void;
  onAdd: () => void;
  children: ReactNode;
}) {
  const s = itemStatusOf(status);
  const headingId = useId();
  // dragenter/dragleave also fire for every child the pointer crosses: count them per drag, so the ring does not
  // flicker, and a count left over by a drag that ended elsewhere never leaks into the next one
  const depth = useRef<{ drag: Drag | null; n: number }>({ drag: null, n: 0 });
  const [overDrag, setOverDrag] = useState<Drag | null>(null);
  /** The drag of this board that `e` belongs to, or null (files, text, links from other pages). */
  const ours = (e: DragEvent) => {
    const d = current();
    return d && isBoardDrag(e.dataTransfer.types, kind.dragType) ? d : null;
  };

  const target = drag !== null && overDrag === drag && drag.from !== status;
  return (
    <section
      aria-labelledby={headingId}
      onDragEnter={(e) => {
        const d = ours(e);
        if (!d) return;
        e.preventDefault();
        if (depth.current.drag !== d) depth.current = { drag: d, n: 0 };
        depth.current.n += 1;
        setOverDrag(d);
      }}
      onDragOver={(e) => {
        if (!ours(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragLeave={(e) => {
        const d = ours(e);
        if (!d || depth.current.drag !== d) return;
        depth.current.n = Math.max(0, depth.current.n - 1);
        if (depth.current.n === 0) setOverDrag(null);
      }}
      onDrop={(e) => {
        if (!ours(e)) return;
        e.preventDefault();
        depth.current = { drag: null, n: 0 };
        setOverDrag(null);
        const id = parseDragId(e.dataTransfer.getData(kind.dragType));
        if (id !== null) onDropCard(id, status);
      }}
      className={cn(LANE, target && 'ring-2 ring-ring ring-inset')}
    >
      <h2 id={headingId} className="flex h-7 items-center gap-2">
        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          <span className="sr-only">, </span>
          {count}
          <span className="sr-only"> {kind.noun}</span>
        </span>
      </h2>
      {count > 0 ? (
        <ul className="flex flex-col gap-2">{children}</ul>
      ) : (
        // the same box idle and while dragging (only its border shows), so nothing shifts when a drag starts
        <p
          className={cn(
            'flex h-20 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-muted-foreground transition-colors duration-150 motion-reduce:transition-none',
            drag ? 'border-foreground/25' : 'border-transparent',
          )}
        >
          {drag ? `Thả ${kind.noun} vào đây` : `Chưa có ${kind.noun}`}
        </p>
      )}
      <Button
        variant="ghost"
        size="xs"
        className="self-start text-muted-foreground"
        onClick={onAdd}
        aria-label={`Thêm ${kind.noun} vào cột ${s.label}`}
      >
        <Plus aria-hidden />
        Thêm {kind.noun}
      </Button>
    </section>
  );
}

export interface StatusBoardProps<T extends BoardCardRecord> {
  kind: BoardKind;
  records: readonly T[];
  moves: Pick<StatusMoves<T>, 'ranks' | 'pending' | 'focusId' | 'clearFocus' | 'move'>;
  /** The card's title button: the record's edit dialog (also the focus target after a move from the menu). */
  onOpen: (record: T) => void;
  /** A lane's "+ Thêm <noun>": a new record in that status. */
  onAdd: (status: ApiItemStatus) => void;
  /** Meta lines and footer under the title. */
  renderBody: (record: T) => ReactNode;
  /** The record's own menu entries; the board adds a separator and "Chuyển sang ..." (disabled while pending). */
  renderMenu: (record: T) => ReactNode;
}

/**
 * The board: one lane per status (itemStatuses order), cards in list order with the cards moved in this visit on
 * top (`moves.ranks`). Native HTML5 drag and drop only (no library): a lane accepts a drag that started on one of
 * these cards and carries `kind.dragType`, never files, text or the cards of another board.
 */
export function StatusBoard<T extends BoardCardRecord>({
  kind,
  records,
  moves,
  onOpen,
  onAdd,
  renderBody,
  renderMenu,
}: StatusBoardProps<T>) {
  const { ranks, pending, focusId, clearFocus, move } = moves;
  const lanes = useMemo(() => groupByStatus(records, ranks), [records, ranks]);
  // The ref answers the lanes' drag events from the first one on; the state (one frame later, so the browser has
  // taken the drag image of the card at full opacity) dims the card and shows the empty lanes' drop areas.
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const current = useCallback(() => dragRef.current, []);
  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
  }, []);

  const startDrag = (e: DragEvent<HTMLLIElement>, record: T) => {
    // only the card itself: a drag from its menu (portalled, but its React events bubble here) is not a card drag
    if (e.target !== e.currentTarget) return;
    if (pending.has(record.id)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(kind.dragType, String(record.id));
    e.dataTransfer.effectAllowed = 'move';
    const d = { id: record.id, from: laneOf(record) };
    dragRef.current = d;
    window.requestAnimationFrame(() => {
      if (dragRef.current === d) setDrag(d);
    });
  };

  const dropCard = (id: number, to: ApiItemStatus) => {
    // The dropped card re-renders in its new lane, so its old element never reports dragend to React: end here.
    endDrag();
    const record = records.find((r) => r.id === id);
    if (record) void move(record, to, 'drag');
  };

  return (
    <div className="@container">
      <div className={SCROLLER}>
        <div className={TRACK}>
          {lanes.map((lane) => (
            <BoardLane
              key={lane.status}
              kind={kind}
              status={lane.status}
              count={lane.records.length}
              drag={drag}
              current={current}
              onDropCard={dropCard}
              onAdd={() => onAdd(lane.status)}
            >
              {lane.records.map((record) => (
                <BoardCard
                  key={record.id}
                  title={record.title}
                  status={lane.status}
                  noun={kind.noun}
                  pending={pending.has(record.id)}
                  dimmed={drag?.id === record.id}
                  focus={focusId === record.id}
                  onFocused={clearFocus}
                  onDragStart={(e) => startDrag(e, record)}
                  onDragEnd={endDrag}
                  onOpen={() => onOpen(record)}
                  onMove={(to) => void move(record, to, 'menu')}
                  menu={renderMenu(record)}
                >
                  {renderBody(record)}
                </BoardCard>
              ))}
            </BoardLane>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Loading lanes at the board's geometry (DESIGN.md D27): four wells with card placeholders. */
export function BoardSkeleton() {
  return (
    <div className="@container" aria-busy="true" aria-label="Đang tải">
      <div className="-mx-4 overflow-hidden sm:-mx-8 @4xl:mx-0">
        <div className={TRACK}>
          {itemStatuses.map((s, i) => (
            <div key={s.value} className={LANE} aria-hidden>
              <div className="flex h-7 items-center gap-2 px-1">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-3 w-3" />
              </div>
              {Array.from({ length: i < 2 ? 2 : 1 }, (_, j) => (
                <div key={j} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
