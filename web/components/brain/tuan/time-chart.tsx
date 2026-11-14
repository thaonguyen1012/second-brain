'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ApiDayWork, ApiWeekTime } from '@/lib/api/weeks';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WeekSection } from './week-section';
import {
  dayLabel,
  minutesLong,
  minutesShort,
  mondayOf,
  shortDate,
  todayPrague,
  weekdayShort,
  weekRange,
} from './week-utils';

// Emphasis form (dataviz skill): the objective hours are the point (the data blue), the rest is context (gray).
// Colours are the --chart-objective / --chart-other tokens in app/global.css (light and dark).
// The gray is below 3:1 on white, so the values are always labelled and a table view exists.
const FOR = 'bg-chart-objective';
const OTHER = 'bg-chart-other';

/** Clean hour ticks for the column axis. */
function hourTicks(maxMinutes: number): number[] {
  const hours = Math.max(1, Math.ceil(maxMinutes / 60));
  const step = hours <= 4 ? 1 : hours <= 8 ? 2 : hours <= 16 ? 4 : 6;
  const top = Math.ceil(hours / step) * step;
  const ticks: number[] = [];
  for (let h = 0; h <= top; h += step) ticks.push(h * 60);
  return ticks;
}

function Legend() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className={cn('size-2.5 rounded-[3px]', FOR)} aria-hidden />
        {t('Giờ cho mục tiêu')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn('size-2.5 rounded-[3px]', OTHER)} aria-hidden />
        {t('Giờ khác')}
      </span>
    </div>
  );
}

