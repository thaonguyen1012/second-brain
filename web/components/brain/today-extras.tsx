'use client';
// "Hôm nay" panels loaded with next/dynamic (today.tsx), so they stay outside the home page's first JS.
import { CircleAlert } from 'lucide-react';
import { api, type ApiStatus } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { daysBetween, formatDay, todayPrague } from '@/lib/dates';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { describeApiError } from './api-state';
import { DuePredictionList, PREDICTIONS_HREF, useDuePredictions } from './due-predictions';
import { Panel, TileError } from './today-main';

/**
 * Predictions whose 6 months are up (DECISIONS 4.8), with a link to score them on Thành tựu. Rarely due, so nothing
 * shows while loading or once the list is known to be empty: a tile that appears and vanishes would push the setup
 * checklist and the roadmap below the rail (phone, lg) up and down on every visit.
 */
export function TodayPredictions({ className }: { className?: string }) {
  const t = useT();
  const due = useDuePredictions();
  const failed = due.error && !due.data;
  if (!failed && (!due.data || due.data.results.length === 0)) return null;
  return (
    <Panel
      title={t('Dự đoán cần chấm lại')}
      href={PREDICTIONS_HREF}
      linkLabel={t('Thành tựu')}
      className={className}
    >
      {failed ? <TileError text={t('Chưa đọc được dự đoán')} onRetry={due.reload} /> : <DuePredictionList due={due} />}
    </Panel>
  );
}

/** Background job kinds (backend `@jobs.handler`), in Vietnamese. Unknown kinds show as sent. */
const jobKinds: Record<string, Msg> = {
  unfurl: msg('lấy thẻ link'),
  tag: msg('gắn tag inbox'),
  feeds: msg('tải nguồn tin'),
  brief: msg('dựng bản tin'),
  news_tag: msg('gắn tag tin'),
  brief_intro: msg('lời mở bản tin'),
  jd_skills: msg('đọc tin tuyển dụng'),
};

const usd = (n: number, t: T) => `${t.num(n, { maximumFractionDigits: n > 0 && n < 1 ? 3 : 2 })} USD`;

/** A warning chip: the warning badge plus an icon, so the state is never colour alone. Keep the text short. */
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="warning">
      <CircleAlert aria-hidden />
      {children}
    </Badge>
  );
}

function StatusParts({ status }: { status: ApiStatus }) {
  const t = useT();
  const { llm, jobs, lastBriefDate } = status;
  const overBudget = llm.budgetUsd > 0 && llm.monthCostUsd >= llm.budgetUsd * 0.8;
  const costText = t('LLM tháng này {cost} / {budget}', { cost: usd(llm.monthCostUsd, t), budget: usd(llm.budgetUsd, t) });
  // On the free tier the cost is what the calls would cost on the paid tier: said in a tooltip, not in the line
  const costLabel = llm.freeTier ? (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className="rounded-sm underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {costText}
      </TooltipTrigger>
      <TooltipPopup>{t('Gói miễn phí, tính theo giá trả phí')}</TooltipPopup>
    </Tooltip>
  ) : (
    costText
  );
  const calls =
    llm.failedCalls > 0
      ? t('{n} lần gọi, {failed} lỗi', { n: llm.calls, failed: t.count(llm.failedCalls) })
      : t('{n} lần gọi', { n: llm.calls });

  // Only a missed day is a warning. Before 06:30 the newest brief is yesterday's (age 1), and after it a missing
  // brief of today is already said by the empty state of "Bản tin hôm nay"; no brief at all (age null) too.
  const age = lastBriefDate ? daysBetween(lastBriefDate, todayPrague()) : null;
  const brief = lastBriefDate
    ? t('Bản tin gần nhất {date}', { date: formatDay(lastBriefDate) })
    : t('Chưa có bản tin nào');

  const pending = jobs.pending.reduce((n, j) => n + j.count, 0);
  const failed = jobs.failed.reduce((n, j) => n + j.count, 0);
  const failedKinds = jobs.failed
    .map((j) => `${jobKinds[j.kind] ? t(jobKinds[j.kind]) : j.kind} ${t.count(j.count)}`)
    .join(', ');

  return (
    <>
      <span>
        {overBudget ? <Warn>{costLabel}</Warn> : costLabel}
        {' · '}
        {calls}
      </span>
      <span>{age !== null && age > 1 ? <Warn>{brief}</Warn> : brief}</span>
      <span>
        {pending > 0 ? t('{n} tác vụ đang chờ', { n: pending }) : t('Không có tác vụ chờ')}
        {failed > 0 && (
          <>
            {' · '}
            <Warn>{t('{n} tác vụ lỗi', { n: failed })}</Warn> ({failedKinds})
          </>
        )}
      </span>
    </>
  );
}

/** "AI và tác vụ nền" (GET /api/status): month LLM cost vs budget, last brief, waiting and failed jobs. */
export function TodayStatus({ className }: { className?: string }) {
  const t = useT();
  const status = useApi('status', api.getStatus);
  return (
    <section
      aria-labelledby="today-status"
      className={cn(
        'flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3',
        className,
      )}
    >
      <h2 id="today-status" className="font-medium text-foreground">
        {t('AI và tác vụ nền')}
      </h2>
      {status.data ? (
        <StatusParts status={status.data} />
      ) : status.error ? (
        <span>
          {describeApiError(status.error, t).title}.{' '}
          <button type="button" onClick={status.reload} className="underline underline-offset-2 hover:text-foreground">
            {t('Thử lại')}
          </button>
        </span>
      ) : (
        <Skeleton className="h-4 w-64 rounded" />
      )}
    </section>
  );
}
