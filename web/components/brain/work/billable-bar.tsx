'use client';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { formatHours, formatMinutes } from './format';

// Two series, fixed order and colour (dataviz palette slots 1-2, tokens --chart-billable / --chart-nonbillable in
// app/global.css, validated in light and dark): billable first from the baseline, non-billable after a 2px gap.

function Swatch({ kind }: { kind: 'billable' | 'nonbillable' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-[3px]',
        kind === 'billable' ? 'bg-chart-billable' : 'bg-chart-nonbillable',
      )}
    />
  );
}

export function BillableLegend({ className }: { className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Swatch kind="billable" />
        Tính tiền
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch kind="nonbillable" />
        Không tính tiền
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
  const total = billable + nonBillable;
  const width = scale > 0 ? Math.max((total / scale) * 100, total > 0 ? 1 : 0) : 0;
  const summary = `${label}: ${formatMinutes(total)}, ${formatMinutes(billable)} tính tiền, ${formatMinutes(nonBillable)} không tính tiền`;
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
                  className={cn('h-full min-w-[3px] bg-chart-billable', nonBillable === 0 && 'rounded-e-[4px]')}
                  style={{ flex: `${billable} 1 0` }}
                />
              )}
              {nonBillable > 0 && (
                <span
                  className="h-full min-w-[3px] rounded-e-[4px] bg-chart-nonbillable"
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
                Tính tiền: {formatMinutes(billable)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Swatch kind="nonbillable" />
                Không tính tiền: {formatMinutes(nonBillable)}
              </span>
            </div>
          </TooltipPopup>
        </Tooltip>
        {showTotal && (
          <span className="w-20 shrink-0 text-end text-sm font-medium tabular-nums">{formatHours(total)}</span>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        {billable > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Swatch kind="billable" />
            {formatHours(billable)} tính tiền
          </span>
        )}
        {nonBillable > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Swatch kind="nonbillable" />
            {formatHours(nonBillable)} không tính tiền
          </span>
        )}
      </p>
    </div>
  );
}
