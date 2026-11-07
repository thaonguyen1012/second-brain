'use client';
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, FolderPlus, List, Pencil, Play, Plus, SquareKanban } from 'lucide-react';
import { api, type ApiItemStatus, type Page } from '@/lib/api/client';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { workApi, type ApiProject } from '@/lib/api/work';
import { itemStatusOf, itemStatuses } from '@/lib/labels';
import { loadAllPages } from '@/lib/project-board';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MenuItem, MenuLinkItem } from '@/components/ui/menu';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiErrorState, ApiStaleAlert, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { EmptyPanel, useToolbarState } from '../empty-panel';
import { PAGE_WIDTH } from '../layout';
import { RowMenu } from '../row-menu';
import { BillableLegend, MiniBillableBar } from './billable-bar';
import { formatHours, formatMoney } from './format';
import { BoardSkeleton, MoveFailedAlert, ProjectBoard, useProjectMoves } from './project-board';
import { ProjectDialog } from './project-dialog';
import { canStartTimer, projectMeta } from './project-meta';
import { RowsSkeleton } from './rows-skeleton';
import { TimerPanel } from './timer-panel';
import { useProjectsView, type ProjectsView } from './use-projects-view';
import { sortProjectChoices, useTimer, useWeekObjectives } from './use-work';

type StatusFilter = ApiItemStatus | 'all';
const statusChoices = [{ value: 'all' as const, label: 'Mọi trạng thái' }, ...itemStatuses];

/** One grid for the header and every row, so the number columns line up (DESIGN.md §3 "Columns"). */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 md:grid-cols-[5rem_minmax(0,1fr)_6rem_8rem_8rem_auto]';

/** Every project (all cursor pages, at most 20 of 100), newest first: one list for both views. */
const loadProjects = () =>
  loadAllPages<ApiProject>(
    () => workApi.listProjects({ limit: 100 }),
    (next) => api.page<ApiProject>(next),
  );

function ProjectRow({
  project: p,
  running,
  onEdit,
  onStart,
}: {
  project: ApiProject;
  running: boolean;
  onEdit: () => void;
  onStart: () => void;
}) {
  const s = itemStatusOf(p.status);
  return (
    <li className={cn(ROW_GRID, 'min-h-14 py-2')}>
      <span className="flex max-md:hidden">
        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {running && (
            <span className="size-2 shrink-0 rounded-full bg-bw-red" aria-hidden />
          )}
          <span className="truncate">{p.title}</span>
          {running && <span className="sr-only">(đang bấm giờ)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="md:hidden">{s.label} · </span>
          {projectMeta(p)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-medium tabular-nums">{formatHours(p.minutesTotal)}</span>
        <span className="w-full max-w-16 max-md:hidden">
          <MiniBillableBar billable={p.minutesBillable} nonBillable={p.minutesNonBillable} />
        </span>
      </div>
      <span className="text-end text-sm tabular-nums max-md:hidden">
        {p.effectiveRate ? `${formatMoney(p.effectiveRate, p.currency)}/giờ` : '—'}
      </span>
      <span className="text-end text-sm tabular-nums max-md:hidden">{formatMoney(p.earned, p.currency) || '—'}</span>
      <div className="flex items-center justify-end gap-1">
        {canStartTimer(p, running) ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button size="icon-sm" variant="ghost" onClick={onStart} aria-label={`Bấm giờ cho ${p.title}`} />
              }
            >
              <Play aria-hidden />
            </TooltipTrigger>
            <TooltipPopup>Bấm giờ</TooltipPopup>
          </Tooltip>
        ) : (
          // keeps the actions track the same width on every row
          <span className="size-8 sm:size-7" aria-hidden />
        )}
        <RowMenu label={`Thao tác cho "${p.title}"`}>
          <MenuItem onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </MenuItem>
          <MenuLinkItem render={<Link href={`/cong-viec/gio/?project=${p.id}`} />}>
            <Clock aria-hidden />
            Xem giờ
          </MenuLinkItem>
        </RowMenu>
      </div>
    </li>
  );
}

