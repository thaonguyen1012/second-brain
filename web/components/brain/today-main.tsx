'use client';
// "Hôm nay" tiles loaded with next/dynamic (today.tsx): the tile frame, the week's objectives, the inbox and today's
// brief. They carry BrainCard, Badge, labels and the API error state, which stay outside the home page's first JS.
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight, Inbox, type LucideIcon } from 'lucide-react';
import { api, type ApiError, type ApiInboxEntry, type ApiNewsFeedback } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { areaIcon, navRow } from '@/lib/app-nav';
import { addDays, formatDay, mondayOf, todayPrague } from '@/lib/dates';
import { formatDate, hostOf, objectiveStatuses } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiErrorState, describeApiError } from './api-state';
import { BrainCard, StatusBadge } from './brain-card';
import { useInboxCount } from './inbox-count';
import { SectionHeader, wellClass } from './layout';
import { weekdayIndex } from './tuan/week-utils';

// The menu (Base UI Menu + opportunity list) loads only when a brief is shown.
const EvidenceMenu = dynamic(() => import('./evidence-menu'), {
  ssr: false,
  loading: () => <Skeleton className="ms-auto size-8 rounded-lg sm:size-7" />,
});

// Inbox and feedback buttons of a brief card: also loaded on demand.
const BriefActions = dynamic(() => import('./brief-actions'), {
  ssr: false,
  loading: () => <Skeleton className="h-8 w-48 rounded-lg sm:h-7" />,
});

/**
 * A "Hôm nay" rail tile: a well (DESIGN.md §9a, D15: borderless grey, secondary), quieter than the white hero.
 * The header starts with the icon of where its link leads (16px, no tile; §4, §5): an `href` with a sidebar row
 * gives that row's icon in its area colour; `icon` is for a place outside the six areas (Inbox), in muted ink.
 */
