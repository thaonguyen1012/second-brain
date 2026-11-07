'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleAlert, Clock, Pencil, Play, Plus } from 'lucide-react';
import type { ApiError, ApiItemStatus, Page } from '@/lib/api/client';
import { toApiError, type ApiResult } from '@/lib/api/use-api';
import { workApi, type ApiProject } from '@/lib/api/work';
import { firstFieldError, itemStatusOf, itemStatuses } from '@/lib/labels';
import {
  PROJECT_DRAG_TYPE,
  applyMove,
  groupByStatus,
  isProjectDrag,
  moveMessage,
  parseDragId,
  planMove,
  rankMove,
  rollbackMove,
  settleMove,
  unrankMove,
  type Ranks,
} from '@/lib/project-board';
import { cn } from '@/lib/utils';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MenuItem, MenuLinkItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '../brain-card';
import { RowMenu } from '../row-menu';
import { MiniBillableBar } from './billable-bar';
import { formatHours, formatMoney } from './format';
import { canStartTimer, projectMeta } from './project-meta';

// Bảng: the projects of Dự án in one lane per status (DESIGN.md §6 "Board"). A card moves by native HTML5 drag and
// drop or by its menu ("Chuyển sang ..."), both through useProjectMoves: optimistic, then the server's answer, or
// back to where it was with one alert.

export interface MoveFailure {
  id: number;
  title: string;
  from: ApiItemStatus;
  reason: string;
}

/** Why a status change failed, as the end of "Không đổi được trạng thái: ...". */
function failureReason(e: ApiError): string {
  if (!e.reachable) return 'chưa kết nối được máy chủ';
  if (e.status === 401 || e.status === 403) return 'chưa đăng nhập';
  if (e.status === 404) return 'dự án này không còn nữa';
  if (e.status === 400) return firstFieldError(e.body) ?? 'dữ liệu không hợp lệ';
  return `máy chủ trả lỗi ${e.status}`;
}

/**
 * Status moves of the projects list loaded with useApi (shared by List and Bảng): the card changes lane at once and
 * goes to the top of it, PATCH /api/projects/{id} { status } follows, and the server's record replaces it; on failure
 * the old status and place come back and `failure` says why. Each move is announced in `announcement` (polite live
 * region). A card is not moved again while its PATCH is pending. Resolves false when the API refused the move.
 */
export function useProjectMoves(projects: ApiResult<Page<ApiProject>>) {
  const { mutate } = projects;
  const list = projects.data?.results;
  const seq = useRef(0);
  const [ranks, setRanks] = useState<Ranks>(() => new Map());
  const [pending, setPending] = useState<ReadonlySet<number>>(() => new Set());
  const [failure, setFailure] = useState<MoveFailure | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const update = useCallback(
    (fn: (rows: ApiProject[]) => ApiProject[]) => mutate((d) => d && { ...d, results: fn(d.results) }),
    [mutate],
  );

  const move = async (p: ApiProject, to: ApiItemStatus): Promise<boolean> => {
    if (!list || pending.has(p.id)) return true;
    const plan = planMove(list, ranks, p.id, to, seq.current + 1);
    if (!plan) return true;
    seq.current = plan.rank;
    update((rows) => applyMove(rows, plan));
    setRanks((r) => rankMove(r, plan));
    setPending((s) => new Set(s).add(p.id));
    const message = moveMessage(p.title, itemStatusOf(to).label);
    // the same words twice in a row (moved back and forth) must still change the region to be read out again
    setAnnouncement((prev) => (prev === message ? `${message} ` : message));
    try {
      const saved = await workApi.updateProject(p.id, { status: to });
      update((rows) => settleMove(rows, saved));
      // a retry that worked: the alert's "... vẫn ở <old lane>" about this card is no longer true
      setFailure((f) => (f?.id === p.id ? null : f));
      return true;
    } catch (err) {
      update((rows) => rollbackMove(rows, plan));
      setRanks((r) => unrankMove(r, plan));
      setFailure({ id: p.id, title: p.title, from: plan.from, reason: failureReason(toApiError(err)) });
      return false;
    } finally {
      setPending((s) => {
        const next = new Set(s);
        next.delete(p.id);
        return next;
      });
    }
  };

  /** A project saved from the dialog (new, or with another status) also lands on top of its lane. */
  const bump = useCallback((id: number) => {
    seq.current += 1;
    const rank = seq.current;
    setRanks((r) => new Map(r).set(id, rank));
  }, []);

  return { ranks, pending, failure, dismissFailure: () => setFailure(null), announcement, move, bump };
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
  project: p,
  running,
  pending,
  dimmed,
  focus,
  onFocused,
  onDragStart,
  onDragEnd,
  onEdit,
  onStart,
  onMove,
}: {
  project: ApiProject;
  running: boolean;
  pending: boolean;
  dimmed: boolean;
  focus: boolean;
  onFocused: () => void;
  onDragStart: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onStart: () => void;
  onMove: (to: ApiItemStatus) => void;
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

  const hours = p.minutesTotal > 0;
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
          onClick={onEdit}
          className={cn(
            'min-w-0 flex-1 cursor-pointer rounded-sm py-0.5 text-start text-sm font-medium underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !dimmed && 'hover:underline',
          )}
        >
          <span className="line-clamp-2 break-words">{p.title}</span>
          <span className="sr-only">, sửa dự án</span>
        </button>
        <span className="-me-1.5 -mt-0.5 shrink-0">
          <RowMenu label={`Thao tác cho "${p.title}"`}>
            <MenuItem onClick={onEdit}>
              <Pencil aria-hidden />
              Sửa
            </MenuItem>
            {canStartTimer(p, running) && (
              <MenuItem onClick={onStart}>
                <Play aria-hidden />
                Bấm giờ
              </MenuItem>
            )}
            <MenuLinkItem render={<Link href={`/cong-viec/gio/?project=${p.id}`} />}>
              <Clock aria-hidden />
              Xem giờ
            </MenuLinkItem>
            <MenuSeparator />
            {itemStatuses
              .filter((s) => s.value !== p.status)
              .map((s) => (
                <MenuItem key={s.value} disabled={pending} onClick={() => onMove(s.value)}>
                  <ArrowRight aria-hidden />
                  Chuyển sang {s.label}
                </MenuItem>
              ))}
          </RowMenu>
        </span>
      </div>
      {/* two lines, not one: a long client name would otherwise cut off the agreed price on a 14-18rem card */}
      <p className="line-clamp-2 text-xs break-words text-muted-foreground">{projectMeta(p)}</p>
      {(hours || running || p.effectiveRate) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          {(hours || running) && (
            <span className="inline-flex items-center gap-2">
              {running && (
                <>
                  <span className="size-2 shrink-0 rounded-full bg-bw-red" aria-hidden />
                  <span className="sr-only">Đang bấm giờ.</span>
                </>
              )}
              {hours && (
                <>
                  <span className="font-medium text-foreground">{formatHours(p.minutesTotal)}</span>
                  <span className="w-10">
                    <MiniBillableBar billable={p.minutesBillable} nonBillable={p.minutesNonBillable} />
                  </span>
                </>
              )}
            </span>
          )}
          {p.effectiveRate && <span>thực tế {formatMoney(p.effectiveRate, p.currency)}/giờ</span>}
        </div>
      )}
    </li>
  );
}

