import type { ApiDayWork } from '@/lib/api/weeks';
import { cn } from '@/lib/utils';

// The week strip (DESIGN.md §9a, D31): seven cells Monday to Sunday, the data blue for a day with a lesson done,
// its lighter step for a day with other activity only, muted for nothing, dashed for days still to come and the
// bw-red ring for today. A missed day is a muted cell, never red; no streak counts. Pure and server-safe.

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

/** Weekday labels by `getUTCDay()` (Sunday first). */
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

const weekday = (date: string) => WEEKDAY[new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay()];

const levelFill: Record<DayLevel, string> = {
  0: 'bg-muted',
  1: 'bg-chart-nonbillable',
  2: 'bg-chart-data',
};

const sizes = {
  md: { strip: 'gap-1.5', col: 'w-7', cell: 'size-7 rounded-md', today: 'ring-offset-2' },
  // rounded-xs (2px): the theme's rounded-sm is 6px, which would turn a 12px cell into a dot
  sm: { strip: 'gap-1', col: 'w-5', cell: 'size-3 rounded-xs', today: 'ring-offset-1' },
} as const;

/**
 * Seven day cells under their weekday (T2...CN). `today` (YYYY-MM-DD) gets the ring; later days are dashed. Read as
 * one image: the label sums it up ("3/7 ngày có bài học"), each cell keeps its own `title`. `label` replaces the
 * summary when the caller has a better one.
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
  const s = sizes[size];
  const lessons = days.filter((d) => d.level === 2).length;
  const other = days.filter((d) => d.level === 1).length;
  const summary =
    label ?? `${lessons}/${days.length} ngày có bài học${other > 0 ? `, ${other} ngày chỉ có việc khác` : ''}`;
  return (
    <div role="img" aria-label={summary} className={cn('flex', s.strip, className)}>
      {days.map((d) => {
        const future = d.date > today;
        return (
          <div key={d.date} title={d.label} className={cn('flex flex-col items-center gap-1', s.col)}>
            <span className="text-xs text-muted-foreground">{weekday(d.date)}</span>
            <span
              className={cn(
                s.cell,
                future ? 'border border-dashed bg-transparent' : levelFill[d.level],
                d.date === today && cn('ring-2 ring-bw-red ring-offset-background', s.today),
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
