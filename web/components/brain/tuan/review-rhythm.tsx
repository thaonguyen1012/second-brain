'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarRange, Circle, CircleCheck } from 'lucide-react';
import type { ApiObjective } from '@/lib/api/client';
import type { ApiRhythm } from '@/lib/api/weeks';
import { useT } from '@/lib/i18n/client';
import type { T } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PREDICTIONS_HREF } from '../due-predictions';

/** "2026-10" -> "tháng 10/2026" / "October 2026". */
function monthLabel(month: string, t: T): string {
  const [year, m] = month.split('-').map(Number);
  if (t.locale === 'en') {
    return new Intl.DateTimeFormat(t.intl, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      Date.UTC(year, m - 1, 1),
    );
  }
  return t('tháng {m}/{y}', { m, y: year });
}

/** What the button at the end of an open check does: a link, or a callback (go to next week's plan). */
export type CheckAction = { label: string; href: string } | { label: string; onClick: () => void };

/** One line of the review checklist. Only `counted` checks make the "n/6" of the checklist and the week header. */
export interface ReviewCheck {
  key: string;
  done: boolean;
  question: string;
  value?: ReactNode;
  detail?: ReactNode;
  action?: CheckAction;
  /** false for the month and quarter lines: reminders without data to tick, never "open" */
  counted: boolean;
}

/**
 * The checks of the 15-minute review (DECISIONS 9.1, 6.5) from data that already exists: inbox at 0, objectives
 * done, the practice rhythm (notes, brag lines, predictions due; month and quarter reminders on the first review of
 * one), then next week's objectives. `inbox` is the shared count (null = unknown), `nextWeek` the number of next
 * week's objectives (null = never opened, undefined = still loading), `onNextWeek` absent when there is no next
 * week to plan. Pure, so the week header and the checklist count the same thing.
 */
export function reviewChecks(
  {
    inbox,
    objectives,
    rhythm,
    nextWeek,
    onNextWeek,
  }: {
    inbox: string | null;
    objectives: ApiObjective[];
    rhythm: ApiRhythm | null;
    nextWeek?: number | null;
    onNextWeek?: () => void;
  },
  t: T,
): ReviewCheck[] {
  const counted = objectives.filter((o) => o.status !== 'dropped');
  const done = counted.filter((o) => o.status === 'done').length;
  const checks: ReviewCheck[] = [
    {
      key: 'inbox',
      counted: true,
      done: inbox === '0',
      question: t('Inbox về 0 chưa?'),
      value: inbox === null ? '–' : inbox === '0' ? t('Đã về 0') : t('Còn {n}', { n: Number(inbox) }),
      action: inbox !== null && inbox !== '0' ? { label: t('Xử lý inbox'), href: '/inbox/' } : undefined,
    },
    {
      key: 'objectives',
      counted: true,
      done: counted.length > 0 && done === counted.length,
      question: t('Mục tiêu xong'),
      value: counted.length ? `${done}/${counted.length}` : t('Chưa có mục tiêu'),
    },
  ];
  if (rhythm) {
    const { notes, achievements, predictionsDue, month, quarter } = rhythm;
    checks.push(
      {
        key: 'notes',
        counted: true,
        done: notes > 0,
        question: t('Có ghi chú mới tuần này?'),
        value: notes > 0 ? t('{n} ghi chú', { n: notes }) : t('Chưa có'),
        action: notes === 0 ? { label: t('Viết ghi chú'), href: '/thu-vien/ghi-chu/' } : undefined,
      },
      {
        key: 'achievements',
        counted: true,
        done: achievements > 0,
        question: t('Có cập nhật thành tựu?'),
        value: achievements > 0 ? t('{n} dòng', { n: achievements }) : t('Chưa có'),
        action: achievements === 0 ? { label: t('Thêm dòng'), href: '#week-achievements' } : undefined,
      },
      {
        key: 'predictions',
        counted: true,
        done: predictionsDue === 0,
        question: t('Dự đoán đến hạn?'),
        value: predictionsDue > 0 ? t('{n} cần chấm', { n: predictionsDue }) : t('Không có'),
        action: predictionsDue > 0 ? { label: t('Chấm lại'), href: PREDICTIONS_HREF } : undefined,
      },
    );
    if (month)
      checks.push({
        key: 'month',
        counted: false,
        done: false,
        question: t('Đầu tháng: nhìn lại tháng trước'),
        detail: t(
          'Trong {month}: {books}, {notes}. Nhịp tháng: một cuốn sách, một cuộc trò chuyện cà phê với người trong hoặc ngoài ngành.',
          {
            month: monthLabel(month.month, t),
            books: t('{n} cuốn sách đọc xong', { n: month.booksFinished }),
            notes: t('{n} ghi chú', { n: month.notes }),
          },
        ),
      });
    if (quarter)
      checks.push({
        key: 'quarter',
        counted: false,
        done: false,
        question: t('Đầu quý: nhìn lại quý trước'),
        detail: t(
          'Quý {q}/{y}: {achievements}, {projects}, {predictions}. Nhịp quý: ship một thứ hoàn chỉnh có người dùng thật, viết case study, nâng một kỹ năng nền, cập nhật CV theo kết quả, xem lại danh sách dự đoán.',
          {
            q: quarter.quarter,
            y: quarter.year,
            achievements: t('{n} thành tựu', { n: quarter.achievements }),
            projects: t('{n} dự án xong', { n: quarter.projectsFinished }),
            predictions: t('{n} dự đoán chưa chấm', { n: quarter.predictionsOpen }),
          },
        ),
      });
  }
  if (onNextWeek) {
    const planned = (nextWeek ?? 0) > 0;
    checks.push({
      key: 'next-week',
      counted: true,
      done: planned,
      question: t('3 ưu tiên tuần tới'),
      value: planned ? t('{n} mục tiêu', { n: nextWeek ?? 0 }) : nextWeek === undefined ? '–' : t('Chưa chọn'),
      action: planned ? undefined : { label: t('Tuần tới'), onClick: onNextWeek },
    });
  }
  return checks;
}

