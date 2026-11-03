import type { ReactElement, ReactNode } from 'react';
import type { ApiOpportunity } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusBadge } from '../brain-card';
import { daysUntil, formatDay, freshness, scoreDims } from './labels';

function decideBy(day: string) {
  const left = daysUntil(day);
  const tone = left < 0 ? ('error' as const) : left <= 7 ? ('warning' as const) : null;
  const text =
    left < 0
      ? `Quá hạn quyết định ${formatDay(day)}`
      : left === 0
        ? 'Hạn quyết định hôm nay'
        : `Quyết trước ${formatDay(day)}`;
  return { tone, text };
}

/** Decide-by date in the detail header: warning within a week, error once past (still undecided). */
export function DecideByBadge({ day }: { day: string | null }) {
  if (!day) return null;
  const { tone, text } = decideBy(day);
  return <StatusBadge tone={tone ?? 'outline'}>{text}</StatusBadge>;
}

/** Decide-by date in a list row: a badge only when it needs attention, otherwise a muted date. */
export function DecideByCell({ day }: { day: string | null }) {
  if (!day) return null;
  const { tone, text } = decideBy(day);
  if (tone) return <StatusBadge tone={tone}>{text}</StatusBadge>;
  return <span className="text-xs text-muted-foreground tabular-nums">{text}</span>;
}

/** The newest score snapshot as four aligned numbers (Cơ hội · Nỗi đau · Khả thi · Thời điểm). */
export function ScoresCell({ scores }: { scores: ApiOpportunity['scores'] }) {
  if (!scores) return <span className="text-xs text-muted-foreground">Chưa chấm điểm</span>;
  const spoken = scoreDims.map((d) => `${d.label} ${scores[d.key]}`).join(', ');
  return (
    <span className="text-xs text-muted-foreground tabular-nums" title={spoken}>
      <span aria-hidden>
        {scoreDims.map((d, i) => (
          <span key={d.key}>
            {i > 0 && ' · '}
            <span className="font-medium text-foreground">{scores[d.key]}</span>
          </span>
        ))}
      </span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

/** "Hợp với mình": skill names as outline badges (the app's one tag style), freshness as a muted word. */
export function FitBadges({ fit }: { fit: ApiOpportunity['fit'] }) {
  if (fit.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Kỹ năng hợp với mình">
      {fit.map((s) => (
        <li key={s.id} className="inline-flex items-center gap-1.5">
          <Badge variant="outline">{s.name}</Badge>
          <span className="text-xs text-muted-foreground">{freshness[s.freshness].label.toLowerCase()}</span>
        </li>
      ))}
    </ul>
  );
}

/** A tooltip around an icon-only (or shortcut-carrying) control; `trigger` must be one focusable element. */
export function Tip({ trigger, children }: { trigger: ReactElement; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipPopup>{children}</TooltipPopup>
    </Tooltip>
  );
}

/** Loading rows at the real geometry: one bordered list of 56px two-line rows. */
export function RowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col divide-y rounded-xl border bg-card" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 px-3">
          <Skeleton className="h-4.5 w-16" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2 max-w-80" />
            <Skeleton className="h-3 w-1/3 max-w-48" />
          </div>
          <Skeleton className="h-3 w-20 max-md:hidden" />
        </div>
      ))}
    </div>
  );
}
