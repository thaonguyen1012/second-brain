'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Pencil, Plus, X } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { workApi, type ApiTimeEntry } from '@/lib/api/work';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { singleKeyShortcut } from '@/lib/single-key-shortcuts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyStateGuide } from '@/components/stageshow/lazy';
import { ApiErrorState, ApiStaleAlert, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { ConfirmDelete, DeleteButton } from '../confirm-delete';
import { useToolbarState } from '../empty-panel';
import { PAGE_WIDTH } from '../layout';
import { addDays, formatDay, formatMinutes } from './format';
import { ProjectDialog } from './project-dialog';
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
  const t = useT();
  const meta = [
    !e.billable && t('Không tính tiền'),
    e.objective && t('Mục tiêu: {title}', { title: objectiveTitle ?? t('mục tiêu tuần') }),
    e.note,
  ].filter(Boolean);
  // The buttons' names: a project has many entries, several on one day (each stop of the timer makes one), so they
  // say the day and the duration too, as the row and its day heading show them (the running one, the only timer, says
  // that it runs)
  const which = { title: e.projectTitle, day: formatDay(e.date, t), time: formatMinutes(e.minutes, t) };
  return (
    <li className={cn(ENTRY_GRID, 'min-h-10 py-2')}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium break-words">{e.projectTitle}</p>
        {(e.running || meta.length > 0) && (
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {e.running && <StatusBadge tone="info">{t('Đang chạy')}</StatusBadge>}
            {meta.length > 0 && <span className="break-words">{meta.join(' · ')}</span>}
          </p>
        )}
      </div>
      <span className="text-end text-sm font-medium tabular-nums">{e.running ? '—' : formatMinutes(e.minutes, t)}</span>
      <div className="flex items-center gap-1">
        <IconTip label={t('Sửa')}>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onEdit}
            aria-label={
              e.running
                ? t('Sửa giờ của {title} ngày {day} (đang chạy)', which)
                : t('Sửa giờ của {title} ngày {day} ({time})', which)
            }
          >
            <Pencil aria-hidden />
          </Button>
        </IconTip>
        <Tooltip>
          <ConfirmDelete
            title={t('Xóa mục giờ này?')}
            description={
              e.running
                ? t('Bộ bấm giờ của "{title}" đang chạy sẽ bị hủy, không ghi phút nào.', { title: e.projectTitle })
                : t('{time} cho "{title}" ngày {day}. Không hoàn tác được.', {
                    time: formatMinutes(e.minutes, t),
                    title: e.projectTitle,
                    day: formatDay(e.date, t),
                  })
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
            trigger={
              <TooltipTrigger
                render={
                  <DeleteButton
                    size="icon-sm"
                    label=""
                    aria-label={
                      e.running
                        ? t('Xóa giờ của {title} ngày {day} (đang chạy)', which)
                        : t('Xóa giờ của {title} ngày {day} ({time})', which)
                    }
                  />
                }
              />
            }
          />
          <TooltipPopup>{t('Xóa')}</TooltipPopup>
        </Tooltip>
      </div>
    </li>
  );
}

