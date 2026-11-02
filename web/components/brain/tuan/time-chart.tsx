'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { ApiDayWork, ApiWeekTime } from '@/lib/api/weeks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WeekSection } from './week-section';
import { dayLabel, minutesLong, minutesShort, shortDate, weekdayShort } from './week-utils';

// Emphasis form (dataviz skill): the objective hours are the point (blue), the rest is context (gray).
// Light: primary #1f6ae0 + zinc-400; dark: blue-500 + zinc-500 (validated against the dark surface).
// The gray is below 3:1 on white, so the values are always labelled and a table view exists.
const FOR = 'bg-primary dark:bg-blue-500';
const OTHER = 'bg-zinc-400 dark:bg-zinc-500';

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
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className={cn('size-2.5 rounded-[3px]', FOR)} aria-hidden />
        Giờ cho mục tiêu
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn('size-2.5 rounded-[3px]', OTHER)} aria-hidden />
        Giờ khác
      </span>
    </div>
  );
}

/** The week total as one segmented bar with the share of objective hours as the headline. */
function WeekSplit({ time }: { time: ApiWeekTime }) {
  const total = time.minutesForObjectives + time.minutesOther;
  const share = total ? Math.round((time.minutesForObjectives / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-heading text-3xl font-semibold tabular-nums">{share}%</span>
        <span className="text-sm text-muted-foreground">
          giờ cho mục tiêu · {minutesShort(time.minutesForObjectives)} trên tổng {minutesShort(total)}
        </span>
      </p>
      <div
        className="flex h-3 w-full gap-[2px]"
        role="img"
        aria-label={`Cho mục tiêu ${minutesLong(time.minutesForObjectives)}, giờ khác ${minutesLong(time.minutesOther)}`}
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
        <span>Cho mục tiêu {minutesShort(time.minutesForObjectives)}</span>
        <span>Khác {minutesShort(time.minutesOther)}</span>
      </div>
    </div>
  );
}

/** Stacked columns per day (objective hours at the baseline), hover or focus shows the values. */
function DayColumns({ days }: { days: ApiDayWork[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.minutesForObjectives + d.minutesOther), 1);
  const ticks = hourTicks(max);
  const top = ticks[ticks.length - 1];
  const pct = (m: number) => `${(m / top) * 100}%`;

  return (
    <div className="flex gap-2">
      <div className="relative h-40 w-7 shrink-0 text-end text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: pct(t) }}>
            {t === 0 ? '0' : minutesShort(t)}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="relative h-40">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-border" style={{ bottom: pct(t) }} aria-hidden />
          ))}
          <ul className="absolute inset-0 flex" aria-label="Giờ theo ngày">
            {days.map((d, i) => {
              const total = d.minutesForObjectives + d.minutesOther;
              const label = `${dayLabel(d.date)}: cho mục tiêu ${minutesLong(d.minutesForObjectives)}, khác ${minutesLong(d.minutesOther)}`;
              return (
                <li
                  key={d.date}
                  tabIndex={0}
                  aria-label={label}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
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
                    <div
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-lg whitespace-nowrap border bg-popover px-2.5 py-1.5 text-xs shadow-popover',
                        i < 2 ? 'left-0' : i > 4 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                      )}
                    >
                      <p className="font-medium">{dayLabel(d.date)}</p>
                      <p className="flex items-center gap-1.5 tabular-nums">
                        <span className={cn('size-2 rounded-[2px]', FOR)} aria-hidden />
                        Cho mục tiêu: {minutesLong(d.minutesForObjectives)}
                      </p>
                      <p className="flex items-center gap-1.5 tabular-nums">
                        <span className={cn('size-2 rounded-[2px]', OTHER)} aria-hidden />
                        Khác: {minutesLong(d.minutesOther)}
                      </p>
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
              {weekdayShort[i]}
              <span className="hidden sm:inline"> {shortDate(d.date)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayTable({ days }: { days: ApiDayWork[] }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <caption className="sr-only">Giờ cho mục tiêu và giờ khác theo ngày</caption>
      <thead className="text-xs text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="py-1.5 text-start font-medium">
            Ngày
          </th>
          <th scope="col" className="py-1.5 text-end font-medium">
            Cho mục tiêu
          </th>
          <th scope="col" className="py-1.5 text-end font-medium">
            Khác
          </th>
          <th scope="col" className="py-1.5 text-end font-medium">
            Tổng
          </th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.date} className="border-b last:border-0">
            <th scope="row" className="py-1.5 text-start font-normal">
              {dayLabel(d.date)}
            </th>
            <td className="py-1.5 text-end">{minutesShort(d.minutesForObjectives)}</td>
            <td className="py-1.5 text-end">{minutesShort(d.minutesOther)}</td>
            <td className="py-1.5 text-end">{minutesShort(d.minutesForObjectives + d.minutesOther)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Minutes per objective: one series, bars ranked, value at the tip. */
function ByObjective({ time }: { time: ApiWeekTime }) {
  const rows = [...time.byObjective].filter((o) => o.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  if (rows.length === 0) return null;
  const max = rows[0].minutes;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">Theo mục tiêu</h3>
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
                <span className="sr-only">{minutesLong(o.minutes)}</span>
                <span aria-hidden>{minutesShort(o.minutes)}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Giờ cho mục tiêu vs giờ khác" (DECISIONS 9.2), from GET /review: `time` and the per-day minutes. */
export function TimeChart({ days, time }: { days: ApiDayWork[]; time: ApiWeekTime }) {
  const [table, setTable] = useState(false);
  const total = time.minutesForObjectives + time.minutesOther;
  return (
    <WeekSection
      icon={Clock}
      id="week-time"
      title="Giờ cho mục tiêu và giờ khác"
      action={
        total > 0 && (
          <Button size="xs" variant="ghost" aria-pressed={table} onClick={() => setTable((t) => !t)}>
            {table ? 'Xem biểu đồ' : 'Xem bảng'}
          </Button>
        )
      }
    >
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có giờ nào được ghi trong tuần này. Ghi giờ ở{' '}
          <Link href="/cong-viec/gio/" className="text-primary underline-offset-4 hover:underline">
            Công việc · Giờ
          </Link>{' '}
          và gắn với một mục tiêu để biết bao nhiêu giờ đi đúng hướng.
        </p>
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
