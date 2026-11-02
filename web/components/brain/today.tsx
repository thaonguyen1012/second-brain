'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, CalendarRange, Inbox, Newspaper } from 'lucide-react';
import { api, type ApiNewsFeedback } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { formatDate, hostOf, objectiveStatuses } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiErrorState, EmptyState, LoadingCards } from './api-state';
import { BrainCard, StatusBadge } from './brain-card';
import { useInboxCount } from './inbox-count';

// The menu (Base UI Menu + opportunity list) loads only when a brief is shown, outside the home First Load JS.
const EvidenceMenu = dynamic(() => import('./evidence-menu'), {
  ssr: false,
  loading: () => <Skeleton className="h-7 w-44 rounded-md" />,
});

// Inbox and feedback buttons of a brief card, the due predictions and the status line: also loaded on demand.
const BriefActions = dynamic(() => import('./brief-actions'), {
  ssr: false,
  loading: () => <Skeleton className="h-7 w-72 rounded-md" />,
});
export const TodayPredictions = dynamic(() => import('./today-extras').then((m) => m.TodayPredictions), {
  ssr: false,
  loading: () => <Skeleton className="h-36 rounded-3xl md:col-span-2 xl:col-span-1" />,
});
export const TodayStatus = dynamic(() => import('./today-extras').then((m) => m.TodayStatus), {
  ssr: false,
  loading: () => <Skeleton className="h-4 w-72 rounded" />,
});

export function Panel({
  icon: Icon,
  title,
  href,
  linkLabel,
  children,
  className,
}: {
  icon: typeof Inbox;
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-3 rounded-3xl border p-4 shadow-depth-1', className)}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="font-heading text-[15px] font-semibold tracking-tight">{title}</h2>
        <Button size="xs" variant="ghost" className="ms-auto" render={<Link href={href} />}>
          {linkLabel}
          <ArrowRight aria-hidden />
        </Button>
      </div>
      {children}
    </Card>
  );
}

/** The week's objectives (GET /api/weeks/current); 3 is the target, 3–5 the guideline. */
export function TodayWeek() {
  const week = useApi('week', api.getCurrentWeek);
  const objectives = week.data?.objectives ?? [];
  return (
    <Panel icon={CalendarRange} title="3 ưu tiên tuần" href="/tuan/" linkLabel="Tuần">
      {week.error && !week.data ? (
        <ApiErrorState error={week.error} onRetry={week.reload} />
      ) : !week.data ? (
        <Skeleton className="h-20 rounded-xl" />
      ) : objectives.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Tuần từ {formatDate(week.data.startDate)} chưa có mục tiêu. Chọn 3 việc ở trang Tuần.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {objectives.map((o, i) => {
            const s = objectiveStatuses[o.status ?? 'open'] ?? objectiveStatuses.open;
            return (
              <li key={o.id} className="flex items-start gap-2 text-sm">
                <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className={o.status === 'dropped' ? 'flex-1 line-through opacity-70' : 'flex-1'}>{o.title}</span>
                <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/** Inbox count, the same number as the top bar button. */
export function TodayInbox() {
  const n = useInboxCount();
  return (
    <Panel icon={Inbox} title="Inbox" href="/inbox/" linkLabel="Xử lý">
      {n === null ? (
        <p className="text-sm text-muted-foreground">Chưa đọc được inbox (cần kết nối máy chủ).</p>
      ) : (
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-3xl font-semibold tabular-nums">{n}</span>
          <span className="text-sm text-muted-foreground">
            {n === '0' ? 'mục, inbox đã về 0' : 'mục chờ xử lý trong buổi nhìn lại tuần'}
          </span>
        </p>
      )}
    </Panel>
  );
}

/** Today's morning brief (GET /api/brief/today; 404 before 06:30 is an empty state). */
export function TodayBrief() {
  const brief = useApi('brief-today', api.getTodayBrief);
  const onRated = (id: number, feedback: ApiNewsFeedback | null) =>
    brief.mutate((d) => d && { ...d, items: d.items.map((n) => (n.id === id ? { ...n, feedback } : n)) });
  return (
    <section className="flex flex-col gap-4" aria-labelledby="today-brief">
      <div className="flex items-center gap-2">
        <Newspaper className="size-4 text-muted-foreground" aria-hidden />
        <h2 id="today-brief" className="font-heading text-xl font-semibold tracking-tight">
          Bản tin hôm nay
        </h2>
        {brief.data && <Badge variant="outline">{formatDate(brief.data.date)}</Badge>}
      </div>
      {brief.error && brief.data === undefined ? (
        <ApiErrorState error={brief.error} onRetry={brief.reload} />
      ) : brief.data === undefined ? (
        <LoadingCards count={2} />
      ) : brief.data === null || brief.data.items.length === 0 ? (
        <EmptyState
          icon={<Newspaper aria-hidden />}
          title="Chưa có bản tin hôm nay"
          description="Bản tin được dựng lúc 6:30 sáng giờ Praha. Quay lại sau nhé."
        />
      ) : (
        <>
          {brief.data.intro && <p className="max-w-3xl text-sm leading-relaxed">{brief.data.intro}</p>}
          <div className="grid gap-3 lg:grid-cols-2">
            {brief.data.items.map((n) => (
              <BrainCard
                key={n.id}
                badges={
                  <>
                    <Badge variant="secondary">{n.source.name}</Badge>
                    {n.newTool && <Badge variant="info">Công cụ mới</Badge>}
                    {n.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="outline">
                        #{t}
                      </Badge>
                    ))}
                  </>
                }
                title={
                  <a href={n.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                    {n.title}
                  </a>
                }
                meta={[hostOf(n.url), formatDate(n.published)].filter(Boolean).join(' · ')}
                actions={
                  <>
                    <BriefActions item={n} onRated={onRated} />
                    <EvidenceMenu newsItem={n.id} />
                  </>
                }
              >
                {(n.summary || n.excerpt) && (
                  <p className="line-clamp-4 text-[13px] leading-relaxed text-muted-foreground">
                    {n.summary || n.excerpt}
                  </p>
                )}
              </BrainCard>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