/** The week total as one segmented bar with the share of objective hours as the headline. */
function WeekSplit({ time }: { time: ApiWeekTime }) {
  const t = useT();
  const total = time.minutesForObjectives + time.minutesOther;
  const share = total ? Math.round((time.minutesForObjectives / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-2xl font-semibold tabular-nums">{share}%</span>
        <span className="text-sm text-muted-foreground">
          {t('giờ cho mục tiêu · {objectives} trên tổng {total}', {
            objectives: minutesShort(time.minutesForObjectives, t),
            total: minutesShort(total, t),
          })}
        </span>
      </p>
      <div
        className="flex h-3 w-full gap-[2px]"
        role="img"
        aria-label={t('Cho mục tiêu {objectives}, giờ khác {other}', {
          objectives: minutesLong(time.minutesForObjectives, t),
          other: minutesLong(time.minutesOther, t),
        })}
      >
        {time.minutesForObjectives > 0 && (
          <div
            className={cn('h-full rounded-s-[4px]', FOR, time.minutesOther === 0 && 'rounded-e-[4px]')}
            style={{ width: `${(time.minutesForObjectives / total) * 100}%` }}
          />
        )}
        {time.minutesOther > 0 && (
          <div
            className={cn('h-full rounded-e-[4px]', OTHER, time.minutesForObjectives === 0 && 'rounded-s-[4px]')}
            style={{ width: `${(time.minutesOther / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{t('Cho mục tiêu {time}', { time: minutesShort(time.minutesForObjectives, t) })}</span>
        <span>{t('Khác {time}', { time: minutesShort(time.minutesOther, t) })}</span>
      </div>
    </div>
  );
}

/**
 * Stacked columns per day (objective hours at the baseline), hover or focus shows the values (WCAG 1.4.13): the
 * pointer can move onto the tooltip, which stays until the pointer and the focus leave the column or Escape hides it
 * (the focus stays where it is). The focus moving to a column shows that column even with the pointer resting on
 * another; a hover ending shows the focused column again.
 */
function DayColumns({ days }: { days: ApiDayWork[] }) {
  const t = useT();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = hovered ?? focused;
  useEffect(() => {
    if (active === null) return;
    // Escape forgets both triggers: the tooltip comes back only when the pointer enters a column or the focus moves
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setHovered(null);
      setFocused(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
  const max = Math.max(...days.map((d) => d.minutesForObjectives + d.minutesOther), 1);
  const ticks = hourTicks(max);
  const top = ticks[ticks.length - 1];
  const pct = (m: number) => `${(m / top) * 100}%`;

  return (
    <div className="flex gap-2">
      <div className="relative h-40 w-7 shrink-0 text-end text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        {ticks.map((tick) => (
          <span key={tick} className="absolute right-0 translate-y-1/2" style={{ bottom: pct(tick) }}>
            {tick === 0 ? '0' : minutesShort(tick, t)}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="relative h-40">
          {ticks.map((tick) => (
            <div key={tick} className="absolute inset-x-0 border-t border-border" style={{ bottom: pct(tick) }} aria-hidden />
          ))}
          <ul className="absolute inset-0 flex" aria-label={t('Giờ theo ngày')}>
            {days.map((d, i) => {
              const total = d.minutesForObjectives + d.minutesOther;
              const label = t('{day}: cho mục tiêu {objectives}, khác {other}', {
                day: dayLabel(d.date, t),
                objectives: minutesLong(d.minutesForObjectives, t),
                other: minutesLong(d.minutesOther, t),
              });
              return (
                <li
                  key={d.date}
                  tabIndex={0}
                  aria-label={label}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                  onFocus={() => {
                    // the latest trigger wins: a hover elsewhere would show another day beside this ring
                    setFocused(i);
                    setHovered(null);
                  }}
                  onBlur={() => setFocused((f) => (f === i ? null : f))}
                  className="relative flex flex-1 flex-col items-center justify-end rounded-md outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex w-full max-w-6 flex-col-reverse gap-[2px]" style={{ height: pct(total) }}>
                    {d.minutesForObjectives > 0 && (
                      <div
                        className={cn(FOR, d.minutesOther === 0 && 'rounded-t-[4px]')}
                        style={{ height: `${(d.minutesForObjectives / Math.max(total, 1)) * 100}%` }}
                      />
                    )}
                    {d.minutesOther > 0 && (
                      <div
                        className={cn(OTHER, 'rounded-t-[4px]')}
                        style={{ height: `${(d.minutesOther / Math.max(total, 1)) * 100}%` }}
                      />
                    )}
                  </div>
                  {active === i && (
                    // Inside the column, so the pointer may rest on it; the transparent pb-1 (the old gap) keeps the
                    // pointer inside on its way up
                    <div
                      className={cn(
                        'absolute bottom-full z-10 w-max pb-1',
                        i < 2 ? 'left-0' : i > 4 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                      )}
                    >
                      <div
                        role="tooltip"
                        className="rounded-lg whitespace-nowrap border bg-popover px-2.5 py-1.5 text-xs shadow-popover"
                      >
                        <p className="font-medium">{dayLabel(d.date, t)}</p>
                        <p className="flex items-center gap-1.5 tabular-nums">
                          <span className={cn('size-2 rounded-[2px]', FOR)} aria-hidden />
                          {t('Cho mục tiêu: {time}', { time: minutesLong(d.minutesForObjectives, t) })}
                        </p>
                        <p className="flex items-center gap-1.5 tabular-nums">
                          <span className={cn('size-2 rounded-[2px]', OTHER)} aria-hidden />
                          {t('Khác: {time}', { time: minutesLong(d.minutesOther, t) })}
                        </p>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex text-center text-[11px] text-muted-foreground" aria-hidden>
          {days.map((d, i) => (
            <span key={d.date} className="flex-1">
              {t(weekdayShort[i])}
              <span className="hidden sm:inline"> {shortDate(d.date)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The chart at zero hours: the real frame (the 1h line, the baseline, the T2...CN axis of DayColumns, shorter) with
 * no bars, and the message and the way to log time over it, so the section keeps its shape before any data. The
 * message names the week on screen (DESIGN.md §6, as Giờ's week summary): "tuần này" only for the current week
 * (Europe/Prague; data loads in the browser only, so this never runs at build), else its dates as the heading shows
 * them.
 */
function EmptyFrame({ start, days }: { start: string; days: ApiDayWork[] }) {
  const t = useT();
  return (
    <div className="flex gap-2">
      <div className="relative h-24 w-7 shrink-0 text-end text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        <span className="absolute right-0 bottom-full translate-y-1/2">1h</span>
        <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="relative h-24">
          <div className="absolute inset-x-0 top-0 border-t border-border" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 border-t border-border" aria-hidden />
          <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2">
            <p className="text-sm text-muted-foreground">
              {start === mondayOf(todayPrague())
                ? t('Chưa có giờ nào tuần này')
                : t.rich('Chưa có giờ nào trong tuần {range}', {
                    // The dates stay on one line: at 390 px the line broke after the range's en dash
                    range: <span className="whitespace-nowrap">{weekRange(start)}</span>,
                  })}
            </p>
            <Button size="xs" variant="outline" render={<Link href="/cong-viec/gio/" />}>
              {t('Bấm giờ', null, 'chart')}
            </Button>
          </div>
        </div>
        <div className="flex text-center text-[11px] text-muted-foreground" aria-hidden>
          {days.map((d, i) => (
            <span key={d.date} className="flex-1">
              {t(weekdayShort[i])}
              <span className="hidden sm:inline"> {shortDate(d.date)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Header cell of DayTable (DESIGN.md §6 Tables: 40px rows, 12px medium muted header, no vertical borders). */
const HEAD = 'h-10 px-2 text-xs font-medium text-muted-foreground first:ps-0 last:pe-0';
const CELL = 'px-2 first:ps-0 last:pe-0';

function DayTable({ days }: { days: ApiDayWork[] }) {
  const t = useT();
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t('Giờ cho mục tiêu và giờ khác theo ngày')}</caption>
      <thead>
        <tr className="border-b">
          <th scope="col" className={cn(HEAD, 'text-start')}>
            {t('Ngày')}
          </th>
          <th scope="col" className={cn(HEAD, 'text-end')}>
            {t('Cho mục tiêu')}
          </th>
          <th scope="col" className={cn(HEAD, 'text-end')}>
            {t('Khác')}
          </th>
          <th scope="col" className={cn(HEAD, 'text-end')}>
            {t('Tổng')}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {days.map((d) => (
          <tr key={d.date} className="h-10">
            <th scope="row" className={cn(CELL, 'text-start font-normal')}>
              {dayLabel(d.date, t)}
            </th>
            <td className={cn(CELL, 'text-end tabular-nums')}>{minutesShort(d.minutesForObjectives, t)}</td>
            <td className={cn(CELL, 'text-end tabular-nums')}>{minutesShort(d.minutesOther, t)}</td>
            <td className={cn(CELL, 'text-end tabular-nums')}>
              {minutesShort(d.minutesForObjectives + d.minutesOther, t)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Minutes per objective: one series, bars ranked, value at the tip. */
function ByObjective({ time }: { time: ApiWeekTime }) {
  const t = useT();
  const rows = [...time.byObjective].filter((o) => o.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  if (rows.length === 0) return null;
  const max = rows[0].minutes;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{t('Theo mục tiêu')}</h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((o) => (
          <li key={o.id} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
            <span className="truncate" title={o.title}>
              {o.title}
            </span>
            <span className="flex items-center gap-2">
              <span
                className={cn('h-3 rounded-e-[4px]', FOR)}
                style={{ width: `${Math.max((o.minutes / max) * 85, 2)}%` }}
                aria-hidden
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                <span className="sr-only">{minutesLong(o.minutes, t)}</span>
                <span aria-hidden>{minutesShort(o.minutes, t)}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "Giờ cho mục tiêu vs giờ khác" (DECISIONS 9.2), from GET /review: `time` and the per-day minutes of the week that
 * starts on `start` (its Monday).
 */
export function TimeChart({ start, days, time }: { start: string; days: ApiDayWork[]; time: ApiWeekTime }) {
  const t = useT();
  const [table, setTable] = useState(false);
  const total = time.minutesForObjectives + time.minutesOther;
  return (
    <WeekSection
      id="week-time"
      title={t('Giờ cho mục tiêu và giờ khác')}
      action={
        total > 0 && (
          <Button size="xs" variant="ghost" aria-pressed={table} onClick={() => setTable((on) => !on)}>
            {table ? t('Xem biểu đồ') : t('Xem bảng')}
          </Button>
        )
      }
    >
      {total === 0 ? (
        <EmptyFrame start={start} days={days} />
      ) : (
        <>
          <WeekSplit time={time} />
          <Legend />
          {table ? <DayTable days={days} /> : <DayColumns days={days} />}
          <ByObjective time={time} />
        </>
      )}
    </WeekSection>
  );
}