/** Done and total of the counted checks ("1/6"). */
export function checkProgress(checks: ReviewCheck[]): { done: number; total: number } {
  const counted = checks.filter((c) => c.counted);
  return { done: counted.filter((c) => c.done).length, total: counted.length };
}

/** The xs button at the end of an open check; `primary` for the first open one (the region's one filled button). */
function CheckButton({ action, primary }: { action: CheckAction; primary: boolean }) {
  const variant = primary ? 'default' : 'outline';
  const body = (
    <>
      {action.label}
      <ArrowRight aria-hidden />
    </>
  );
  if ('href' in action)
    return (
      <Button size="xs" variant={variant} render={<Link href={action.href} />}>
        {body}
      </Button>
    );
  return (
    <Button size="xs" variant={variant} onClick={action.onClick}>
      {body}
    </Button>
  );
}

/**
 * One row of the review checklist (DESIGN.md §3 list rows): a check mark, the question, an optional detail line,
 * then the short answer and at most one action. From sm every row shares one grid template (icon | question |
 * answer | action track of fixed width, empty when there is no action), so the answers line up down the list
 * (§3 Columns); below sm they wrap under the question. A finished row is muted; a reminder (month, quarter) gets
 * a calendar mark instead of an open circle, since nothing ticks it.
 */
export function CheckRow({ check, primary }: { check: ReviewCheck; primary: boolean }) {
  const t = useT();
  const { done, question, value, detail, action, counted } = check;
  const Icon = !counted ? CalendarRange : done ? CircleCheck : Circle;
  return (
    <li className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6 sm:grid-cols-[auto_minmax(0,1fr)_auto_7rem]">
      {/* Beside a detail paragraph the mark stays on the question's line (20px line, 16px icon) */}
      <Icon
        className={cn(
          'size-4 shrink-0',
          detail && 'mt-0.5 self-start',
          done ? 'text-success-foreground' : 'text-muted-foreground',
        )}
        aria-hidden
      />
      {/* A row without answer or action (the month and quarter reminders) lets its text run to the end */}
      <div className={cn('flex min-w-0 flex-col gap-0.5', !value && !action && 'sm:col-span-3')}>
        <span className={cn('text-sm', done ? 'text-muted-foreground' : 'font-medium')}>
          {question}
          {done && <span className="sr-only"> {t('(xong)')}</span>}
        </span>
        {detail && <span className="text-xs leading-relaxed text-muted-foreground">{detail}</span>}
      </div>
      {(value || action) && (
        <div className="col-start-2 flex flex-wrap items-center gap-3 sm:contents">
          {value && (
            <span className="text-sm text-muted-foreground tabular-nums sm:col-start-3 sm:justify-self-end">
              {value}
            </span>
          )}
          {action && (
            <div className="flex sm:col-start-4 sm:justify-self-start">
              <CheckButton action={action} primary={primary} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
