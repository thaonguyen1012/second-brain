'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, Inbox, type LucideIcon } from 'lucide-react';
import { api, type ApiNewsFeedback } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { areaIcon, navByArea, type AreaKey } from '@/lib/app-nav';
import { formatDate, hostOf, objectiveStatuses } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiErrorState } from './api-state';
import { BrainCard, StatusBadge } from './brain-card';
import { useInboxCount } from './inbox-count';

// The menu (Base UI Menu + opportunity list) loads only when a brief is shown, outside the home First Load JS.
const EvidenceMenu = dynamic(() => import('./evidence-menu'), {
  ssr: false,
  loading: () => <Skeleton className="ms-auto size-8 rounded-lg sm:size-7" />,
});

// Inbox and feedback buttons of a brief card, the due predictions and the status line: also loaded on demand.
const BriefActions = dynamic(() => import('./brief-actions'), {
  ssr: false,
  loading: () => <Skeleton className="h-8 w-48 rounded-lg sm:h-7" />,
});
// Fetch the today-extras chunk as soon as this module runs in the browser (before hydration), so the two panels'
// API requests do not wait for a chunk request that only starts when they first render. Still a separate chunk:
// nothing is added to the first-load JS.
if (typeof window !== 'undefined') void import('./today-extras');
export const TodayPredictions = dynamic(() => import('./today-extras').then((m) => m.TodayPredictions), {
  ssr: false,
  loading: () => <Skeleton className="h-24 rounded-xl md:col-span-2 xl:col-span-1" />,
});
export const TodayStatus = dynamic(() => import('./today-extras').then((m) => m.TodayStatus), {
  ssr: false,
  loading: () => <Skeleton className="h-4 w-72 rounded" />,
});

/**
 * A "Hôm nay" tile: a white bordered surface on the grey page (DESIGN.md D29) with a heading and a link to its
 * page, quieter than "Tiếp tục học" (the focal block, DESIGN.md §1.2, D1). Every tile heading starts with the icon
 * of where its link leads (16px, no tile inside the card; DESIGN.md §4, §5): `area`, a sidebar area, gives its nav
 * icon in the area colour; `icon` is for a place outside the six areas (Inbox), in muted ink.
 */
export function Panel({
  title,
  area,
  icon,
  href,
  linkLabel,
  children,
  className,
}: {
  title: string;
  area?: AreaKey;
  icon?: LucideIcon;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = area ? navByArea[area].icon : icon;
  return (
    <section className={cn('flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4', className)}>
      <div className="flex items-center gap-2 border-b pb-2">
        {Icon && (
          <Icon aria-hidden className={cn('size-4 shrink-0', area ? areaIcon[area] : 'text-muted-foreground')} />
        )}
        <h2 className="font-heading text-[15px] font-semibold tracking-tight">{title}</h2>
        <Button size="xs" variant="ghost" className="ms-auto -me-2" render={<Link href={href} />}>
          {linkLabel}
          <ArrowRight aria-hidden />
        </Button>
      </div>
      {children}
    </section>
  );
}

/** The week's objectives (GET /api/weeks/current); 3 is the target, 3–5 the guideline. */
export function TodayWeek() {
  const week = useApi('week', api.getCurrentWeek);
  const objectives = week.data?.objectives ?? [];
  return (
    <Panel title="3 ưu tiên tuần" area="week" href="/tuan/" linkLabel="Tuần">
      {week.error && !week.data ? (
        <ApiErrorState error={week.error} onRetry={week.reload} />
      ) : !week.data ? (
        <Skeleton className="h-20 rounded-md" />
      ) : objectives.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Tuần từ {formatDate(week.data.startDate)} chưa có mục tiêu.</p>
          <Button variant="outline" size="sm" render={<Link href="/tuan/" />}>
            Chọn 3 ưu tiên
          </Button>
        </div>
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
    <Panel title="Inbox" icon={Inbox} href="/inbox/" linkLabel="Xử lý">
      {n === null ? (
        <p className="text-sm text-muted-foreground">Chưa đọc được inbox (cần kết nối máy chủ).</p>
      ) : (
        <p className="flex items-baseline gap-2">
          <span className="font-heading text-2xl font-semibold tabular-nums">{n}</span>
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
        <h2 id="today-brief" className="font-heading text-lg font-semibold tracking-tight">
          Bản tin hôm nay
        </h2>
        {brief.data && <Badge variant="outline">{formatDate(brief.data.date)}</Badge>}
      </div>
      {brief.error && brief.data === undefined ? (
        <ApiErrorState error={brief.error} onRetry={brief.reload} />
      ) : brief.data === undefined ? (
        <div className="grid gap-3 lg:grid-cols-2" aria-busy="true" aria-label="Đang tải">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : brief.data === null || brief.data.items.length === 0 ? (
        // Sized to its content (DESIGN.md D26): one line, no empty box
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Chưa có bản tin hôm nay.</span> Bản tin được dựng lúc 6:30
          sáng giờ Praha. Quay lại sau nhé.
        </p>
      ) : (
        <>
          {brief.data.intro && (
            // The intro is written by the LLM (brief_intro): say so in words (DESIGN.md §4, D18)
            <div className="flex max-w-3xl flex-col gap-1">
              <p className="text-sm leading-relaxed">{brief.data.intro}</p>
              <span className="text-xs text-muted-foreground">tự động</span>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {brief.data.items.map((n) => (
              <BrainCard
                key={n.id}
                badges={
                  // "Công cụ mới" and the tags come from the LLM (news_tag): outline badges + one "tự động" label
                  (n.newTool || n.tags.length > 0) && (
                    <>
                      {n.newTool && <Badge variant="outline">Công cụ mới</Badge>}
                      {n.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="outline">
                          #{t}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">tự động</span>
                    </>
                  )
                }
                title={
                  <a href={n.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                    {n.title}
                  </a>
                }
                meta={[n.source.name, hostOf(n.url), formatDate(n.published)].filter(Boolean).join(' · ')}
                actions={
                  <>
                    <BriefActions item={n} onRated={onRated} />
                    <EvidenceMenu newsItem={n.id} />
                  </>
                }
              >
                {(n.summary || n.excerpt) && (
                  <p className="line-clamp-4 text-[13px] leading-relaxed text-muted-foreground">
                    {n.summary ? `Tóm tắt tự động: ${n.summary}` : n.excerpt}
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
