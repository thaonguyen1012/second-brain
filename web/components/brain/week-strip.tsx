'use client';
import type { ApiDayWork } from '@/lib/api/weeks';
import { useT } from '@/lib/i18n/client';
import { msg, type T } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';

// The week strip (DESIGN.md §9a, D31): seven cells Monday to Sunday, the data blue for a day with a lesson done,
// its lighter step for a day with other activity only, muted for nothing, dashed for days still to come and the
// bw-red ring for today. A missed day is a muted cell, never red; no streak counts. No data, no effects.
// Forced colours (Windows contrast themes) drop fills and rings, so the cells draw their levels in system colours
// instead: an outlined empty cell, a half-filled one, a full one, and a Highlight outline for today.

/** 0 nothing, 1 other activity only, 2 a lesson was marked done. */
export type DayLevel = 0 | 1 | 2;

export interface StripDay {
  /** YYYY-MM-DD */
  date: string;
  level: DayLevel;
  /** The cell's native tooltip ("Thứ Ba 3/11: 2 bài học") */
  label: string;
}

/** A review day's level: 2 when a page was marked done, 1 for minutes, archived inbox entries or finished items. */
export function dayLevel(d: ApiDayWork): DayLevel {
  if (d.pagesDone.length > 0) return 2;
  const other = d.minutesForObjectives + d.minutesOther + d.inboxArchived.length + d.itemsFinished.length;
  return other > 0 ? 1 : 0;
}

/** Weekday labels by `getUTCDay()` (Sunday first): the same words as week-utils' weekdayShort. */
const WEEKDAY = [
  msg('CN', 'weekday'),
  msg('T2', 'weekday'),
  msg('T3', 'weekday'),
  msg('T4', 'weekday'),
  msg('T5', 'weekday'),
  msg('T6', 'weekday'),
  msg('T7', 'weekday'),
];

const weekday = (date: string, t: T) => t(WEEKDAY[new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay()]);

const levelFill: Record<DayLevel, string> = {
  0: 'bg-muted forced-colors:border-[CanvasText] forced-colors:bg-[Canvas]',
  1: 'bg-chart-nonbillable forced-colors:border-[CanvasText] forced-colors:bg-[linear-gradient(to_top,CanvasText_50%,Canvas_50%)]',
  2: 'bg-chart-data forced-colors:border-[CanvasText] forced-colors:bg-[CanvasText]',
};

/** Under forced colours a cell keeps the system colours of its state (above, or GrayText dashes), with an edge. */
const forcedCell = 'forced-color-adjust-none forced-colors:border';

/** The two filled levels, named next to the strip (Tuần, Hôm nay); the swatches match the cells. */
export function StripLegend({ className }: { className?: string }) {
  const t = useT();
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground', className)}>
      {([2, 1] as const).map((level) => (
        <span key={level} className="flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-[3px]', forcedCell, levelFill[level])} aria-hidden />
          {level === 2 ? t('Có bài học') : t('Chỉ việc khác')}
        </span>
      ))}
    </div>
  );
}

const sizes = {
  md: { strip: 'gap-1.5', col: 'w-7', cell: 'size-7 rounded-md', today: 'ring-offset-2' },
  // rounded-xs (2px): the theme's rounded-sm is 6px, which would turn a 12px cell into a dot
  sm: { strip: 'gap-1', col: 'w-5', cell: 'size-3 rounded-xs', today: 'ring-offset-1' },
} as const;

/**
 * Seven day cells under their weekday (T2...CN). `today` (YYYY-MM-DD) gets the ring; later days are dashed. Read as
 * one image whose label says it all in words ("2/7 ngày có bài học (T2, T3), 1 ngày chỉ có việc khác (T4). Hôm nay,
 * Thứ Năm 5/11: chưa ghi gì"); each cell keeps its own `title` for the pointer, today's starting "Hôm nay, ".
 * `label` replaces the summary when the caller has a better one.
 */
export function WeekStrip({
  days,
  today,
  size = 'md',
  label,
  className,
}: {
  days: readonly StripDay[];
  today: string;
  size?: 'md' | 'sm';
  label?: string;
  className?: string;
}) {
  const t = useT();
  const s = sizes[size];
  const past = days.filter((d) => d.date <= today);
  const named = (level: DayLevel) => past.filter((d) => d.level === level).map((d) => weekday(d.date, t));
  const lessons = named(2);
  const other = named(1);
  const now = days.find((d) => d.date === today);
  const summary =
    label ??
    [
      lessons.length
        ? t('{done}/{total} ngày có bài học ({days})', { done: lessons.length, total: days.length, days: lessons.join(', ') })
        : t('{done}/{total} ngày có bài học', { done: 0, total: days.length }),
      other.length ? t(', {n} ngày chỉ có việc khác ({days})', { n: other.length, days: other.join(', ') }) : '',
      now ? t('. Hôm nay, {day}', { day: now.label }) : '',
    ].join('');
  return (
    <div role="img" aria-label={summary} className={cn('flex', s.strip, className)}>
      {days.map((d) => {
        const future = d.date > today;
        const isToday = d.date === today;
        return (
          <div
            key={d.date}
            title={isToday ? t('Hôm nay, {day}', { day: d.label }) : d.label}
            className={cn('flex flex-col items-center gap-1', s.col)}
          >
            <span className="text-xs text-muted-foreground">{weekday(d.date, t)}</span>
            <span
              className={cn(
                s.cell,
                forcedCell,
                future ? 'border border-dashed bg-transparent forced-colors:border-[GrayText]' : levelFill[d.level],
                isToday &&
                  cn(
                    'ring-2 ring-bw-red ring-offset-background forced-colors:ring-0 forced-colors:outline-2 forced-colors:outline-offset-2 forced-colors:outline-[Highlight]',
                    s.today,
                  ),
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
