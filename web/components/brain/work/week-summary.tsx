'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { useApi } from '@/lib/api/use-api';
import { workApi, type ApiWeekSummary } from '@/lib/api/work';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/client';
import type { T } from '@/lib/i18n/translate';
import { ApiErrorState } from '../api-state';
import { BillableBar, Swatch } from './billable-bar';
import { addDays, formatHours, formatWeekRange, mondayOf, todayPrague } from './format';

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
/** "0 giờ" at zero (a week total, not a duration), else the exact compact hours. */
const hours = (minutes: number, t: T) => (minutes === 0 ? t('0 giờ') : formatHours(minutes, t));

/**
 * Week summary (GET /api/time-entries/summary), a flat section: the total (18px: the timer above holds the page's big
 * number), one line with the billable / non-billable split, then one bar per project on a shared scale. A week with
 * no time keeps that shape at zero: an empty rail instead of the bars. `refreshKey` changes when the page records or
 * removes time. `onSelectProject` filters the list.
 */
export function WeekSummary({
  refreshKey,
  onSelectProject,
}: {
  refreshKey: number;
  onSelectProject?: (projectId: number, weekStart: string) => void;
}) {
  const t = useT();
  // null = this week as the server sees it (Europe/Prague); set only by the arrows, so render stays stable.
  const [week, setWeek] = useState<string | null>(null);
  const summary = useApi<ApiWeekSummary>(`work:summary:${week ?? 'current'}:${refreshKey}`, () =>
    workApi.getTimeSummary(week ?? undefined),
  );
  const data = summary.data;
  const rows = [...(data?.projects ?? [])].sort((a, b) => b.minutesTotal - a.minutesTotal);
  const scale = rows[0]?.minutesTotal ?? 0;
  // The week on screen, as the empty line and the "Xem mục" names say it: the dates as the heading shows them, "tuần
  // này" only for the current week (Europe/Prague, as the server counts it; data loads in the browser only, so this
  // never runs at build)
  const otherWeek = data && data.weekStart !== mondayOf(todayPrague()) ? formatWeekRange(data.weekStart, t) : null;

  return (
    <section aria-labelledby="week-summary-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="week-summary-title" className="font-heading text-lg font-semibold tracking-tight">
          {t('Tuần {range}', { range: data ? formatWeekRange(data.weekStart, t) : '' })}
        </h2>
        <div className="ms-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('Tuần trước')}
            disabled={!data}
            onClick={() => data && setWeek(addDays(data.weekStart, -7))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" disabled={week === null} onClick={() => setWeek(null)}>
            {t('Tuần này')}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('Tuần sau')}
            disabled={!data}
            onClick={() => data && setWeek(addDays(data.weekStart, 7))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      {summary.error && !data ? (
        <ApiErrorState error={summary.error} onRetry={summary.reload} />
      ) : !data ? (
        <Skeleton className="h-24 rounded-xl" role="status" aria-busy="true" aria-label={t('Đang tải tổng kết tuần')} />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="font-heading text-lg font-semibold tabular-nums">
              {hours(data.minutesTotal, t)}
              <span className="sr-only"> {t('tổng trong tuần')}</span>
            </p>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Swatch kind="billable" />
                {t('{time} tính tiền', { time: hours(data.minutesBillable, t) })}
                {data.minutesTotal > 0 && ` (${pct(data.minutesBillable, data.minutesTotal)}%)`}
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Swatch kind="nonbillable" />
                {t('{time} không tính tiền', { time: hours(data.minutesNonBillable, t) })}
              </span>
            </p>
          </div>
          {data.minutesTotal === 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="flex min-h-7 items-center text-sm text-muted-foreground">
                {otherWeek
                  ? t('Chưa có giờ nào trong tuần {range}.', { range: otherWeek })
                  : t('Chưa có giờ nào trong tuần này.')}
              </p>
              <div className="flex items-center gap-2" aria-hidden>
                <span className="h-3.5 min-w-0 flex-1 rounded-sm bg-muted" />
                <span className="w-20 shrink-0 text-end text-sm font-medium text-muted-foreground tabular-nums">
                  {t('0 giờ')}
                </span>
              </div>
            </div>
          ) : (
            rows.length > 0 && (
              <ul className="flex flex-col gap-4" aria-label={t('Theo dự án')}>
                {rows.map((p) => (
                  <li key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex min-h-7 items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{p.title}</span>
                      {p.client && <span className="truncate text-xs text-muted-foreground">{p.client}</span>}
                      {onSelectProject && (
                        // Named from its visible "Xem mục" on, then whose and which week: the one on screen, which a
                        // press filters the list to (WCAG 2.5.3, 2.4.6; every project row repeats it)
                        <Button
                          size="xs"
                          variant="ghost"
                          className="ms-auto"
                          aria-label={
                            otherWeek
                              ? t('Xem mục giờ của {title} trong tuần {range}', { title: p.title, range: otherWeek })
                              : t('Xem mục giờ của {title} trong tuần này', { title: p.title })
                          }
                          onClick={() => onSelectProject(p.id, data.weekStart)}
                        >
                          <ListFilter aria-hidden />
                          {t('Xem mục')}
                        </Button>
                      )}
                    </div>
                    <BillableBar
                      billable={p.minutesBillable}
                      nonBillable={p.minutesNonBillable}
                      scale={scale}
                      label={p.title}
                      showTotal
                    />
                  </li>
                ))}
              </ul>
            )
          )}
        </>
      )}
    </section>
  );
}
