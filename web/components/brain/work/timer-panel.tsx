'use client';
import { useEffect, useState } from 'react';
import { Loader2, Play, Square, Timer } from 'lucide-react';
import type { ApiObjective } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import type { ApiProject, ApiTimeEntry } from '@/lib/api/work';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { fieldErrors, formatClock, formatMinutes, isTyping } from './format';
import type { TimerState } from './use-work';

const LAST_PROJECT = 'work:last-project';

/** Throws (and returns null) on the server or with blocked storage. */
function readLastProject(): number | null {
  try {
    const v = Number(window.localStorage.getItem(LAST_PROJECT));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function rememberProject(id: number) {
  try {
    window.localStorage.setItem(LAST_PROJECT, String(id));
  } catch {
    // per-viewer convenience only
  }
}

/** Live H:MM:SS since `startedAt`, ticking every second. */
function Clock({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="font-heading text-3xl font-semibold tabular-nums tracking-tight" aria-hidden>
      {formatClock(now - new Date(startedAt).getTime())}
    </span>
  );
}

/**
 * The one timer (POST /api/time-entries/timer/start|stop). Shows the running entry from GET timer, so a reload
 * keeps it. `T` starts or stops it when focus is not in a field. `onChanged` lets the page refresh its lists.
 */
export function TimerPanel({
  timer,
  projects,
  objectives,
  preferredProject,
  onChanged,
}: {
  timer: TimerState;
  projects: ApiProject[];
  objectives: ApiObjective[];
  /** Pre-selects this project (e.g. the project filter of the Giờ page). */
  preferredProject?: number | null;
  onChanged: (message: string, entry: ApiTimeEntry | null) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [billable, setBillable] = useState(true);
  const [objective, setObjective] = useState('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = timer.running;

  const ids = new Set(projects.map((p) => p.id));
  const fallback = [preferredProject, readLastProject(), projects[0]?.id].find(
    (id): id is number => typeof id === 'number' && ids.has(id),
  );
  const projectId = picked !== null && ids.has(picked) ? picked : (fallback ?? null);

  const start = async () => {
    if (projectId === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await timer.start({
        project: projectId,
        note: note.trim(),
        billable,
        objective: objective === 'none' ? null : Number(objective),
      });
      rememberProject(projectId);
      setNote('');
      onChanged(`Bắt đầu bấm giờ cho "${entry.projectTitle}"`, entry);
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body)) || describeApiError(e).title);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await timer.stop();
      onChanged(
        entry
          ? `Đã dừng: ${formatMinutes(entry.minutes)} cho "${entry.projectTitle}"`
          : 'Bộ bấm giờ đã dừng từ trước.',
        entry,
      );
    } catch (err) {
      setError(describeApiError(toApiError(err)).title);
    } finally {
      setBusy(false);
    }
  };

  // T toggles the timer (same pattern as the inbox keys: never while typing or with a modifier).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || e.key.toLowerCase() !== 't') return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      void (running ? stop() : start());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (timer.error && !timer.data) return <ApiErrorState error={timer.error} onRetry={timer.reload} />;
  if (!timer.data) return <Skeleton className="h-28 rounded-3xl" aria-label="Đang tải bộ bấm giờ" />;

  const objectiveChoices = [
    { value: 'none', label: 'Không gắn mục tiêu' },
    ...objectives.filter((o) => o.status !== 'dropped').map((o) => ({ value: String(o.id), label: o.title })),
  ];

  return (
    <Card
      render={<section aria-label="Bấm giờ" />}
      className="flex flex-col gap-3 rounded-3xl border p-4 shadow-depth-1 sm:p-5"
    >
      {running ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="relative flex size-3" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-3 rounded-full bg-primary" />
          </span>
          {running.startedAt && <Clock startedAt={running.startedAt} />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-medium break-words">{running.projectTitle}</p>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {running.note && <span className="break-words">{running.note}</span>}
              {!running.billable && <Badge variant="outline">Không tính tiền</Badge>}
              {running.startedAt && (
                <span>
                  bắt đầu lúc{' '}
                  {new Date(running.startedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <Button onClick={() => void stop()} disabled={busy} variant="destructive">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Square aria-hidden />}
            Dừng <Kbd className="bg-transparent text-current">T</Kbd>
          </Button>
          <span className="sr-only" role="status">
            Đang bấm giờ cho {running.projectTitle}
          </span>
        </div>
      ) : projects.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer aria-hidden className="size-4" />
          Tạo một dự án trước để bấm giờ.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Timer aria-hidden className="size-4 text-muted-foreground" />
            Bấm giờ
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto_minmax(0,1fr)_auto]">
            <ChoiceSelect
              label="Dự án"
              value={String(projectId ?? '')}
              onChange={(v) => setPicked(Number(v))}
              choices={projects.map((p) => ({ value: String(p.id), label: p.title }))}
            />
            <Input
              aria-label="Ghi chú (đang làm gì)"
              placeholder="Đang làm gì? (không bắt buộc)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
            <label className="flex h-9 items-center gap-2 whitespace-nowrap text-sm sm:h-8">
              <Checkbox checked={billable} onCheckedChange={setBillable} />
              Tính tiền
            </label>
            {objectiveChoices.length > 1 ? (
              <ChoiceSelect
                label="Mục tiêu tuần này"
                value={objective}
                onChange={setObjective}
                choices={objectiveChoices}
              />
            ) : (
              <span className="hidden xl:block" />
            )}
            <Button type="submit" disabled={busy || projectId === null}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
              Bắt đầu <Kbd className="bg-transparent text-current">T</Kbd>
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

