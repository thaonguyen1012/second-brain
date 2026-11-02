'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { useApi } from '@/lib/api/use-api';
import { workApi, type ApiWeekSummary } from '@/lib/api/work';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState } from '../api-state';
import { BillableBar, BillableLegend } from './billable-bar';
import { addDays, formatHours, formatWeekRange } from './format';

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-secondary p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

const share = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}% tổng giờ` : undefined);

/**
 * Week summary (GET /api/time-entries/summary): billable vs non-billable per project, one bar per project on a
 * shared scale. `refreshKey` changes when the page records or removes time. `onSelectProject` filters the list.
 */
export function WeekSummary({
  refreshKey,
  onSelectProject,
}: {
  refreshKey: number;
  onSelectProject?: (projectId: number, weekStart: string) => void;
}) {
  // null = this week as the server sees it (Europe/Prague); set only by the arrows, so render stays stable.
  const [week, setWeek] = useState<string | null>(null);
  const summary = useApi<ApiWeekSummary>(`work:summary:${week ?? 'current'}:${refreshKey}`, () =>
    workApi.getTimeSummary(week ?? undefined),
  );
  const data = summary.data;
  const rows = [...(data?.projects ?? [])].sort((a, b) => b.minutesTotal - a.minutesTotal);
  const scale = rows[0]?.minutesTotal ?? 0;

  return (
    <Card
      render={<section aria-labelledby="week-summary-title" />}
      className="flex flex-col gap-4 rounded-3xl border p-4 shadow-depth-1 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="week-summary-title" className="font-heading text-lg font-semibold tracking-tight">
          Tuần {data ? formatWeekRange(data.weekStart) : ''}
        </h2>
        <div className="ms-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Tuần trước"
            disabled={!data}
            onClick={() => data && setWeek(addDays(data.weekStart, -7))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button size="sm" variant="outline" disabled={week === null} onClick={() => setWeek(null)}>
            Tuần này
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Tuần sau"
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
        <Skeleton className="h-40 rounded-2xl" aria-label="Đang tải tổng kết tuần" />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2">
            <Tile label="Tổng giờ" value={formatHours(data.minutesTotal)} />
            <Tile
              label="Tính tiền"
              value={formatHours(data.minutesBillable)}
              hint={share(data.minutesBillable, data.minutesTotal)}
            />
            <Tile
              label="Không tính tiền"
              value={formatHours(data.minutesNonBillable)}
              hint={share(data.minutesNonBillable, data.minutesTotal)}
            />
          </dl>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có giờ nào trong tuần này.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Theo dự án</h3>
                <BillableLegend />
              </div>
              <ul className="flex flex-col gap-4">
                {rows.map((p) => (
                  <li key={p.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{p.title}</span>
                      {p.client && <span className="truncate text-xs text-muted-foreground">{p.client}</span>}
                      {onSelectProject && (
                        <Button
                          size="xs"
                          variant="ghost"
                          className="ms-auto"
                          aria-label={`Xem các mục giờ của ${p.title} trong tuần này`}
                          onClick={() => onSelectProject(p.id, data.weekStart)}
                        >
                          <ListFilter aria-hidden />
                          Xem mục
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
            </div>
          )}
        </>
      )}
    </Card>
  );
}
