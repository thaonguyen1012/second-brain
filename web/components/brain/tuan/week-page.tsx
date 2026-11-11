'use client';
import { type ReactNode, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRoutePathname } from '@/lib/use-app-pathname';
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ApiWeek } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import {
  type ApiAchievement,
  type ApiOpportunityDecision,
  type ApiPlanView,
  type ApiReviewView,
  weeksApi,
} from '@/lib/api/weeks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyStateGuide } from '@/components/stageshow/lazy';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards } from '../api-state';
import { useInboxCount } from '../inbox-count';
import { KeyLegend } from '../key-legend';
import { PAGE_WIDTH } from '../layout';
import type { BookIndex } from './body-of-work';
import type { ObjectivesUpdate } from './objectives-editor';
import { PlanPanel } from './plan-panel';
import { ReviewPanel } from './review-panel';
import { checkProgress, reviewChecks } from './review-rhythm';
import { addDays, isMonday, isoWeek, mondayOf, todayPrague, weekdayIndex, weekRange } from './week-utils';

type Tab = 'plan' | 'review';

/** Every key of the page in one legend behind "Phím tắt" (DESIGN.md §6, D24): week keys and objective row keys. */
const keyHelp: [string, Msg][] = [
  ['[', msg('tuần trước')],
  [']', msg('tuần sau')],
  ['T', msg('về tuần này')],
  ['P', msg('kế hoạch')],
  ['R', msg('nhìn lại')],
  ['↑ / ↓', msg('chọn mục tiêu')],
  ['D', msg('mục tiêu xong')],
  ['X', msg('bỏ mục tiêu')],
  ['O', msg('mở lại mục tiêu')],
  ['Enter', msg('sửa tên mục tiêu')],
  ['Alt+↑ / ↓', msg('đổi thứ tự mục tiêu')],
  ['Del', msg('xóa mục tiêu')],
  ['?', msg('bảng phím tắt này')],
];

/** Icon-only week arrow with its tooltip; the key shows only there (DESIGN.md D21, D24). */
function WeekArrow({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button size="icon-sm" variant="outline" aria-label={label} disabled={disabled} onClick={onClick} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup>
        {label} <Kbd>{shortcut}</Kbd>
      </TooltipPopup>
    </Tooltip>
  );
}
const tabParam: Record<Tab, string> = { plan: 'ke-hoach', review: 'nhin-lai' };

interface WeekData {
  start: string;
  plan: ApiPlanView | null;
  review: ApiReviewView | null;
}

/**
 * No GET creates a week (security audit P-04): GET /plan and GET /review answer an empty week (`id` null) for this
 * week and later ones until the first write (an objective, the journal, a review answer) opens it. A past week that
 * was never opened answers 404 on /review, so browsing history shows it as never opened.
 */
async function loadWeek(start: string, create: boolean): Promise<WeekData> {
  if (!create) {
    const review = await weeksApi.getReview(start);
    if (!review) return { start, plan: null, review: null };
    return { start, plan: await weeksApi.getPlan(start), review };
  }
  const [plan, review] = await Promise.all([weeksApi.getPlan(start), weeksApi.getReview(start)]);
  return { start, plan, review };
}

/** Planning early in the week, review from Friday; past weeks open on the review. */
function defaultTab(start: string, current: string): Tab {
  if (start < current) return 'review';
  if (start > current) return 'plan';
  return weekdayIndex(todayPrague()) >= 4 ? 'review' : 'plan';
}

/** The skeleton in the tab's shape (DESIGN.md D27): one surface for the plan; the review's two columns from xl. */
function WeekLoading({ tab }: { tab: Tab }) {
  if (tab === 'plan') return <LoadingCards count={1} />;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:items-start">
      <LoadingCards count={2} />
      <div className="max-xl:hidden">
        <LoadingCards count={3} />
      </div>
    </div>
  );
}

function relativeName(start: string, current: string, t: T): string | null {
  if (start === current) return t('Tuần này');
  if (start === addDays(current, -7)) return t('Tuần trước', null, 'relative');
  if (start === addDays(current, 7)) return t('Tuần tới');
  return null;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.getAttribute('role') === 'combobox' ||
    target.getAttribute('role') === 'option' ||
    // An open objective menu or a dialog (delete confirmation, key legend) keeps its own keys
    target.closest('[role="menu"], [role="dialog"], [role="alertdialog"]') !== null
  );
}

