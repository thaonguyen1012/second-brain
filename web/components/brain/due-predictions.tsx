'use client';
import { growthApi } from '@/lib/api/growth';
import { useApi } from '@/lib/api/use-api';
import { formatDay } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/client';
import { ApiErrorState } from './api-state';

/** Where predictions are re-scored: the predictions section of "Nhật ký thành tựu". */
export const PREDICTIONS_HREF = '/phat-trien/thanh-tuu/#pred-title';

const SHOWN = 3;

/** Open predictions whose checkOn has come (GET /api/predictions?due=true, Europe/Prague). */
export function useDuePredictions() {
  return useApi('predictions:due', () => growthApi.listPredictions({ due: true, limit: 20 }));
}

/** Short list of due predictions for "Hôm nay" and the week review; scoring happens on Thành tựu. */
export function DuePredictionList({ due }: { due: ReturnType<typeof useDuePredictions> }) {
  const t = useT();
  if (due.error && !due.data) return <ApiErrorState error={due.error} onRetry={due.reload} />;
  if (!due.data) return <Skeleton className="h-16 rounded-xl" />;
  const rows = due.data.results;
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t('Chưa có dự đoán nào đến hạn. Mỗi dự đoán được chấm lại 6 tháng sau khi ghi.')}
      </p>
    );
  const more = rows.length - SHOWN;
  return (
    <div className="flex flex-col gap-2">
      {/* Plain rows split by one divider (DESIGN.md D12, D13): no box per prediction */}
      <ul className="divide-y">
        {rows.slice(0, SHOWN).map((p) => (
          <li key={p.id} className="flex flex-col gap-1 py-2">
            <p className="line-clamp-2 text-sm">{p.statement}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="warning" size="sm">
                {t('Đến hạn {date}', { date: formatDay(p.checkOn) })}
              </Badge>
              <span>{t('Ghi ngày {date}', { date: formatDay(p.madeOn) })}</span>
              {p.confidence ? <span>{t('· tự tin {confidence}/10', { confidence: p.confidence })}</span> : null}
            </div>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('Còn {n}{plus} dự đoán đến hạn nữa.', { n: more, plus: due.data.next ? '+' : '' })}
        </p>
      )}
    </div>
  );
}