function ProjectList({
  projects,
  runningId,
  onEdit,
  onStart,
}: {
  projects: ApiProject[];
  runningId: number | null;
  onEdit: (p: ApiProject) => void;
  onStart: (p: ApiProject) => void;
}) {
  return (
    <div className="flex flex-col divide-y rounded-xl border bg-card">
      {/* Column labels for the eye (the rows carry their own text); only the rate's definition is focusable */}
      <div className={cn(ROW_GRID, 'h-8 text-xs font-medium text-muted-foreground max-md:hidden')}>
        <span aria-hidden>Trạng thái</span>
        <span aria-hidden>Dự án</span>
        <span className="text-end" aria-hidden>
          Giờ
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="cursor-help justify-self-end rounded-sm text-end underline decoration-dotted underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            }
          >
            Giá giờ thực tế
          </TooltipTrigger>
          <TooltipPopup className="max-w-64">Số tiền chia cho mọi giờ đã làm, kể cả giờ không tính tiền.</TooltipPopup>
        </Tooltip>
        <span className="text-end" aria-hidden>
          Đã kiếm
        </span>
        <span className="w-15" aria-hidden />
      </div>
      <ul className="flex flex-col divide-y" aria-label="Dự án">
        {projects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            running={runningId === p.id}
            onEdit={() => onEdit(p)}
            onStart={() => onStart(p)}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Dự án: projects with client, billing and price, earned and effective hourly rate (Harvest style), in two views
 * like ClickUp's "All tasks": Danh sách (the list, filterable by status) and Bảng (one lane per status; dragging a
 * card or its menu changes the status). Both views show one list of every project, so a change in one is in the
 * other without a reload.
 */
export function ProjectsPage() {
  const [view, setView] = useProjectsView();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<ApiProject | null>(null);
  const [newStatus, setNewStatus] = useState<ApiItemStatus | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [focusId, setFocusId] = useState<number | null>(null);

  const projects = useApi<Page<ApiProject>>('work:projects:all', loadProjects);
  const moves = useProjectMoves(projects);
  const { objectives } = useWeekObjectives();
  const timer = useTimer();
  const runningId = timer.running?.project ?? null;

  const all = useMemo(() => projects.data?.results ?? [], [projects.data]);
  const list = useMemo(() => (status === 'all' ? all : all.filter((p) => p.status === status)), [all, status]);
  const choices = useMemo(
    () => sortProjectChoices(all).filter((p) => p.status === 'active' || p.status === 'planned'),
    [all],
  );

  const upsert = (saved: ApiProject, created: boolean) =>
    projects.mutate((d) => {
      if (!d) return d;
      const rest = d.results.filter((p) => p.id !== saved.id);
      return { ...d, results: created ? [saved, ...rest] : d.results.map((p) => (p.id === saved.id ? saved : p)) };
    });

  const startFor = async (p: ApiProject) => {
    // The backend stops a running timer before starting the new one (Harvest): say so.
    const stopped = timer.running && timer.running.project !== p.id ? timer.running : null;
    try {
      await timer.start({ project: p.id, billable: true });
      setNotice(
        stopped
          ? `Đã dừng giờ của "${stopped.projectTitle}" và bắt đầu bấm giờ cho "${p.title}", chưa gắn mục tiêu tuần`
          : `Bắt đầu bấm giờ cho "${p.title}", chưa gắn mục tiêu tuần`,
      );
      // totals change when a timer starts or stops: refresh the rows and cards from the API
      projects.reload();
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    }
  };

  const loadMore = async () => {
    if (!projects.data?.next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(projects);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const openNew = (initial?: ApiItemStatus) => {
    setEditing(null);
    setNewStatus(initial);
    setDialogOpen(true);
  };
  const openEdit = (p: ApiProject) => {
    setEditing(p);
    setDialogOpen(true);
  };
  const moveCard = async (p: ApiProject, to: ApiItemStatus, via: 'drag' | 'menu') => {
    if (via === 'menu') setFocusId(p.id);
    const ok = await moves.move(p, to);
    // back in its old lane the card is a new element again: the focus follows it there
    if (!ok && via === 'menu') setFocusId(p.id);
  };
  const clearFocus = useCallback(() => setFocusId(null), []);

  const filtered = view === 'list' && status !== 'all';
  // Unfiltered and empty: the first-run panel carries the one "Thêm dự án"; no toolbar until a project exists (D26).
  const toolbar = useToolbarState({
    rows: all.length,
    filtered,
    loading: projects.loading,
    failed: !!projects.error && !projects.data,
    count: 'projects',
  });
  const anyMinutes = (view === 'list' ? list : all).some((p) => p.minutesTotal > 0);

  return (
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6 px-4 pb-12 sm:px-8')}>
      <TimerPanel
        compact
        timer={timer}
        projects={choices}
        objectives={objectives}
        onChanged={(message) => {
          setNotice(message);
          projects.reload();
        }}
      />

      {toolbar !== 'hide' && (
        // At 390 px the view switch and "Thêm dự án" keep the first row; the list's filter takes the second
        <div className={cn('flex flex-wrap items-center gap-2', toolbar === 'wait' && 'invisible')}>
          <Tabs value={view} onValueChange={(v) => setView(v as ProjectsView)}>
            <TabsList aria-label="Kiểu xem">
              <TabsTab value="list">
                <List aria-hidden />
                Danh sách
              </TabsTab>
              <TabsTab value="board">
                <SquareKanban aria-hidden />
                Bảng
              </TabsTab>
            </TabsList>
          </Tabs>
          {view === 'list' && (
            <ChoiceSelect
              label="Trạng thái"
              value={status}
              onChange={setStatus}
              choices={statusChoices}
              className="order-last w-full sm:order-none sm:w-auto"
            />
          )}
          <Button className="ms-auto shrink-0" onClick={() => openNew()}>
            <Plus aria-hidden />
            Thêm dự án
          </Button>
        </div>
      )}

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      {/* Moves are announced here, not in the visible notice: a line appearing above the board would push it down */}
      <p className="sr-only" role="status">
        {moves.announcement}
      </p>
      {moves.failure && <MoveFailedAlert failure={moves.failure} onClose={moves.dismissFailure} />}

      <ApiStaleAlert result={projects} />
      {projects.error && !projects.data ? (
        <ApiErrorState error={projects.error} onRetry={projects.reload} />
      ) : !projects.data ? (
        view === 'board' ? (
          <BoardSkeleton />
        ) : (
          <RowsSkeleton />
        )
      ) : all.length === 0 && !filtered ? (
        <EmptyPanel
          glyph={FolderPlus}
          title="Chưa có dự án nào"
          text="Thêm dự án freelance với khách và giá; giờ làm sẽ cho ra giá giờ thực tế."
          action={
            <Button onClick={() => openNew()}>
              <Plus aria-hidden />
              Thêm dự án
            </Button>
          }
          guide="work"
        />
      ) : list.length === 0 && filtered ? (
        <p className="text-sm text-muted-foreground">
          Không có mục nào khớp bộ lọc.{' '}
          <Button variant="link" size="sm" className="px-0" onClick={() => setStatus('all')}>
            Xóa bộ lọc
          </Button>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {anyMinutes && <BillableLegend className="justify-end" />}
          {view === 'board' ? (
            <ProjectBoard
              projects={all}
              ranks={moves.ranks}
              pending={moves.pending}
              runningId={runningId}
              focusId={focusId}
              onFocused={clearFocus}
              onEdit={openEdit}
              onStart={(p) => void startFor(p)}
              onMove={(p, to, via) => void moveCard(p, to, via)}
              onAdd={openNew}
            />
          ) : (
            <ProjectList projects={list} runningId={runningId} onEdit={openEdit} onStart={(p) => void startFor(p)} />
          )}
        </div>
      )}
      {/* Only past the 20-page cap of loadProjects */}
      {projects.data?.next && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          Tải thêm
        </Button>
      )}

      <ProjectDialog
        open={dialogOpen}
        project={editing}
        initialStatus={newStatus}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          upsert(saved, created);
          // a new project, or one whose status changed, lands on top of its lane like a moved card
          if (created || editing?.status !== saved.status) moves.bump(saved.id);
          setDialogOpen(false);
          setNotice(created ? `Đã thêm "${saved.title}"` : `Đã lưu "${saved.title}"`);
        }}
      />
    </div>
  );
}
