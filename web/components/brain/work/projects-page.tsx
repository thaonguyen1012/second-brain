'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, FolderPlus, Pencil, Play, Plus } from 'lucide-react';
import type { ApiItemStatus, Page } from '@/lib/api/client';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { workApi, type ApiProject } from '@/lib/api/work';
import { itemStatusOf, itemStatuses } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MenuItem, MenuLinkItem } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyStateGuide } from '@/components/stageshow/lazy';
import { ApiErrorState, ApiStaleAlert, EmptyState, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { RowMenu } from '../row-menu';
import { BillableLegend, MiniBillableBar } from './billable-bar';
import { formatHours, formatMoney } from './format';
import { ProjectDialog } from './project-dialog';
import { RowsSkeleton } from './rows-skeleton';
import { TimerPanel } from './timer-panel';
import { sortProjectChoices, useProjectChoices, useTimer, useWeekObjectives } from './use-work';

type StatusFilter = ApiItemStatus | 'all';
const statusChoices = [{ value: 'all' as const, label: 'Mọi trạng thái' }, ...itemStatuses];

/** One grid for the header and every row, so the number columns line up (DESIGN.md §3 "Columns"). */
const ROW_GRID =
  'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 md:grid-cols-[5rem_minmax(0,1fr)_6rem_8rem_8rem_auto]';

function agreedPrice(p: ApiProject): string {
  return (
    (p.billing === 'hourly'
      ? p.hourlyRate && `${formatMoney(p.hourlyRate, p.currency)}/giờ`
      : p.price && `${formatMoney(p.price, p.currency)} trọn gói`) || 'chưa có giá'
  );
}

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
  const canStart = !running && (p.status === 'active' || p.status === 'planned');
  const meta = [p.client || 'Chưa ghi khách', agreedPrice(p)].join(' · ');
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
          {meta}
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
        {canStart ? (
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

/** Dự án: projects with client, billing and price, earned and effective hourly rate (Harvest style). */
export function ProjectsPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<ApiProject | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const projects = useApi<Page<ApiProject>>(`work:projects:${status}`, () =>
    workApi.listProjects({ limit: 100, ...(status !== 'all' && { status }) }),
  );
  // With no status filter the page list already holds every project: build the timer choices from it
  // instead of asking the API for the same rows (with their rate aggregates) a second time.
  const choices = useProjectChoices(status !== 'all');
  const { objectives } = useWeekObjectives();
  const timer = useTimer();

  const list = projects.loading ? [] : (projects.data?.results ?? []);
  const allProjects = useMemo(
    () => (status === 'all' ? sortProjectChoices(projects.data?.results ?? []) : choices.projects),
    [status, projects.data, choices.projects],
  );
  const upsert = (saved: ApiProject, created: boolean) =>
    projects.mutate((d) => {
      if (!d) return d;
      const rest = d.results.filter((p) => p.id !== saved.id);
      if (status !== 'all' && saved.status !== status) return { ...d, results: rest };
      return { ...d, results: created ? [saved, ...rest] : d.results.map((p) => (p.id === saved.id ? saved : p)) };
    });

  /** Totals change when a timer stops: refresh the cards from the API. */
  const refresh = () => {
    projects.reload();
    if (status !== 'all') choices.reload();
  };

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
      refresh();
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    }
  };

  const loadMore = async () => {
    const next = projects.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(projects);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const filtered = status !== 'all';
  // Unfiltered and empty: "Thêm dự án" in the empty state is the one primary; the toolbar's drops to outline.
  const emptyUnfiltered = !filtered && !projects.loading && !!projects.data && !projects.error && list.length === 0;
  const anyMinutes = list.some((p) => p.minutesTotal > 0);

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 sm:px-8">
      <TimerPanel
        compact
        timer={timer}
        projects={allProjects.filter((p) => p.status === 'active' || p.status === 'planned')}
        objectives={objectives}
        onChanged={(message) => {
          setNotice(message);
          refresh();
        }}
      />

      <div className="flex items-center gap-2">
        <ChoiceSelect
          label="Trạng thái"
          value={status}
          onChange={setStatus}
          choices={statusChoices}
          className="min-w-0 flex-1 sm:w-auto sm:flex-none"
        />
        <Button variant={emptyUnfiltered ? 'outline' : 'default'} className="ms-auto shrink-0" onClick={openNew}>
          <Plus aria-hidden />
          Thêm dự án
        </Button>
      </div>

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={projects} />
      {projects.error && !projects.data ? (
        <ApiErrorState error={projects.error} onRetry={projects.reload} />
      ) : projects.loading && list.length === 0 ? (
        <RowsSkeleton />
      ) : list.length === 0 && filtered ? (
        <p className="text-sm text-muted-foreground">
          Không có mục nào khớp bộ lọc.{' '}
          <Button variant="link" size="sm" className="px-0" onClick={() => setStatus('all')}>
            Xóa bộ lọc
          </Button>
        </p>
      ) : list.length === 0 ? (
        <>
          <EmptyState
            icon={<FolderPlus aria-hidden />}
            title="Chưa có dự án nào"
            description="Thêm dự án freelance với khách và giá; giờ làm sẽ cho ra giá giờ thực tế."
          >
            <Button onClick={openNew}>
              <Plus aria-hidden />
              Thêm dự án
            </Button>
          </EmptyState>
          {/* The how under the unfiltered empty list (D26, stageshow README: Dự án with no status filter) */}
          {projects.data && !projects.error && <EmptyStateGuide guide="work" />}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {anyMinutes && <BillableLegend className="justify-end" />}
          <div className="flex flex-col divide-y rounded-xl border bg-card">
            <div
              className={cn(ROW_GRID, 'h-8 text-xs font-medium text-muted-foreground max-md:hidden')}
              aria-hidden
            >
              <span>Trạng thái</span>
              <span>Dự án</span>
              <span className="text-end">Giờ</span>
              <span className="text-end">Giá giờ thực tế</span>
              <span className="text-end">Đã kiếm</span>
              <span className="w-15" />
            </div>
            <ul className="flex flex-col divide-y" aria-label="Dự án">
              {list.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  running={timer.running?.project === p.id}
                  onEdit={() => {
                    setEditing(p);
                    setDialogOpen(true);
                  }}
                  onStart={() => void startFor(p)}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
      {projects.data?.next && !projects.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          Tải thêm
        </Button>
      )}

      <ProjectDialog
        open={dialogOpen}
        project={editing}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          upsert(saved, created);
          if (status !== 'all') choices.reload();
          setDialogOpen(false);
          setNotice(created ? `Đã thêm "${saved.title}"` : `Đã lưu "${saved.title}"`);
        }}
      />
    </div>
  );
}
