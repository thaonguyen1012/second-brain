import { CalendarClock } from 'lucide-react';
import type { ApiOpportunity } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '../brain-card';
import { daysUntil, formatDay, freshness, scoreDims } from './labels';

/** Decide-by date: warning within a week, error once past (still undecided). */
export function DecideByBadge({ day }: { day: string | null }) {
  if (!day) return null;
  const left = daysUntil(day);
  const tone = left < 0 ? 'error' : left <= 7 ? 'warning' : 'outline';
  const text =
    left < 0
      ? `Quá hạn quyết định ${formatDay(day)}`
      : left === 0
        ? 'Hạn quyết định hôm nay'
        : `Quyết trước ${formatDay(day)}`;
  return (
    <StatusBadge tone={tone}>
      <CalendarClock aria-hidden />
      {text}
    </StatusBadge>
  );
}

/** The newest score snapshot in one line (text tokens only). */
export function ScoresLine({ scores }: { scores: ApiOpportunity['scores'] }) {
  if (!scores) return <p className="text-xs text-muted-foreground">Chưa chấm điểm</p>;
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {scoreDims.map((d) => (
        <div key={d.key} className="flex gap-1">
          <dt className="text-muted-foreground">{d.label}</dt>
          <dd className="font-semibold tabular-nums">{scores[d.key]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Hợp với mình": skill badges coloured by freshness, with the freshness word for screen readers and hover. */
export function FitBadges({ fit }: { fit: ApiOpportunity['fit'] }) {
  if (fit.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Kỹ năng hợp với mình">
      {fit.map((s) => {
        const f = freshness[s.freshness];
        return (
          <li key={s.id}>
            <Badge variant={f.tone} title={`Độ mới: ${f.label}`}>
              {s.name}
              <span className="sr-only"> ({f.label})</span>
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
