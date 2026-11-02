'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock, Loader2, Pencil, Plus, Target, Trash2, X } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { workApi, type ApiTimeEntry } from '@/lib/api/work';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { addDays, formatDay, formatMinutes, isTyping } from './format';
import { TimeEntryDialog } from './time-entry-dialog';
import { TimerPanel } from './timer-panel';
import { useProjectChoices, useTimer, useWeekObjectives } from './use-work';
import { WeekSummary } from './week-summary';

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function EntryRow({
  entry: e,
  objectiveTitle,
  onEdit,
  onDelete,
}: {
  entry: ApiTimeEntry;
  objectiveTitle: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <p className="text-sm font-medium break-words">{e.projectTitle}</p>
        {(e.note || e.running || !e.billable || e.objective) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {e.running && (
              <Badge variant="info">
                <Clock aria-hidden />
                Đang chạy
              </Badge>
            )}
            {!e.billable && <Badge variant="outline">Không tính tiền</Badge>}
            {e.objective && (
              <Badge variant="secondary">
                <Target aria-hidden />
                {objectiveTitle ?? 'Mục tiêu tuần'}
              </Badge>
            )}
            {e.note && <span className="break-words">{e.note}</span>}
          </div>
        )}
      </div>
      <span className="ms-auto text-sm font-medium tabular-nums">{e.running ? '—' : formatMinutes(e.minutes)}</span>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Sửa giờ của ${e.projectTitle}`}>
          <Pencil aria-hidden />
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label={`Xóa giờ của ${e.projectTitle}`}>
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}

function DeleteDialog({
  entry,
  onOpenChange,
  onDeleted,
}: {
  entry: ApiTimeEntry | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (entry: ApiTimeEntry) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      await workApi.deleteTimeEntry(entry.id);
      onDeleted(entry);
    } catch (err) {
      const e = toApiError(err);
      // 404: already gone (deleted elsewhere); drop it from the list as well.
      if (e.status === 404 && e.reachable) onDeleted(entry);
      else setError(describeApiError(e).title);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) setError(null);
        onOpenChange(open);
      }}
    >
      <DialogPopup closeProps={{ 'aria-label': 'Đóng' }}>
        <DialogHeader>
          <DialogTitle>Xóa mục giờ này?</DialogTitle>
          <DialogDescription>
            {entry &&
              (entry.running
                ? `Bộ bấm giờ của "${entry.projectTitle}" đang chạy sẽ bị hủy, không ghi phút nào.`
                : `${formatMinutes(entry.minutes)} cho "${entry.projectTitle}" ngày ${formatDay(entry.date)}. Không hoàn tác được.`)}
          </DialogDescription>
          {error && (
            <p className="text-sm text-destructive-foreground" role="alert">
              {error}
            </p>
          )}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" type="button" />}>Hủy</DialogClose>
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Xóa
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
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
  const [deleting, setDeleting] = useState<ApiTimeEntry | null>(null);
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

  // N opens "Nhập giờ" (T, the timer key, lives in TimerPanel).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || e.key.toLowerCase() !== 'n') return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      setEditing(null);
      setDialogOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  return (
    <div className="flex flex-col gap-5 px-4 pb-12 sm:px-8">
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
        <div className="flex flex-wrap items-end gap-2">
          <h2 id="time-entries-title" className="me-auto font-heading text-lg font-semibold tracking-tight">
            Các mục giờ
          </h2>
          <Button onClick={openNew}>
            <Plus aria-hidden />
            Nhập giờ <Kbd className="bg-transparent text-current">N</Kbd>
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Bộ lọc">
          <div className="flex flex-col gap-1">
            <Label htmlFor="time-filter-project" className="text-xs text-muted-foreground">
              Dự án
            </Label>
            <ChoiceSelect
              id="time-filter-project"
              label="Dự án"
              value={project}
              onChange={setProject}
              choices={projectChoices}
              className="w-auto min-w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="time-filter-from" className="text-xs text-muted-foreground">
              Từ ngày
            </Label>
            <Input id="time-filter-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="time-filter-to" className="text-xs text-muted-foreground">
              Đến ngày
            </Label>
            <Input id="time-filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {filtered && (
            <Button
              variant="ghost"
              onClick={() => {
                setProject('all');
                setFrom('');
                setTo('');
              }}
            >
              <X aria-hidden />
              Xóa lọc
            </Button>
          )}
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
          <LoadingCards />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Clock aria-hidden />}
            title={filtered ? 'Không có mục giờ nào khớp bộ lọc' : 'Chưa có giờ nào'}
            description={filtered ? undefined : 'Bấm giờ ở trên, hoặc nhập tay giờ đã làm.'}
          >
            {!filtered && (
              <Button onClick={openNew}>
                <Plus aria-hidden />
                Nhập giờ
              </Button>
            )}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {days.map((d) => (
              <Card key={d.date} render={<section aria-label={formatDay(d.date)} />} className="rounded-3xl border p-2">
                <div className="flex items-baseline justify-between gap-2 rounded-2xl bg-secondary px-3 py-2 sm:px-4">
                  <h3 className="text-sm font-semibold">{formatDay(d.date)}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatMinutes(d.minutes)}</span>
                </div>
                <ul className="divide-y">
                  {d.entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      objectiveTitle={e.objective ? (objectiveTitles.get(e.objective) ?? null) : null}
                      onEdit={() => {
                        setEditing(e);
                        setDialogOpen(true);
                      }}
                      onDelete={() => setDeleting(e)}
                    />
                  ))}
                </ul>
              </Card>
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

      <DeleteDialog
        entry={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={(gone) => {
          entries.mutate((d) => d && { ...d, results: d.results.filter((e) => e.id !== gone.id) });
          setDeleting(null);
          changed(`Đã xóa mục giờ của "${gone.projectTitle}"`);
          if (gone.running) timer.reload();
        }}
      />
    </div>
  );
}
