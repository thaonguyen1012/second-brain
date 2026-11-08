'use client';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/client';
import { formatHours, formatMinutes } from './format';

// Two series, fixed order and colour (tokens --chart-billable / --chart-nonbillable in app/global.css: the data blue
// and a weaker step of it, nearer the card in either theme): billable first from the baseline, non-billable after a
// 2px gap.

export function Swatch({ kind }: { kind: 'billable' | 'nonbillable' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-sm',
        kind === 'billable' ? 'bg-chart-billable' : 'bg-chart-nonbillable',
      )}
    />
  );
}

export function BillableLegend({ className }: { className?: string }) {
  const t = useT();
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Swatch kind="billable" />
        {t('Tính tiền')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch kind="nonbillable" />
        {t('Không tính tiền')}
      </span>
    </p>
  );
}

/**
 * One horizontal stacked bar: its length is `billable + nonBillable` against `scale` (the largest bar of the
 * chart, or the total itself for a single bar). Hover shows the exact split; the text line below repeats it so
 * nothing depends on colour or on hovering.
 */
export function BillableBar({
  billable,
  nonBillable,
  scale,
  label,
  showTotal = false,
  className,
}: {
  billable: number;
  nonBillable: number;
  scale: number;
  label: string;
  /** Total hours at the bar's tip (chart rows). */
  showTotal?: boolean;
  className?: string;
}) {
  const t = useT();
  const total = billable + nonBillable;
  const width = scale > 0 ? Math.max((total / scale) * 100, total > 0 ? 1 : 0) : 0;
  const summary = t('{label}: {total}, {billable} tính tiền, {nonBillable} không tính tiền', {
    label,
    total: formatMinutes(total, t),
    billable: formatMinutes(billable, t),
    nonBillable: formatMinutes(nonBillable, t),
  });
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={<div role="img" aria-label={summary} className="flex h-3.5 min-w-0 flex-1 items-center" />}
          >
            <span className="flex h-full gap-0.5" style={{ width: `${width}%` }}>
              {billable > 0 && (
                <span
                  className={cn('h-full min-w-1 bg-chart-billable', nonBillable === 0 && 'rounded-e-sm')}
                  style={{ flex: `${billable} 1 0` }}
                />
              )}
              {nonBillable > 0 && (
                <span
                  className="h-full min-w-1 rounded-e-sm bg-chart-nonbillable"
                  style={{ flex: `${nonBillable} 1 0` }}
                />
              )}
            </span>
          </TooltipTrigger>
          <TooltipPopup>
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-medium">{label}</span>
              <span className="inline-flex items-center gap-1.5">
                <Swatch kind="billable" />
                {t('Tính tiền: {time}', { time: formatMinutes(billable, t) })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Swatch kind="nonbillable" />
                {t('Không tính tiền: {time}', { time: formatMinutes(nonBillable, t) })}
              </span>
            </div>
          </TooltipPopup>
        </Tooltip>
        {showTotal && (
          <span className="w-20 shrink-0 text-end text-sm font-medium tabular-nums">{formatHours(total, t)}</span>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        {billable > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Swatch kind="billable" />
            {t('{time} tính tiền', { time: formatHours(billable, t) })}
          </span>
        )}
        {nonBillable > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Swatch kind="nonbillable" />
            {t('{time} không tính tiền', { time: formatHours(nonBillable, t) })}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * A thin billable / non-billable split under a number in a list row (its own total is the scale). The row's
 * text carries the hours; the exact split is in the accessible label.
 */
export function MiniBillableBar({ billable, nonBillable }: { billable: number; nonBillable: number }) {
  const t = useT();
  const total = billable + nonBillable;
  if (total <= 0) return null;
  return (
    <span
      role="img"
      aria-label={t('{billable} tính tiền, {nonBillable} không tính tiền', {
        billable: formatMinutes(billable, t),
        nonBillable: formatMinutes(nonBillable, t),
      })}
      className="flex h-1 w-full gap-0.5"
    >
      {billable > 0 && (
        <span
          className={cn('h-full min-w-1 bg-chart-billable', nonBillable === 0 && 'rounded-e-sm')}
          style={{ flex: `${billable} 1 0` }}
        />
      )}
      {nonBillable > 0 && (
        <span className="h-full min-w-1 rounded-e-sm bg-chart-nonbillable" style={{ flex: `${nonBillable} 1 0` }} />
      )}
    </span>
  );
}
