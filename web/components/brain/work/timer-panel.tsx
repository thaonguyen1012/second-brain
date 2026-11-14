'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Play, Plus, Square } from 'lucide-react';
import type { ApiObjective } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import type { ApiProject, ApiTimeEntry } from '@/lib/api/work';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { singleKeyShortcutsOn, useSingleKeyShortcuts } from '@/lib/single-key-shortcuts';
import { ApiErrorState, describeApiError } from '../api-state';
import { useInvalidFields } from '../invalid-fields';
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
function Clock({ startedAt, className }: { startedAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className={className} aria-hidden>
      {formatClock(now - new Date(startedAt).getTime())}
    </span>
  );
}

/** The live marker: the "now" red (bw-red), pulsing only while a timer really runs, still under reduced motion. */
function LiveDot() {
  return (
    <span className="relative flex size-2.5 shrink-0" aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-bw-red opacity-60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2.5 rounded-full bg-bw-red" />
    </span>
  );
}

/**
 * Shortcut hint inside a filled button: hidden on touch and at 390 px (DESIGN.md D24); drawn only while single-key
 * shortcuts are on.
 */
function KeyHint({ k }: { k: string }) {
  return (
    <Kbd className="bg-primary-foreground/20 text-primary-foreground pointer-coarse:hidden max-sm:hidden">{k}</Kbd>
  );
}

/**
 * The one timer (POST /api/time-entries/timer/start|stop). Shows the running entry from GET timer, so a reload
 * keeps it. `T` starts or stops it when focus is not in a field. `onChanged` lets the page refresh its lists.
 * Idle, it shows 0:00:00 (Giờ's big number) and the start form. With no open project it renders nothing, unless
 * `onAddProject` is given: then `noProjectLabel` and "Thêm dự án" take the picker's place and "Bắt đầu" waits.
 * `compact` (Dự án): only a one-line strip while a timer runs; T still starts the last-used project there, and the
 * strip then appears.
 */
