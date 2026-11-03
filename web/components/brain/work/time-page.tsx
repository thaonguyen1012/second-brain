'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Clock, FolderPlus, Pencil, Plus, X } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { workApi, type ApiTimeEntry } from '@/lib/api/work';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyStateGuide } from '@/components/stageshow/lazy';
import { ApiErrorState, ApiStaleAlert, EmptyState, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { ConfirmDelete, DeleteButton } from '../confirm-delete';
import { addDays, formatDay, formatMinutes, isTyping } from './format';
import { RowsSkeleton } from './rows-skeleton';
import { TimeEntryDialog } from './time-entry-dialog';
import { TimerPanel } from './timer-panel';
import { useProjectChoices, useTimer, useWeekObjectives } from './use-work';
import { WeekSummary } from './week-summary';

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Icon-only row action with its tooltip (DESIGN.md D21). */
function IconTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

const ENTRY_GRID = 'grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-3 px-3';

function EntryRow({
  entry: e,
  objectiveTitle,
  onEdit,
  onDeleted,
}: {
  entry: ApiTimeEntry;
  objectiveTitle: string | null;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const meta = [
    !e.billable && 'Không tính tiền',
    e.objective && `Mục tiêu: ${objectiveTitle ?? 'mục tiêu tuần'}`,
    e.note,
  ].filter(Boolean);
  return (
    <li className={cn(ENTRY_GRID, 'min-h-10 py-2')}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium break-words">{e.projectTitle}</p>
        {(e.running || meta.length > 0) && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {e.running && <StatusBadge tone="info">Đang chạy</StatusBadge>}
            {meta.length > 0 && <span className="break-words">{meta.join(' · ')}</span>}
          </p>
        )}
      </div>
      <span className="text-end text-sm font-medium tabular-nums">{e.running ? '—' : formatMinutes(e.minutes)}</span>
      <div className="flex items-center gap-1">
        <IconTip label="Sửa">
          <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Sửa giờ của ${e.projectTitle}`}>
            <Pencil aria-hidden />
          </Button>
        </IconTip>
        <Tooltip>
          <ConfirmDelete
            title="Xóa mục giờ này?"
            description={
              e.running
                ? `Bộ bấm giờ của "${e.projectTitle}" đang chạy sẽ bị hủy, không ghi phút nào.`
                : `${formatMinutes(e.minutes)} cho "${e.projectTitle}" ngày ${formatDay(e.date)}. Không hoàn tác được.`
            }
            action={async () => {
              try {
                await workApi.deleteTimeEntry(e.id);
              } catch (err) {
                // 404: already gone (deleted elsewhere); drop it from the list as well.
                const apiErr = toApiError(err);
                if (!(apiErr.reachable && apiErr.status === 404)) throw err;
              }
            }}
            onDeleted={onDeleted}
            focusNeighbour
            trigger={
              <TooltipTrigger
                render={<DeleteButton size="icon-sm" label="" aria-label={`Xóa giờ của ${e.projectTitle}`} />}
              />
            }
          />
          <TooltipPopup>Xóa</TooltipPopup>
        </Tooltip>
      </div>
    </li>
  );
}

/** Giờ: the timer, the week summary and the time entries with project and date-range filters. */
export function TimePage() {
  const params = useSearchParams();
  const [project, setProject] = useState(() => {
    const p = params.get('project');
    return p && /^\d+$/.test(p) ? p : 'all';
  });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<ApiTimeEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [summaryKey, setSummaryKey] = useState(0);

  const choices = useProjectChoices();
  const week = useWeekObjectives();
  const timer = useTimer();

  const badRange = isDay(from) && isDay(to) && from > to;
  const query = {
    limit: 100,
    ...(project !== 'all' && { project: Number(project) }),
    ...(isDay(from) && { from }),
    ...(isDay(to) && { to }),
  };
  const entries = useApi<Page<ApiTimeEntry>>(badRange ? null : `work:entries:${JSON.stringify(query)}`, () =>
    workApi.listTimeEntries(query),
  );
  const hide = entries.loading || badRange;
  const list = useMemo(() => (hide ? [] : (entries.data?.results ?? [])), [hide, entries.data]);
  const filtered = project !== 'all' || !!from || !!to;

  const objectiveTitles = useMemo(() => new Map(week.objectives.map((o) => [o.id, o.title])), [week.objectives]);
  const days = useMemo(() => {
    const out: { date: string; entries: ApiTimeEntry[]; minutes: number }[] = [];
    for (const e of list) {
      const last = out.at(-1);
      if (last?.date === e.date) last.entries.push(e);
      else out.push({ date: e.date, entries: [e], minutes: 0 });
      out.at(-1)!.minutes += e.minutes ?? 0;
    }
    return out;
  }, [list]);

  const matches = (e: ApiTimeEntry) =>
    (project === 'all' || e.project === Number(project)) && (!isDay(from) || e.date >= from) && (!isDay(to) || e.date <= to);

  /**
   * Keeps the list in date order after a local change (newest date first, then newest id). With more pages
   * on the server, an entry that sorts after the last loaded row is left for "Tải thêm" to bring (adding it
   * here would show it twice and count its minutes twice).
   */
  const upsert = (saved: ApiTimeEntry) =>
    entries.mutate((d) => {
      if (!d) return d;
      const order = (a: ApiTimeEntry, b: ApiTimeEntry) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1);
      const rest = d.results.filter((e) => e.id !== saved.id);
      const last = rest.at(-1);
      const loaded = !d.next || (last !== undefined && order(saved, last) < 0);
      const results = matches(saved) && loaded ? [...rest, saved] : rest;
      results.sort(order);
      return { ...d, results };
    });

  const changed = (message: string) => {
    setNotice(message);
    setSummaryKey((k) => k + 1);
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  // No project yet: nothing can be timed or entered, the page shows one empty state instead (D26).
  const noProjects = !!choices.data && choices.projects.length === 0;
  const projectsLoading = !choices.data && !choices.error;

  // N opens "Nhập giờ" (T, the timer key, lives in TimerPanel).
  useEffect(() => {
    if (noProjects) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || e.key.toLowerCase() !== 'n') return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setEditing(null);
      setDialogOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [noProjects]);

  const loadMore = async () => {
    const next = entries.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(entries);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const projectChoices = [
    { value: 'all', label: 'Mọi dự án' },
    ...choices.projects.map((p) => ({ value: String(p.id), label: p.title })),
  ];
  // Keep a filter from the URL selectable while the projects load (or if it is not in the first 200).
  if (project !== 'all' && !projectChoices.some((c) => c.value === project))
    projectChoices.push({ value: project, label: `Dự án #${project}` });

  const clearFilters = () => {
    setProject('all');
    setFrom('');
    setTo('');
  };
  const removeEntry = (gone: ApiTimeEntry) => {
    entries.mutate((d) => d && { ...d, results: d.results.filter((e) => e.id !== gone.id) });
    changed(`Đã xóa mục giờ của "${gone.projectTitle}"`);
    if (gone.running) timer.reload();
  };
  // Unfiltered and empty: the empty state's "Nhập giờ" is the one primary; the toolbar's drops to outline (D2).
  const emptyUnfiltered =
    !filtered && !badRange && !entries.loading && !!entries.data && !entries.error && list.length === 0;
  const addVariant = emptyUnfiltered ? 'outline' : 'default';

  if (noProjects)
    return (
      <div className="flex flex-col gap-6 px-4 pb-12 sm:px-8">
        <EmptyState
          icon={<FolderPlus aria-hidden />}
          title="Chưa có dự án nào"
          description="Bấm giờ cần ít nhất một dự án."
        >
          <Button render={<Link href="/cong-viec/" />}>
            <Plus aria-hidden />
            Thêm dự án
          </Button>
        </EmptyState>
        {/* Without a project the "Chưa có giờ nào" branch is never reached: the timer guide shows here instead */}
        <EmptyStateGuide guide="work" />
      </div>
    );

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 sm:px-8">
      {projectsLoading ? (
        <Skeleton className="h-24 rounded-xl" aria-label="Đang tải bộ bấm giờ" />
      ) : (
        <TimerPanel
          timer={timer}
          projects={choices.projects.filter((p) => p.status === 'active' || p.status === 'planned')}
          objectives={week.objectives}
          preferredProject={project === 'all' ? null : Number(project)}
          onChanged={(message) => {
            changed(message);
            entries.reload();
          }}
        />
      )}

      <WeekSummary
        refreshKey={summaryKey}
        onSelectProject={(id, weekStart) => {
          setProject(String(id));
          setFrom(weekStart);
          setTo(addDays(weekStart, 6));
          document.getElementById('time-entries')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      <section id="time-entries" aria-labelledby="time-entries-title" className="flex scroll-mt-20 flex-col gap-4">
        <h2 id="time-entries-title" className="font-heading text-lg font-semibold tracking-tight">
          Các mục giờ
        </h2>
        {/* One toolbar of h-8 controls: filters left, "Nhập giờ" right. At 390 px: project + Nhập giờ, then the dates. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
          <ChoiceSelect
            id="time-filter-project"
            label="Lọc theo dự án"
            value={project}
            onChange={setProject}
            choices={projectChoices}
            className="min-w-0 sm:w-auto sm:min-w-40"
          />
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex">
            <Label htmlFor="time-filter-from" className="sr-only">
              Từ ngày
            </Label>
            <Input
              id="time-filter-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="sm:w-auto"
            />
            <Label htmlFor="time-filter-to" className="sr-only">
              Đến ngày
            </Label>
            <Input
              id="time-filter-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="sm:w-auto"
            />
          </div>
          {filtered && (
            <Button variant="ghost" className="col-span-2 justify-self-start" onClick={clearFilters}>
              <X aria-hidden />
              Xóa bộ lọc
            </Button>
          )}
          <Button
            variant={addVariant}
            className="col-start-2 row-start-1 sm:ms-auto"
            onClick={openNew}
            aria-keyshortcuts="n"
          >
            <Plus aria-hidden />
            Nhập giờ
            <Kbd
              className={cn(
                'pointer-coarse:hidden max-sm:hidden',
                addVariant === 'default' && 'bg-primary-foreground/20 text-primary-foreground',
              )}
            >
              N
            </Kbd>
          </Button>
        </div>

        {notice && (
          <p className="text-sm text-muted-foreground" role="status">
            {notice}
          </p>
        )}

        <ApiStaleAlert result={entries} />
        {badRange ? (
          <p className="text-sm text-destructive-foreground" role="alert">
            &quot;Từ ngày&quot; phải trước hoặc bằng &quot;Đến ngày&quot;.
          </p>
        ) : entries.error && !entries.data ? (
          <ApiErrorState error={entries.error} onRetry={entries.reload} />
        ) : entries.loading && list.length === 0 ? (
          <RowsSkeleton />
        ) : list.length === 0 && filtered ? (
          <p className="text-sm text-muted-foreground">
            Không có mục nào khớp bộ lọc.{' '}
            <Button variant="link" size="sm" className="px-0" onClick={clearFilters}>
              Xóa bộ lọc
            </Button>
          </p>
        ) : list.length === 0 ? (
          <>
            <EmptyState
              icon={<Clock aria-hidden />}
              title="Chưa có giờ nào"
              description="Bấm giờ ở trên, hoặc nhập tay giờ đã làm."
            >
              <Button onClick={openNew}>
                <Plus aria-hidden />
                Nhập giờ
              </Button>
            </EmptyState>
            {entries.data && !entries.error && <EmptyStateGuide guide="work" />}
          </>
        ) : (
          <div className="flex flex-col divide-y rounded-xl border bg-card">
            {days.map((d) => (
              <section key={d.date} aria-label={formatDay(d.date)} className="flex flex-col">
                <div className="flex h-8 items-center justify-between px-3 text-xs font-medium text-muted-foreground">
                  <h3>{formatDay(d.date)}</h3>
                  <span className="tabular-nums">{formatMinutes(d.minutes)}</span>
                </div>
                <ul className="flex flex-col divide-y border-t">
                  {d.entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      objectiveTitle={e.objective ? (objectiveTitles.get(e.objective) ?? null) : null}
                      onEdit={() => {
                        setEditing(e);
                        setDialogOpen(true);
                      }}
                      onDeleted={() => removeEntry(e)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {entries.data?.next && !entries.loading && !badRange && (
          <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
            Tải thêm
          </Button>
        )}
      </section>

      <TimeEntryDialog
        open={dialogOpen}
        entry={editing}
        projects={choices.projects}
        objectives={week.objectives}
        defaultProject={project === 'all' ? null : Number(project)}
        loadError={choices.error && !choices.data ? describeApiError(choices.error).title : null}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          upsert(saved);
          setDialogOpen(false);
          changed(
            created
              ? `Đã thêm ${formatMinutes(saved.minutes)} cho "${saved.projectTitle}"`
              : `Đã lưu mục giờ của "${saved.projectTitle}"`,
          );
          if (saved.running) timer.reload();
        }}
      />
    </div>
  );
}
