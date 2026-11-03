'use client';
import { type ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
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
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards } from '../api-state';
import { KeyLegend } from '../key-legend';
import type { BookIndex } from './body-of-work';
import type { ObjectivesUpdate } from './objectives-editor';
import { PlanPanel } from './plan-panel';
import { ReviewPanel } from './review-panel';
import { addDays, isMonday, isoWeek, mondayOf, todayPrague, weekdayIndex, weekRange } from './week-utils';

type Tab = 'plan' | 'review';

/** Every key of the page in one legend behind "Phím tắt" (DESIGN.md §6, D24): week keys and objective row keys. */
const keyHelp: [string, string][] = [
  ['[', 'tuần trước'],
  [']', 'tuần sau'],
  ['T', 'về tuần này'],
  ['P', 'kế hoạch'],
  ['R', 'nhìn lại'],
  ['↑ / ↓', 'chọn mục tiêu'],
  ['D', 'mục tiêu xong'],
  ['X', 'bỏ mục tiêu'],
  ['O', 'mở lại mục tiêu'],
  ['Enter', 'sửa tên mục tiêu'],
  ['Alt+↑ / ↓', 'đổi thứ tự mục tiêu'],
  ['Del', 'xóa mục tiêu'],
  ['?', 'bảng phím tắt này'],
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
 * Current and future weeks are opened (created) on first view, as GET /plan does. A past week is only read:
 * GET /review answers 404 for a week that was never opened, and opening it is an explicit choice, so browsing
 * history never creates empty weeks (which would change what the next week offers to carry over).
 */
async function loadWeek(start: string, create: boolean): Promise<WeekData> {
  if (!create) {
    const review = await weeksApi.getReview(start);
    if (!review) return { start, plan: null, review: null };
    return { start, plan: await weeksApi.getPlan(start), review };
  }
  // Both at once; GET /review answers 404 (null) only the first time, before GET /plan has opened the week.
  const [plan, review] = await Promise.all([weeksApi.getPlan(start), weeksApi.getReview(start)]);
  return { start, plan, review: review ?? (await weeksApi.getReview(start)) };
}

/** Planning early in the week, review from Friday; past weeks open on the review. */
function defaultTab(start: string, current: string): Tab {
  if (start < current) return 'review';
  if (start > current) return 'plan';
  return weekdayIndex(todayPrague()) >= 4 ? 'review' : 'plan';
}

function relativeName(start: string, current: string): string | null {
  if (start === current) return 'Tuần này';
  if (start === addDays(current, -7)) return 'Tuần trước';
  if (start === addDays(current, 7)) return 'Tuần tới';
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
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [current] = useState(() => mondayOf(todayPrague()));
  const latest = addDays(current, 7); // planning reaches next week, not further
  const w = params.get('w');
  const start = isMonday(w) && w <= latest ? w : current;
  const t = params.get('tab');
  const tab: Tab = t === tabParam.review ? 'review' : t === tabParam.plan ? 'plan' : defaultTab(start, current);

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

  const name = relativeName(start, current);
  const wk = data?.plan?.week;

  return (
    <div className="flex flex-col gap-4 px-4 pb-12 sm:px-8">
      <nav aria-label="Chọn tuần" className="flex flex-wrap items-center gap-2">
        <WeekArrow label="Tuần trước" shortcut="[" onClick={() => go(addDays(start, -7))}>
          <ChevronLeft aria-hidden />
        </WeekArrow>
        <WeekArrow label="Tuần sau" shortcut="]" disabled={start >= latest} onClick={() => go(addDays(start, 7))}>
          <ChevronRight aria-hidden />
        </WeekArrow>
        <h2 className="flex flex-wrap items-baseline gap-x-2 font-heading text-lg font-semibold tracking-tight" aria-live="polite">
          <span>Tuần {isoWeek(start)}</span>
          <span className="text-sm font-normal text-muted-foreground tabular-nums">
            {weekRange(start)}
            {name ? ` · ${name}` : ''}
          </span>
        </h2>
        {/* One status badge (DESIGN.md D25): the furthest step of the ritual this week has reached */}
        {(wk?.reviewedAt || wk?.plannedAt) && (
          <Badge variant="success">{wk?.reviewedAt ? 'Đã nhìn lại' : 'Đã lên kế hoạch'}</Badge>
        )}
        <div className="ms-auto flex items-center gap-2">
          {start !== current && (
            <Button size="sm" variant="ghost" onClick={() => go(current)}>
              Về tuần này
            </Button>
          )}
          <KeyLegend keys={keyHelp} title="Phím tắt của Tuần" />
        </div>
      </nav>

      {data && <ApiStaleAlert result={week} />}
      {week.error && !data ? (
        <ApiErrorState error={week.error} onRetry={week.reload} />
      ) : !data ? (
        <LoadingCards count={3} />
      ) : !data.plan ? (
        <EmptyState
          icon={<CalendarRange aria-hidden />}
          title="Tuần này chưa được mở"
          description={`Không có kế hoạch hay nhìn lại nào cho tuần ${weekRange(start)}.`}
        >
          <Button variant="outline" onClick={() => setOpened(start)}>
            Mở tuần này để ghi lại
          </Button>
        </EmptyState>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
          <TabsList aria-label="Nghi thức tuần">
            <TabsTab value="plan">Kế hoạch</TabsTab>
            <TabsTab value="review">Nhìn lại</TabsTab>
          </TabsList>
          <TabsPanel value="plan" keepMounted>
            <PlanPanel
              key={start}
              start={start}
              weekName={start === current ? 'tuần này' : start === latest ? 'tuần tới' : `tuần ${weekRange(start)}`}
              week={data.plan.week}
              carryCandidates={data.plan.carryCandidates}
              onWeek={onWeek}
              onObjectives={onObjectives}
              onCarried={onCarried}
            />
          </TabsPanel>
          <TabsPanel value="review" keepMounted>
            {data.review ? (
              <ReviewPanel
                key={start}
                start={start}
                week={data.plan.week}
                review={data.review}
                books={books}
                onWeek={onWeek}
                onObjectives={onObjectives}
                onAchievement={onAchievement}
                onOpportunity={onOpportunity}
                onNextWeek={start < latest ? () => go(addDays(start, 7), 'plan') : undefined}
              />
            ) : (
              <LoadingCards count={2} />
            )}
          </TabsPanel>
        </Tabs>
      )}
      {/* How the ritual goes: under the empty state of a week never opened, and under the real form of a blank
          week (no objectives, never planned or reviewed), which is what a new user meets */}
      {data &&
        !week.error &&
        (!data.plan ||
          (data.plan.week.objectives.length === 0 && !data.plan.week.plannedAt && !data.plan.week.reviewedAt)) && (
          <EmptyStateGuide guide="week" className={data.plan ? 'mt-4' : undefined} />
        )}
    </div>
  );
}