export function TimerPanel({
  timer,
  projects,
  objectives,
  preferredProject,
  onChanged,
  compact = false,
  onAddProject,
  noProjectLabel,
}: {
  timer: TimerState;
  projects: ApiProject[];
  objectives: ApiObjective[];
  /** Pre-selects this project (e.g. the project filter of the Giờ page). */
  preferredProject?: number | null;
  onChanged: (message: string, entry: ApiTimeEntry | null) => void;
  compact?: boolean;
  /** Opens the add-project dialog in place; the page then passes the new project in `projects` (and as preferred). */
  onAddProject?: () => void;
  /** The line before "Thêm dự án" ("Chưa có dự án"; the page says when only finished projects exist). */
  noProjectLabel?: string;
}) {
  const t = useT();
  const keys = useSingleKeyShortcuts();
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [billable, setBillable] = useState(true);
  const [objective, setObjective] = useState('none');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = useInvalidFields();
  const running = timer.running;
  const startButton = useRef<HTMLButtonElement>(null);
  const focusStart = useRef(false);

  const ids = new Set(projects.map((p) => p.id));
  const fallback = [preferredProject, readLastProject(), projects[0]?.id].find(
    (id): id is number => typeof id === 'number' && ids.has(id),
  );
  const projectId = picked !== null && ids.has(picked) ? picked : (fallback ?? null);

  // "Thêm dự án" is gone once a project exists: after its dialog has closed, give focus to "Bắt đầu" if it was lost.
  useEffect(() => {
    if (!focusStart.current || projects.length === 0) return;
    focusStart.current = false;
    let frame = 0;
    let tries = 0;
    const step = () => {
      if (document.querySelector('[role="dialog"]') && tries++ < 90) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      if (!document.activeElement || document.activeElement === document.body) startButton.current?.focus();
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [projects.length]);

  const start = async () => {
    if (projectId === null || busy) return;
    setBusy(true);
    setError(null);
    invalid.clear();
    try {
      const entry = await timer.start({
        project: projectId,
        note: note.trim(),
        billable,
        objective: objective === 'none' ? null : Number(objective),
      });
      rememberProject(projectId);
      setNote('');
      onChanged(t('Bắt đầu bấm giờ cho "{title}"', { title: entry.projectTitle }), entry);
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body, t)) || describeApiError(e, t).title);
      invalid.fromError(e, t);
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
          ? t('Đã dừng: {time} cho "{title}"', { time: formatMinutes(entry.minutes, t), title: entry.projectTitle })
          : t('Bộ bấm giờ đã dừng từ trước.'),
        entry,
      );
    } catch (err) {
      setError(describeApiError(toApiError(err), t).title);
    } finally {
      setBusy(false);
    }
  };

  // T toggles the timer (same pattern as the inbox keys: never while typing, with a modifier or with single keys off).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || e.key.toLowerCase() !== 't') return;
      if (!singleKeyShortcutsOn()) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      void (running ? stop() : start());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const errorLine = error && (
    <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
      {error}
    </p>
  );
  const stopButton = (size: 'default' | 'sm') => (
    <Button onClick={() => void stop()} disabled={busy} size={size} aria-keyshortcuts={keys ? 't' : undefined}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Square aria-hidden />}
      {t('Dừng')}
      {keys && <KeyHint k="T" />}
    </Button>
  );
  const startedLabel =
    running?.startedAt &&
    new Date(running.startedAt).toLocaleTimeString(t.intl, { hour: '2-digit', minute: '2-digit' });

  if (compact) {
    // nothing runs: no strip, only a failed T start says why
    if (!running) return errorLine || null;
    return (
      <section aria-label={t('Đang bấm giờ')} className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-2">
        <div className="flex min-h-8 items-center gap-3">
          <LiveDot />
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{running.projectTitle}</p>
          {running.startedAt && (
            <Clock startedAt={running.startedAt} className="text-sm font-medium tabular-nums" />
          )}
          {stopButton('sm')}
          <span className="sr-only" role="status">
            {t('Đang bấm giờ cho {title}', { title: running.projectTitle })}
          </span>
        </div>
        {errorLine}
      </section>
    );
  }

  if (timer.error && !timer.data) return <ApiErrorState error={timer.error} onRetry={timer.reload} />;
  if (!timer.data) return <Skeleton className="h-24 rounded-xl" role="status" aria-busy="true" aria-label={t('Đang tải bộ bấm giờ')} />;
  if (!running && projects.length === 0 && !onAddProject) return null;

  const objectiveChoices = [
    { value: 'none', label: t('Không gắn mục tiêu') },
    ...objectives.filter((o) => o.status !== 'dropped').map((o) => ({ value: String(o.id), label: o.title })),
  ];

  return (
    <section aria-label={t('Bấm giờ', null, 'timer')} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      {running ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <LiveDot />
          {running.startedAt && (
            <Clock startedAt={running.startedAt} className="font-heading text-2xl font-semibold tabular-nums" />
          )}
          <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
            <p className="text-sm font-medium break-words">{running.projectTitle}</p>
            <p className="text-xs text-muted-foreground break-words">
              {[
                running.note,
                !running.billable && t('không tính tiền'),
                startedLabel && t('bắt đầu lúc {time}', { time: startedLabel }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {stopButton('default')}
          <span className="sr-only" role="status">
            {t('Đang bấm giờ cho {title}', { title: running.projectTitle })}
          </span>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <h2 className="text-sm font-medium">{t('Bấm giờ', null, 'timer')}</h2>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            {/* Idle: the clock at zero keeps the panel's shape (Toggl); the running one replaces it */}
            <span className="font-heading text-2xl font-semibold tabular-nums" aria-hidden>
              {formatClock(0)}
            </span>
            <div
              className={cn(
                'grid min-w-0 flex-1 gap-2 sm:grid-cols-2',
                // without a project the first cell holds a line and a button: it takes the width it needs
                projects.length > 0
                  ? 'xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto_minmax(0,1fr)_auto]'
                  : 'xl:grid-cols-[auto_minmax(0,1.5fr)_auto_minmax(0,1fr)_auto]',
              )}
            >
              {projects.length > 0 ? (
                <ChoiceSelect
                  aria-required
                  {...invalid.field('project')}
                  label={t('Dự án')}
                  value={String(projectId ?? '')}
                  onChange={(v) => setPicked(Number(v))}
                  choices={projects.map((p) => ({ value: String(p.id), label: p.title }))}
                />
              ) : (
                <div className="flex h-9 min-w-0 items-center gap-2 sm:h-8">
                  <span className="text-sm whitespace-nowrap text-muted-foreground">
                    {noProjectLabel ?? t('Chưa có dự án')}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      focusStart.current = true;
                      onAddProject?.();
                    }}
                  >
                    <Plus aria-hidden />
                    {t('Thêm dự án')}
                  </Button>
                </div>
              )}
              <Input
                {...invalid.field('note')}
                aria-label={t('Ghi chú (đang làm gì)')}
                placeholder={t('Đang làm gì? (không bắt buộc)')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
              <label className="flex h-9 items-center gap-2 whitespace-nowrap text-sm sm:h-8">
                <Checkbox checked={billable} onCheckedChange={setBillable} />
                {t('Tính tiền')}
              </label>
              {objectiveChoices.length > 1 ? (
                <ChoiceSelect
                  {...invalid.field('objective')}
                  label={t('Mục tiêu tuần này')}
                  value={objective}
                  onChange={setObjective}
                  choices={objectiveChoices}
                />
              ) : (
                <span className="hidden xl:block" />
              )}
              <Button
                ref={startButton}
                type="submit"
                disabled={busy || projectId === null}
                aria-keyshortcuts={keys ? 't' : undefined}
                // says what it starts: all it shows (the word and, while single-key shortcuts are on, its key hint;
                // WCAG 2.5.3), then the project picked beside it
                aria-label={
                  projectId === null
                    ? undefined
                    : keys
                      ? t('Bắt đầu, {key}: bấm giờ cho "{title}"', {
                          key: 'T',
                          title: projects.find((p) => p.id === projectId)?.title ?? '',
                        })
                      : t(
                          'Bắt đầu bấm giờ cho "{title}"',
                          { title: projects.find((p) => p.id === projectId)?.title ?? '' },
                          'button',
                        )
                }
              >
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
                {/* a space before the key: the shown text reads "Bắt đầu T", as the name starts (the gap draws it) */}
                {t('Bắt đầu')} {keys && <KeyHint k="T" />}
              </Button>
            </div>
          </div>
          {invalid.copies}
        </form>
      )}
      {errorLine}
    </section>
  );
}