export function Panel({
  title,
  meta,
  icon,
  href,
  linkLabel,
  children,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const row = navRow(href);
  const Icon = row?.icon ?? icon;
  return (
    <section className={cn(wellClass, 'flex min-w-0 flex-col gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2 border-b pb-2">
        {Icon && (
          <Icon aria-hidden className={cn('size-4 shrink-0', row ? areaIcon[row.area] : 'text-muted-foreground')} />
        )}
        <h2 className="truncate font-heading text-[15px] font-semibold tracking-tight">{title}</h2>
        {meta && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{meta}</span>}
        <Button size="xs" variant="ghost" className="ms-auto -me-2" render={<Link href={href} />}>
          {linkLabel}
          <ArrowRight aria-hidden />
        </Button>
      </div>
      {children}
    </section>
  );
}

/** One line for a tile whose data did not load: what went wrong and "Thử lại" (no alert box in a small tile). */
export function TileError({ error, onRetry, text }: { error?: ApiError; onRetry: () => void; text?: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {text ?? (error ? describeApiError(error).title : 'Không tải được dữ liệu')}.{' '}
      <button type="button" onClick={onRetry} className="rounded-sm underline underline-offset-2 hover:text-foreground">
        Thử lại
      </button>
    </p>
  );
}

const rowLine = 'flex h-8 min-w-0 items-center gap-2 text-sm';

/**
 * The week's objectives (GET /api/weeks/current; 3 is the target, 3–5 the guideline): always rows 1–3, an empty one
 * says "Chưa chọn" and the first of them carries the way to choose. From Friday a week without objectives points
 * to the review and to next week's plan instead, like the Tuần page's own default tab.
 */
export function TodayWeek() {
  const week = useApi('week', api.getCurrentWeek);
  const objectives = week.data?.objectives ?? [];
  const today = todayPrague();
  return (
    <Panel title="3 ưu tiên tuần" href="/tuan/" linkLabel="Tuần">
      {week.error && !week.data ? (
        <TileError error={week.error} onRetry={week.reload} />
      ) : !week.data ? (
        <Skeleton className="h-24 rounded-md" />
      ) : objectives.length === 0 && weekdayIndex(today) >= 4 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Cuối tuần: nhìn lại 15 phút.</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Button variant="outline" size="sm" render={<Link href="/tuan/?tab=nhin-lai" />}>
              Nhìn lại
            </Button>
            <Button
              variant="link"
              size="sm"
              render={<Link href={`/tuan/?w=${addDays(mondayOf(today), 7)}&tab=ke-hoach`} />}
            >
              Chọn ưu tiên tuần tới
            </Button>
          </div>
        </div>
      ) : (
        <ol className="flex flex-col">
          {objectives.map((o, i) => {
            const s = objectiveStatuses[o.status ?? 'open'] ?? objectiveStatuses.open;
            return (
              <li key={o.id} className={rowLine}>
                <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className={cn('min-w-0 flex-1 truncate', o.status === 'dropped' && 'line-through opacity-70')}>
                  {o.title}
                </span>
                {o.status !== 'open' && <StatusBadge tone={s.tone}>{s.label}</StatusBadge>}
              </li>
            );
          })}
          {[0, 1, 2].slice(objectives.length).map((i) => (
            <li key={`empty-${i}`} className={rowLine}>
              <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="flex-1 text-muted-foreground">Chưa chọn</span>
              {i === objectives.length && (
                <Button variant="outline" size="sm" render={<Link href="/tuan/?tab=ke-hoach" />}>
                  Chọn 3 ưu tiên
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

const INBOX_ROWS = 3;

/** The first line of an entry: its page title, else the first line of its text, else its URL. */
const entryTitle = (e: ApiInboxEntry) => e.ogTitle || e.text?.split('\n')[0] || e.url || '';

/** The newest entries waiting in the inbox, with the same count as the top bar button. */
export function TodayInbox() {
  const n = useInboxCount();
  const list = useApi('today-inbox', () => api.listInbox({ status: 'inbox', limit: INBOX_ROWS }));
  const rows = list.data?.results ?? [];
  const more = n === null ? 0 : Number(n) - rows.length;
  return (
    <Panel title={n === null ? 'Inbox' : `Inbox · ${n}`} icon={Inbox} href="/inbox/" linkLabel="Xử lý">
      {list.error && !list.data ? (
        <TileError text="Chưa đọc được inbox" onRetry={list.reload} />
      ) : !list.data ? (
        <Skeleton className="h-20 rounded-md" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inbox trống.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {rows.map((e) => (
            <li key={e.id}>
              <Link
                href={`/inbox/?status=inbox&id=${e.id}`}
                className="flex h-10 min-w-0 flex-col justify-center rounded-md px-2 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate text-sm leading-5">{entryTitle(e)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {e.ogSiteName || hostOf(e.url) || 'Ghi nhanh'}
                </span>
              </Link>
            </li>
          ))}
          {more > 0 && <li className="px-2 pt-1 text-xs text-muted-foreground tabular-nums">+ {more} mục nữa</li>}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Today's morning brief (GET /api/brief/today; 404 before 06:30). Without one, the status says whether the job
 * never ran or ran on an earlier day, so the empty line tells what to do rather than "come back later".
 */
export function TodayBrief({ className }: { className?: string }) {
  const brief = useApi('brief-today', api.getTodayBrief);
  const empty = brief.data === null || brief.data?.items.length === 0;
  const status = useApi(empty ? 'brief-status' : null, api.getStatus);
  const onRated = (id: number, feedback: ApiNewsFeedback | null) =>
    brief.mutate((d) => d && { ...d, items: d.items.map((n) => (n.id === id ? { ...n, feedback } : n)) });
  const items = brief.data?.items ?? [];
  const tools = items.filter((n) => n.newTool).length;
  const last = status.data?.lastBriefDate;
  return (
    <section className={cn('flex min-w-0 flex-col gap-3', className)} aria-labelledby="today-brief">
      <SectionHeader
        id="today-brief"
        title="Bản tin hôm nay"
        meta={items.length > 0 && `${items.length} tin${tools ? ` · ${tools} công cụ mới` : ''}`}
      />
      {brief.error && brief.data === undefined ? (
        <ApiErrorState error={brief.error} onRetry={brief.reload} />
      ) : brief.data === undefined || (empty && !status.data && !status.error) ? (
        <Skeleton className="h-5 w-full max-w-md rounded" />
      ) : empty ? (
        // Sized to its content (DESIGN.md D26): one line, no empty box
        <p className="text-sm text-muted-foreground">
          {/* no link: no guide on /huong-dan/ covers the brief, and the sentence already says what to run */}
          {status.data && !last ? (
            'Bản tin chưa chạy lần nào. Tác vụ nền (make jobs) lấy tin lúc 6:30.'
          ) : last && last !== todayPrague() ? (
            `Chưa có bản tin hôm nay (bản gần nhất ${formatDay(last)}).`
          ) : (
            'Chưa có bản tin hôm nay.'
          )}
        </p>
      ) : (
        <>
          {brief.data?.intro && (
            // The intro is written by the LLM (brief_intro): say so in words (DESIGN.md §4, D18)
            <div className="flex max-w-3xl flex-col gap-1">
              <p className="text-sm leading-relaxed">{brief.data.intro}</p>
              <span className="text-xs text-muted-foreground">tự động</span>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((n) => (
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