/** Giờ: the timer, the week summary and the time entries with project and date-range filters. */
export function TimePage() {
  const t = useT();
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
  const [projectDialog, setProjectDialog] = useState(false);
  // A project added from the timer is picked there at once, so "Bắt đầu" works right after the dialog.
  const [createdProject, setCreatedProject] = useState<number | null>(null);

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

  // No project yet: the timer still shows, waiting, with "Thêm dự án" in place of the picker; no entry list.
  const noProjects = !!choices.data && choices.projects.length === 0;
  const projectsLoading = !choices.data && !choices.error;
  // While the projects load, the sidebar count tells whether "no project yet" is coming, so the entries' toolbar does
  // not show and then give way to the guide (the list pages' rule, empty-panel.tsx).
  const entriesShown =
    useToolbarState({
      rows: choices.projects.length,
      filtered: false,
      loading: projectsLoading,
      failed: !!choices.error && !choices.data,
      count: 'projects',
    }) === 'show';
  // The timer offers open projects only; with none (first run, or all done) it offers "Thêm dự án" instead.
  const openProjects = choices.projects.filter((p) => p.status === 'active' || p.status === 'planned');

  // N opens "Nhập giờ" (T, the timer key, lives in TimerPanel).
  useEffect(() => {
    if (noProjects) return;
    const onKey = (e: KeyboardEvent) => {
      if (!singleKeyShortcut(e) || e.key.toLowerCase() !== 'n') return;
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
      setNotice(describeApiError(toApiError(err), t).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const projectChoices = [
    { value: 'all', label: t('Mọi dự án') },
    ...choices.projects.map((p) => ({ value: String(p.id), label: p.title })),
  ];
  // Keep a filter from the URL selectable while the projects load (or if it is not in the first 200).
  if (project !== 'all' && !projectChoices.some((c) => c.value === project))
    projectChoices.push({ value: project, label: t('Dự án #{id}', { id: project }) });

  const clearFilters = () => {
    setProject('all');
    setFrom('');
    setTo('');
  };
  const removeEntry = (gone: ApiTimeEntry) => {
    entries.mutate((d) => d && { ...d, results: d.results.filter((e) => e.id !== gone.id) });
    changed(t('Đã xóa mục giờ của "{title}"', { title: gone.projectTitle }));
    if (gone.running) timer.reload();
  };
  // Unfiltered and empty: no toolbar (D26), one line with an outline "Nhập giờ"; "Bắt đầu" stays the one primary.
  const emptyUnfiltered =
    !filtered && !badRange && !entries.loading && !!entries.data && !entries.error && list.length === 0;
  // Always an element where it shows: a status region mounted before its text is read out when the text arrives
  const noticeLine = (
    <p className="text-sm text-muted-foreground empty:sr-only" role="status">
      {notice}
    </p>
  );
  const nhapGio = (variant: 'default' | 'outline', className?: string) => (
    <Button variant={variant} className={className} onClick={openNew} aria-keyshortcuts="n">
      <Plus aria-hidden />
      {t('Nhập giờ')}
      <Kbd
        className={cn(
          'pointer-coarse:hidden max-sm:hidden',
          variant === 'default' && 'bg-primary-foreground/20 text-primary-foreground',
        )}
      >
        N
      </Kbd>
    </Button>
  );

  return (
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6 px-4 pb-12 sm:px-8')}>
      {projectsLoading ? (
        <Skeleton className="h-24 rounded-xl" role="status" aria-busy="true" aria-label={t('Đang tải bộ bấm giờ')} />
      ) : choices.error && !choices.data && !timer.running ? (
        // Unknown project list: say so, never "Chưa có dự án" (it would invite a duplicate project)
        <ApiErrorState error={choices.error} onRetry={choices.reload} />
      ) : (
        <TimerPanel
          timer={timer}
          projects={openProjects}
          objectives={week.objectives}
          preferredProject={createdProject ?? (project === 'all' ? null : Number(project))}
          onChanged={(message) => {
            changed(message);
            entries.reload();
          }}
          onAddProject={choices.data && openProjects.length === 0 ? () => setProjectDialog(true) : undefined}
          noProjectLabel={noProjects ? t('Chưa có dự án') : t('Không có dự án đang mở')}
        />
      )}
      {(noProjects || emptyUnfiltered) && noticeLine}

      <WeekSummary
        refreshKey={summaryKey}
        onSelectProject={(id, weekStart) => {
          setProject(String(id));
          setFrom(weekStart);
          setTo(addDays(weekStart, 6));
          document.getElementById('time-entries')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      {noProjects ? (
        // Nothing can be entered yet; the how-to stays one click away
        <EmptyStateGuide guide="work" />
      ) : !entriesShown ? null : emptyUnfiltered ? (
        <section aria-labelledby="time-entries-title" className="flex flex-col items-start gap-3">
          <h2 id="time-entries-title" className="font-heading text-lg font-semibold tracking-tight">
            {t('Các mục giờ')}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm text-muted-foreground">
              {t('Chưa có giờ nào. Bấm giờ ở trên, hoặc nhập tay giờ đã làm.')}
            </p>
            {nhapGio('outline')}
          </div>
          <EmptyStateGuide guide="work" className="w-full" />
        </section>
      ) : (
        <section id="time-entries" aria-labelledby="time-entries-title" className="flex flex-col gap-4">
          <h2 id="time-entries-title" className="font-heading text-lg font-semibold tracking-tight">
            {t('Các mục giờ')}
          </h2>
          {/* One toolbar of h-8 controls: filters left, "Nhập giờ" right. At 390 px: project + Nhập giờ, then the dates. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
            <ChoiceSelect
              id="time-filter-project"
              label={t('Lọc theo dự án')}
              value={project}
              onChange={setProject}
              choices={projectChoices}
              className="min-w-0 sm:w-auto sm:min-w-40"
            />
            <div className="col-span-2 grid grid-cols-2 gap-2 sm:flex">
              <Label htmlFor="time-filter-from" className="sr-only">
                {t('Từ ngày')}
              </Label>
              <Input
                id="time-filter-from"
                type="date"
                aria-invalid={badRange || undefined}
                aria-describedby={badRange ? 'time-filter-range-error' : undefined}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="sm:w-auto"
              />
              <Label htmlFor="time-filter-to" className="sr-only">
                {t('Đến ngày')}
              </Label>
              <Input
                id="time-filter-to"
                type="date"
                aria-invalid={badRange || undefined}
                aria-describedby={badRange ? 'time-filter-range-error' : undefined}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="sm:w-auto"
              />
            </div>
            {filtered && (
              <Button variant="ghost" className="col-span-2 justify-self-start" onClick={clearFilters}>
                <X aria-hidden />
                {t('Xóa bộ lọc')}
              </Button>
            )}
            {nhapGio('default', 'col-start-2 row-start-1 sm:ms-auto')}
          </div>

          {noticeLine}

          <ApiStaleAlert result={entries} />
          {badRange ? (
            // both dates name it as their error
            <p id="time-filter-range-error" className="text-sm text-destructive-foreground" role="alert">
              {t('"Từ ngày" phải trước hoặc bằng "Đến ngày".')}
            </p>
          ) : entries.error && !entries.data ? (
            <ApiErrorState error={entries.error} onRetry={entries.reload} />
          ) : entries.loading && list.length === 0 ? (
            <RowsSkeleton />
          ) : list.length === 0 && filtered ? (
            <p className="text-sm text-muted-foreground">
              {t('Không có mục nào khớp bộ lọc.')}{' '}
              <Button variant="link" size="sm" className="px-0 underline" onClick={clearFilters}>
                {t('Xóa bộ lọc')}
              </Button>
            </p>
          ) : (
            // data-row-groups: a day goes with its last entry, so a delete moves the focus on to the next day's entry
            <div data-row-groups className="flex flex-col divide-y rounded-xl border bg-card">
              {days.map((d) => (
                <section key={d.date} aria-label={formatDay(d.date, t)} className="flex flex-col">
                  <div className="flex h-8 items-center justify-between px-3 text-xs font-medium text-muted-foreground">
                    <h3>{formatDay(d.date, t)}</h3>
                    <span className="tabular-nums">{formatMinutes(d.minutes, t)}</span>
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
              {t('Tải thêm')}
            </Button>
          )}
        </section>
      )}

      <ProjectDialog
        open={projectDialog}
        project={null}
        onOpenChange={setProjectDialog}
        onSaved={(saved, _created, imageError) => {
          choices.mutate((d) => d && { ...d, results: [saved, ...d.results.filter((p) => p.id !== saved.id)] });
          setCreatedProject(saved.id);
          setProjectDialog(false);
          const added = t('Đã thêm "{title}".', { title: saved.title });
          const logo = imageError ? ` ${t('Chưa lưu được logo: {error}.', { error: imageError })}` : '';
          setNotice(
            saved.status === 'active' || saved.status === 'planned'
              ? `${added}${logo} ${t('Bấm Bắt đầu để bấm giờ.')}`
              : `${added}${logo}`,
          );
        }}
      />
      <TimeEntryDialog
        open={dialogOpen}
        entry={editing}
        projects={choices.projects}
        objectives={week.objectives}
        defaultProject={project === 'all' ? null : Number(project)}
        loadError={choices.error && !choices.data ? describeApiError(choices.error, t).title : null}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          upsert(saved);
          setDialogOpen(false);
          changed(
            created
              ? t('Đã thêm {time} cho "{title}"', { time: formatMinutes(saved.minutes, t), title: saved.projectTitle })
              : t('Đã lưu mục giờ của "{title}"', { title: saved.projectTitle }),
          );
          if (saved.running) timer.reload();
        }}
      />
    </div>
  );
}
