'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Clock, Pencil, Play, Plus } from 'lucide-react';
import type { ApiItemStatus, Page } from '@/lib/api/client';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { workApi, type ApiProject } from '@/lib/api/work';
import { itemStatusOf, itemStatuses } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError } from '../api-state';
import { BrainCard, StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { BillableBar, BillableLegend } from './billable-bar';
import { billingLabel, formatHours, formatMoney } from './format';
import { ProjectDialog } from './project-dialog';
import { TimerPanel } from './timer-panel';
import { sortProjectChoices, useProjectChoices, useTimer, useWeekObjectives } from './use-work';

type StatusFilter = ApiItemStatus | 'all';
const statusChoices = [{ value: 'all' as const, label: 'Mọi trạng thái' }, ...itemStatuses];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-lg font-semibold tabular-nums leading-6">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function ProjectCard({
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
  const agreed =
    p.billing === 'hourly'
      ? p.hourlyRate && `${formatMoney(p.hourlyRate, p.currency)}/giờ`
      : p.price && `${formatMoney(p.price, p.currency)} trọn gói`;
  return (
    <BrainCard
      badges={
        <>
          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          <Badge variant="secondary">{billingLabel(p.billing)}</Badge>
          {running && (
            <Badge variant="info">
              <Clock aria-hidden />
              Đang bấm giờ
            </Badge>
          )}
        </>
      }
      title={p.title}
      meta={[p.client ? `Khách: ${p.client}` : 'Chưa ghi khách', agreed || 'chưa có giá'].join(' · ')}
      actions={
        <>
          {!running && (p.status === 'active' || p.status === 'planned') && (
            <Button size="xs" onClick={onStart}>
              <Play aria-hidden />
              Bấm giờ
            </Button>
          )}
          <Button size="xs" variant="outline" onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </Button>
          <Button size="xs" variant="ghost" render={<Link href={`/cong-viec/gio/?project=${p.id}`} />}>
            Xem giờ
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Đã kiếm" value={formatMoney(p.earned, p.currency) || '—'} />
        <Stat
          label="Giá giờ thực tế"
          value={p.effectiveRate ? `${formatMoney(p.effectiveRate, p.currency)}/giờ` : '—'}
          hint={p.effectiveRate ? 'tính cả giờ không tính tiền' : 'cần giá và giờ đã làm'}
        />
        <Stat label="Tổng giờ" value={formatHours(p.minutesTotal)} />
      </dl>
      {p.minutesTotal > 0 && (
        <BillableBar
          billable={p.minutesBillable}
          nonBillable={p.minutesNonBillable}
          scale={p.minutesTotal}
          label={p.title}
        />
      )}
    </BrainCard>
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

  return (
    <div className="flex flex-col gap-5 px-4 pb-12 sm:px-8">
      <TimerPanel
        timer={timer}
        projects={allProjects.filter((p) => p.status === 'active' || p.status === 'planned')}
        objectives={objectives}
        onChanged={(message) => {
          setNotice(message);
          refresh();
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ChoiceSelect
          label="Trạng thái"
          value={status}
          onChange={setStatus}
          choices={statusChoices}
          className="w-auto"
        />
        <BillableLegend className="ms-2 hidden sm:flex" />
        <Button
          className="ms-auto"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
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
        <LoadingCards />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Briefcase aria-hidden />}
          title="Chưa có dự án nào"
          description={
            status === 'all'
              ? 'Thêm dự án freelance với khách và giá; giờ làm sẽ cho ra giá giờ thực tế.'
              : 'Không có dự án nào ở trạng thái này.'
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((p) => (
            <ProjectCard
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