function BoardLane({
  status,
  count,
  drag,
  current,
  onDropCard,
  onAdd,
  children,
}: {
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
    return d && isProjectDrag(e.dataTransfer.types) ? d : null;
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
        const id = parseDragId(e.dataTransfer.getData(PROJECT_DRAG_TYPE));
        if (id !== null) onDropCard(id, status);
      }}
      className={cn(LANE, target && 'ring-2 ring-ring ring-inset')}
    >
      <h2 id={headingId} className="flex h-7 items-center gap-2">
        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          <span className="sr-only">, </span>
          {count}
          <span className="sr-only"> dự án</span>
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
          {drag ? 'Thả dự án vào đây' : 'Chưa có dự án'}
        </p>
      )}
      <Button
        variant="ghost"
        size="xs"
        className="self-start text-muted-foreground"
        onClick={onAdd}
        aria-label={`Thêm dự án vào cột ${s.label}`}
      >
        <Plus aria-hidden />
        Thêm dự án
      </Button>
    </section>
  );
}

/**
 * The board: one lane per status (itemStatuses order), cards in list order with the cards moved in this visit on
 * top (`ranks`). Native HTML5 drag and drop only (no library): a lane accepts a drag that started on one of these
 * cards and carries PROJECT_DRAG_TYPE, never files or text from elsewhere. `focusId` is the card that should take
 * focus (after a move from its menu).
 */
export function ProjectBoard({
  projects,
  ranks,
  pending,
  runningId,
  focusId,
  onFocused,
  onEdit,
  onStart,
  onMove,
  onAdd,
}: {
  projects: ApiProject[];
  ranks: Ranks;
  pending: ReadonlySet<number>;
  runningId: number | null;
  focusId: number | null;
  onFocused: () => void;
  onEdit: (p: ApiProject) => void;
  onStart: (p: ApiProject) => void;
  onMove: (p: ApiProject, to: ApiItemStatus, via: 'drag' | 'menu') => void;
  onAdd: (status: ApiItemStatus) => void;
}) {
  const lanes = useMemo(() => groupByStatus(projects, ranks), [projects, ranks]);
  // The ref answers the lanes' drag events from the first one on; the state (one frame later, so the browser has
  // taken the drag image of the card at full opacity) dims the card and shows the empty lanes' drop areas.
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const current = useCallback(() => dragRef.current, []);
  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
  }, []);

  const startDrag = (e: DragEvent<HTMLLIElement>, p: ApiProject) => {
    // only the card itself: a drag from its menu (portalled, but its React events bubble here) is not a card drag
    if (e.target !== e.currentTarget) return;
    if (pending.has(p.id)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(PROJECT_DRAG_TYPE, String(p.id));
    e.dataTransfer.effectAllowed = 'move';
    const d = { id: p.id, from: p.status };
    dragRef.current = d;
    window.requestAnimationFrame(() => {
      if (dragRef.current === d) setDrag(d);
    });
  };

  const dropCard = (id: number, to: ApiItemStatus) => {
    // The dropped card re-renders in its new lane, so its old element never reports dragend to React: end here.
    endDrag();
    const p = projects.find((x) => x.id === id);
    if (p) onMove(p, to, 'drag');
  };

  return (
    <div className="@container">
      <div className={SCROLLER}>
        <div className={TRACK}>
          {lanes.map((lane) => (
            <BoardLane
              key={lane.status}
              status={lane.status}
              count={lane.records.length}
              drag={drag}
              current={current}
              onDropCard={dropCard}
              onAdd={() => onAdd(lane.status)}
            >
              {lane.records.map((p) => (
                <BoardCard
                  key={p.id}
                  project={p}
                  running={runningId === p.id}
                  pending={pending.has(p.id)}
                  dimmed={drag?.id === p.id}
                  focus={focusId === p.id}
                  onFocused={onFocused}
                  onDragStart={(e) => startDrag(e, p)}
                  onDragEnd={endDrag}
                  onEdit={() => onEdit(p)}
                  onStart={() => onStart(p)}
                  onMove={(to) => onMove(p, to, 'menu')}
                />
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