export function WeekPage({ books }: { books: BookIndex }) {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = useRoutePathname();
  const [current] = useState(() => mondayOf(todayPrague()));
  const latest = addDays(current, 7); // planning reaches next week, not further
  const w = params.get('w');
  const start = isMonday(w) && w <= latest ? w : current;
  const tabArg = params.get('tab');
  const tab: Tab =
    tabArg === tabParam.review ? 'review' : tabArg === tabParam.plan ? 'plan' : defaultTab(start, current);

  const [opened, setOpened] = useState<string | null>(null);
  const create = start >= current || opened === start;
  const week = useApi(`week:${start}:${create ? 'open' : 'read'}`, () => loadWeek(start, create));
  const data = week.data?.start === start ? week.data : undefined;

  function go(nextStart: string, nextTab?: Tab) {
    const q = new URLSearchParams();
    if (nextStart !== current) q.set('w', nextStart);
    if (nextTab) q.set('tab', tabParam[nextTab]);
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  function setTab(next: Tab) {
    const q = new URLSearchParams(params.toString());
    q.set('tab', tabParam[next]);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  // Keys: [ previous week, ] next week, T this week, P plan, R review (never while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === '[') go(addDays(start, -7));
      else if (k === ']' && start < latest) go(addDays(start, 7));
      else if (k === 't' && start !== current) go(current);
      else if (k === 'p') setTab('plan');
      else if (k === 'r') setTab('review');
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Local updates after a write: the plan's week is the one source, the review keeps a copy.
  const setWeek = (fn: (w: ApiWeek) => ApiWeek) =>
    week.mutate((d) =>
      d && d.plan
        ? { ...d, plan: { ...d.plan, week: fn(d.plan.week) }, review: d.review && { ...d.review, week: fn(d.review.week) } }
        : d,
    );
  // A journal save answers with the whole week: keep the local objectives (an objective write may still be on
  // its way, and its optimistic change must not be replaced by the older server copy).
  const onWeek = (next: ApiWeek) => setWeek((w) => ({ ...next, objectives: w.objectives }));
  const onObjectives = (update: ObjectivesUpdate) => setWeek((w) => ({ ...w, objectives: update(w.objectives) }));
  const onCarried = (next: ApiWeek, carried: number[]) =>
    week.mutate((d) =>
      d && d.plan
        ? {
            ...d,
            plan: {
              week: next,
              carryCandidates: d.plan.carryCandidates.map((c) => (carried.includes(c.id) ? { ...c, carried: true } : c)),
            },
            review: d.review && { ...d.review, week: next },
          }
        : d,
    );
  const onAchievement = (a: ApiAchievement) =>
    week.mutate((d) =>
      d && d.review
        ? {
            ...d,
            review: {
              ...d.review,
              achievements: [...d.review.achievements, a].sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id),
            },
          }
        : d,
    );

  const onOpportunity = (id: number, decision: ApiOpportunityDecision) =>
    week.mutate((d) => {
      if (!d?.review) return d;
      const { withEvidence, stale } = d.review.opportunities;
      const set = <T extends { id: number; decision: ApiOpportunityDecision }>(list: T[]) =>
        list.map((o) => (o.id === id ? { ...o, decision } : o));
      return { ...d, review: { ...d.review, opportunities: { withEvidence: set(withEvidence), stale: set(stale) } } };
    });

  // Next week's objectives tick the checklist's last line. GET /review only reads (404 = never opened, null),
  // unlike GET /plan, so looking never creates next week.
  const next = addDays(start, 7);
  const nextKey = start < latest && data?.review ? `week-next:${next}` : null;
  const nextWeek = useApi(nextKey, () => weeksApi.getReview(next));
  const nextCount =
    nextKey === null || nextWeek.error || nextWeek.dataKey !== nextKey
      ? undefined
      : nextWeek.data
        ? nextWeek.data.week.objectives.filter((o) => o.status !== 'dropped').length
        : null;

  const inbox = useInboxCount();
  const checks =
    data?.plan && data.review
      ? reviewChecks(
          {
            inbox,
            objectives: data.plan.week.objectives,
            // The brag lines added in this review count at once (the server counts the same rows).
            rhythm: data.review.rhythm && { ...data.review.rhythm, achievements: data.review.achievements.length },
            nextWeek: nextCount,
            onNextWeek: start < latest ? () => go(next, 'plan') : undefined,
          },
          t,
        )
      : null;
  const progress = checks && checkProgress(checks);

  const name = relativeName(start, current, t);
  const wk = data?.plan?.week;
  // One status (DESIGN.md D25, D31): from review time (past weeks, Friday on, or a journal already saved) the
  // neutral step count, the success badge once every check is done; before that, a planned week's badge.
  const reviewTime = start < current || (start === current && weekdayIndex(todayPrague()) >= 4) || !!wk?.reviewedAt;
  const reviewed = reviewTime && !!progress && progress.total > 0 && progress.done === progress.total;
  const steps =
    !reviewed && progress && reviewTime ? t('{done}/{total} bước', { done: progress.done, total: progress.total }) : null;
  const badge = reviewed ? t('Đã nhìn lại') : !steps && wk?.plannedAt ? t('Đã lên kế hoạch') : null;

  return (
    <div className={cn(PAGE_WIDTH, 'px-4 pb-12 sm:px-8')}>
      {/* Below xl both rituals are one reading column (max-w-3xl), and the week row with its tabs ends on its edge */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4 max-xl:max-w-3xl">
        {/* One row: the week (arrows, number, range, status) and, at its end, the ritual tabs and the key legend;
            min-h-9 keeps its height while the tabs wait for data */}
        <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-3">
          <nav aria-label={t('Chọn tuần')} className="flex min-w-0 flex-1 basis-72 items-center gap-2">
            <WeekArrow label={t('Tuần trước')} shortcut="[" onClick={() => go(addDays(start, -7))}>
              <ChevronLeft aria-hidden />
            </WeekArrow>
            <WeekArrow
              label={t('Tuần sau')}
              shortcut="]"
              disabled={start >= latest}
              onClick={() => go(addDays(start, 7))}
            >
              <ChevronRight aria-hidden />
            </WeekArrow>
            <h2
              className="flex min-w-0 flex-wrap items-baseline gap-x-2 font-heading text-lg font-semibold tracking-tight"
              aria-live="polite"
            >
              <span>{t('Tuần {week}', { week: isoWeek(start) })}</span>
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {/* Lines break only after a "·", never inside "Tuần này" or "1/6 bước" */}
                {[weekRange(start), name, steps]
                  .filter((part): part is string => !!part)
                  .map((part) => part.replaceAll(' ', '\u00a0'))
                  .join('\u00a0· ')}
                {/* Below sm the status joins this line instead of wrapping alone as a badge (D11) */}
                {badge && <span className="sm:hidden">{`\u00a0· ${badge.replaceAll(' ', '\u00a0')}`}</span>}
              </span>
              {badge && (
                <Badge variant="success" className="self-center max-sm:hidden">
                  {badge}
                </Badge>
              )}
            </h2>
          </nav>
          <div className="flex items-center gap-2">
            {start !== current && (
              <Button size="sm" variant="ghost" onClick={() => go(current)}>
                {t('Về tuần này')}
              </Button>
            )}
            {data?.plan && (
              <TabsList aria-label={t('Nghi thức tuần')}>
                <TabsTab value="plan">{t('Kế hoạch')}</TabsTab>
                <TabsTab value="review">{t('Nhìn lại')}</TabsTab>
              </TabsList>
            )}
            <KeyLegend
              keys={keyHelp.map(([k, label]): [string, string] => [k, t(label)])}
              title={t('Phím tắt của Tuần')}
            />
          </div>
        </div>

        {data && <ApiStaleAlert result={week} />}
        {week.error && !data ? (
          <ApiErrorState error={week.error} onRetry={week.reload} />
        ) : !data ? (
          <WeekLoading tab={tab} />
        ) : !data.plan ? (
          <EmptyState
            icon={<CalendarPlus aria-hidden />}
            title={t('Tuần này chưa được mở')}
            description={t('Không có kế hoạch hay nhìn lại nào cho tuần {range}.', { range: weekRange(start) })}
          >
            <Button variant="outline" onClick={() => setOpened(start)}>
              {t('Mở tuần này để ghi lại')}
            </Button>
          </EmptyState>
        ) : (
          <>
            <TabsPanel value="plan" keepMounted>
              <PlanPanel
                key={start}
                start={start}
                weekName={
                  start === current
                    ? t('tuần này')
                    : start === latest
                      ? t('tuần tới')
                      : t('tuần {range}', { range: weekRange(start) })
                }
                week={data.plan.week}
                carryCandidates={data.plan.carryCandidates}
                onWeek={onWeek}
                onObjectives={onObjectives}
                onCarried={onCarried}
              />
            </TabsPanel>
            <TabsPanel value="review" keepMounted>
              {data.review && checks ? (
                <ReviewPanel
                  key={start}
                  start={start}
                  week={data.plan.week}
                  review={data.review}
                  books={books}
                  checks={checks}
                  onWeek={onWeek}
                  onObjectives={onObjectives}
                  onAchievement={onAchievement}
                  onOpportunity={onOpportunity}
                  onPlan={() => setTab('plan')}
                />
              ) : (
                <WeekLoading tab="review" />
              )}
            </TabsPanel>
          </>
        )}
        {/* How the ritual goes: under the empty state of a week never opened, and under the real form of a blank
            week (no objectives, never planned or reviewed), which is what a new user meets */}
        {data &&
          !week.error &&
          (!data.plan ||
            (data.plan.week.objectives.length === 0 && !data.plan.week.plannedAt && !data.plan.week.reviewedAt)) && (
            <EmptyStateGuide guide="week" className={data.plan ? 'mt-4' : undefined} />
          )}
      </Tabs>
    </div>
  );
}
