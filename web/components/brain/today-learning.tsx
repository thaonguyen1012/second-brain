'use client';
// "Hôm nay" learning blocks loaded with next/dynamic (today.tsx): the week's rhythm, the handbooks in numbers, the
// setup checklist and the next steps of the roadmap. Books and roadmap come from the server as props, with their
// class strings resolved there (lib/track-colors.ts), so no registry or colour map ships to the browser.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Circle, CircleCheck } from 'lucide-react';
import { weeksApi } from '@/lib/api/weeks';
import { useApi } from '@/lib/api/use-api';
import { addDays, mondayOf, todayPrague } from '@/lib/dates';
import { useProgress } from '@/lib/progress';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { Button } from '@/components/ui/button';
import { MenuItem } from '@/components/ui/menu';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { bookHref, bookState, doneIn, percent, type HeroBook } from '@/components/progress';
import { cn } from '@/lib/utils';
import { SectionHeader } from './layout';
import { type CountKey, useNavCounts } from './nav-counts';
import { RowMenu } from './row-menu';
import { Panel, TileError } from './today-main';
import { dayLabel, isoWeek, weekdayIndex } from './tuan/week-utils';
import { StripLegend, WeekStrip, dayLevel, type DayLevel, type StripDay } from './week-strip';

/** Study days a week aims for (no streaks: a missed day is a muted cell, DESIGN.md D31). */
const WEEK_TARGET_DAYS = 5;

/**
 * A 64px (or full-width) bar in a book's group colour; the number beside it carries the meaning. Forced colours
 * draw the rail's outline and a CanvasText fill, as ui/progress.tsx does.
 */
function Bar({ done, total, fill, className }: { done: number; total: number; fill: string; className?: string }) {
  return (
    <span aria-hidden className={cn('block h-1.5 overflow-hidden rounded-full bg-input forced-colors:outline', className)}>
      <span
        className={cn('block h-full forced-colors:bg-[CanvasText]', done > 0 && 'min-w-1.5', fill)}
        style={{ width: `${total ? Math.min(100, (done / total) * 100) : 0}%` }}
      />
    </span>
  );
}

const levelText: Record<DayLevel, Msg> = { 0: msg('chưa ghi gì'), 1: msg('chỉ có việc khác'), 2: msg('có bài học') };

/**
 * This week's rhythm: the 7-day strip from the week review (a day with a lesson marked done, other activity only,
 * nothing) and the days with a lesson against the target, the screen's one big number (DESIGN.md D3).
 */
export function TodayRhythm() {
  const t = useT();
  const today = todayPrague();
  const monday = mondayOf(today);
  const review = useApi(`today-review:${monday}`, () => weeksApi.getReview(monday));
  const header = {
    title: t('Tuần {week}', { week: isoWeek(monday) }),
    meta: t('còn {n} ngày', { n: 7 - weekdayIndex(today) }),
    href: '/tuan/',
  };
  if (review.error && review.data === undefined)
    return (
      <Panel {...header} linkLabel={t('Tuần')}>
        <TileError text={t('Chưa đọc được tuần này')} onRetry={review.reload} />
      </Panel>
    );
  if (review.data === undefined) return <Skeleton className="h-36 rounded-xl" />;
  // A week never opened has no review (null): every day is level 0.
  const days: StripDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const d = review.data?.days.find((x) => x.date === date);
    const level = d ? dayLevel(d) : 0;
    return { date, level, label: `${dayLabel(date, t)}: ${date > today ? t('chưa tới') : t(levelText[level])}` };
  });
  const studied = days.filter((d) => d.level === 2).length;
  return (
    <Panel {...header} linkLabel={t('Tuần')}>
      {/* 4px cell gaps keep strip and number on one line in the 288px rail; it wraps only on a 320px phone */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <WeekStrip days={days} today={today} className="gap-1" />
        <p className="flex shrink-0 flex-col items-end">
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {studied}/{WEEK_TARGET_DAYS}
          </span>
          <span className="text-xs text-muted-foreground">{t('ngày học')}</span>
        </p>
      </div>
      {/* the cell colours in words, as on Tuần; "mục tiêu" stays the word for the week's objectives */}
      <StripLegend />
      <p className="text-xs text-muted-foreground">
        {t('Nhắm tới {n} ngày có bài học mỗi tuần', { n: WEEK_TARGET_DAYS })}
      </p>
    </Panel>
  );
}

/** A Sổ tay group as the server resolves it: its title and the fill class of its colour. */
export interface BookGroup {
  slug: string;
  title: string;
  fill: string;
}

/** Lessons done in a book, never above its lesson count (a renamed page can leave an old mark behind). */
const doneOf = (done: Parameters<typeof doneIn>[0], b: HeroBook) => Math.min(b.lessonCount, doneIn(done, b.slug));

/** The handbooks in numbers, never empty: lessons done of all, books in progress (as Sổ tay counts them), one bar per group. */
export function TodayBooks({ books, groups }: { books: HeroBook[]; groups: BookGroup[] }) {
  const t = useT();
  const { done, loaded } = useProgress();
  const sum = (list: HeroBook[], f: (b: HeroBook) => number) => list.reduce((n, b) => n + f(b), 0);
  const started = books.filter((b) => bookState(done, b.slug, b.lessonCount) === 'started').length;
  return (
    <Panel title={t('Sổ tay')} href="/phat-trien/" linkLabel={t('Sổ tay')}>
      {!loaded ? (
        <Skeleton className="h-20 rounded-md" />
      ) : (
        <>
          <p className="text-sm">
            {t.rich('<b>{done} / {total}</b> bài · {started} đang học', {
              b: (chunks) => <span className="font-medium tabular-nums">{chunks}</span>,
              done: t.num(sum(books, (b) => doneOf(done, b))),
              total: t.num(sum(books, (b) => b.lessonCount)),
              started,
            })}
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-xs">
            {groups.map((g) => {
              const own = books.filter((b) => b.track === g.slug);
              const n = sum(own, (b) => doneOf(done, b));
              const total = sum(own, (b) => b.lessonCount);
              return (
                <div key={g.slug} className="contents">
                  <dt className="text-muted-foreground">{g.title}</dt>
                  <dd>
                    <Bar done={n} total={total} fill={g.fill} />
                  </dd>
                  <dd className="text-end text-muted-foreground tabular-nums">
                    {t.num(n)}/{t.num(total)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
    </Panel>
  );
}

interface SetupStep {
  key: CountKey;
  label: Msg;
  hint: Msg;
  action: Msg;
  href: string;
}

/** The five first steps of the second brain, each ticked by its sidebar count (GET /api/counts). */
const steps: readonly SetupStep[] = [
  {
    key: 'items',
    label: msg('Thêm khóa học vào Thư viện'),
    hint: msg('Khóa học, sách hay bài viết đang theo: mỗi thứ là một item.'),
    action: msg('Mở Thư viện'),
    href: '/thu-vien/',
  },
  {
    key: 'objectivesOpen',
    label: msg('Chọn 3 ưu tiên tuần này'),
    hint: msg('Ba kết quả muốn có trong tuần, nhìn lại vào cuối tuần.'),
    action: msg('Chọn ưu tiên'),
    href: '/tuan/?tab=ke-hoach',
  },
  {
    key: 'notes',
    label: msg('Viết ghi chú đầu tiên'),
    hint: msg('Ghi lại điều đáng nhớ và gắn vào item.'),
    action: msg('Viết ghi chú'),
    href: '/thu-vien/ghi-chu/',
  },
  {
    key: 'skills',
    label: msg('Thêm kỹ năng đầu tiên'),
    hint: msg('Kỹ năng được giữ mới bằng bằng chứng: item, ghi chú, link.'),
    action: msg('Mở Kỹ năng'),
    href: '/phat-trien/ky-nang/',
  },
  {
    key: 'projects',
    label: msg('Tạo dự án để bấm giờ'),
    hint: msg('Dự án freelance: khách, cách tính tiền và giá.'),
    action: msg('Mở Dự án'),
    href: '/cong-viec/',
  },
];

const SETUP_KEY = 'alex-brain:setup:v1';
/** How long the checklist keeps its place for the sidebar's counts (GET /api/counts) before giving up. */
const COUNTS_WAIT_MS = 3000;

/** Steps ticked once and the "Ẩn" choice, in this browser only (a per-viewer convenience). */
interface SetupState {
  ticked: string[];
  hidden?: boolean;
}

function readSetup(): SetupState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SETUP_KEY) ?? '{}') as Partial<SetupState>;
    return { ticked: Array.isArray(parsed.ticked) ? parsed.ticked : [], hidden: parsed.hidden === true };
  } catch {
    return { ticked: [] };
  }
}

function writeSetup(state: SetupState) {
  try {
    window.localStorage.setItem(SETUP_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable: the ticks come back from the counts next time
  }
}

/**
 * From Friday the week that is ending is not planned any more: like the Tuần tile (today-main.tsx), the objectives
 * step points to next week's plan. Its tick still comes from this week's open objectives, so it ticks on Monday.
 */
function stepFor(s: SetupStep, today: string): SetupStep {
  if (s.key !== 'objectivesOpen' || weekdayIndex(today) < 4) return s;
  return { ...s, label: msg('Chọn 3 ưu tiên tuần tới'), href: `/tuan/?w=${addDays(mondayOf(today), 7)}&tab=ke-hoach` };
}

/**
 * "Thiết lập bộ não thứ hai" (DESIGN.md §9a): five steps ticked only from real data; a step ticked once stays ticked
 * (deleting the only note does not undo it). Only the next open step shows its hint and button. Gone at 5/5, after
 * "Ẩn", or while the counts are unknown (API absent). While the sidebar's counts are on their way, a card this
 * browser has not hidden or finished holds its place, so the roadmap and brief below do not jump down.
 */
export function TodaySetup({ className }: { className?: string }) {
  const t = useT();
  const today = todayPrague();
  const counts = useNavCounts();
  const [stored, setStored] = useState<SetupState>(readSetup);
  const [waited, setWaited] = useState(false);
  const isDone = (key: CountKey) => stored.ticked.includes(key) || (counts?.[key] ?? 0) > 0;
  const ticked = steps.filter((s) => isDone(s.key)).map((s) => s.key);
  const tickedKey = ticked.join(',');
  useEffect(() => {
    if (counts && tickedKey !== stored.ticked.join(',')) writeSetup({ ...stored, ticked: tickedKey.split(',') });
  }, [counts, stored, tickedKey]);
  // counts that are still null after this are unknown for good (API absent): drop the placeholder
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), COUNTS_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (stored.hidden || ticked.length === steps.length) return null;
  if (!counts) return waited ? null : <Skeleton className={cn('h-80 rounded-xl sm:h-64', className)} />;
  const next = steps.find((s) => !isDone(s.key));
  const hide = () => {
    const state = { ticked, hidden: true };
    writeSetup(state);
    setStored(state);
  };
  return (
    <section aria-labelledby="today-setup" className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex items-center gap-3 py-1.5 ps-4 pe-2">
        <h2 id="today-setup" className="min-w-0 font-heading text-[15px] font-semibold tracking-tight">
          {t('Thiết lập bộ não thứ hai')}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {ticked.length}/{steps.length}
        </span>
        <Progress
          value={(ticked.length / steps.length) * 100}
          aria-label={t('Tiến độ thiết lập')}
          className="w-20 max-sm:hidden"
        >
          <ProgressTrack className="h-1">
            <ProgressIndicator className="bg-chart-data" />
          </ProgressTrack>
        </Progress>
        <div className="ms-auto">
          <RowMenu label={t('Tùy chọn thiết lập')}>
            <MenuItem onClick={hide}>{t('Ẩn')}</MenuItem>
          </RowMenu>
        </div>
      </div>
      <ol className="divide-y border-t">
        {steps.map((step) => stepFor(step, today)).map((s) =>
          isDone(s.key) ? (
            <li key={s.key} className="flex h-10 items-center gap-3 px-4 text-sm text-muted-foreground">
              <CircleCheck aria-hidden className="size-4 shrink-0 text-success-foreground" />
              <span className="truncate">
                {t(s.label)}
                <span className="sr-only"> {t('(xong)')}</span>
              </span>
            </li>
          ) : s.key === next?.key ? (
            <li
              key={s.key}
              className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
            >
              <Circle aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{t(s.label)}</span>
                <span className="text-xs text-muted-foreground">{t(s.hint)}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                className="col-start-2 justify-self-start sm:col-start-3"
                render={<Link href={s.href} />}
              >
                {t(s.action)}
              </Button>
            </li>
          ) : (
            <li key={s.key}>
              <Link
                href={s.href}
                className="flex h-10 items-center gap-3 px-4 text-sm outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <Circle aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{t(s.label)}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}

/** One line of the roadmap: a course (or an IT stage) and the handbooks it is studied with. */
export interface RoadmapRow {
  text: string;
  books: string[];
  /** Before the book titles in the second line (an IT stage's months). */
  meta?: string;
}

/** A roadmap phase (business) or stage (IT): its short name ("Giai đoạn 1, nền · tháng 0–5") and its rows. */
export interface RoadmapStep {
  label: string;
  rows: RoadmapRow[];
}

/**
 * "Tiếp theo trong lộ trình": three rows from the current phase on, the first phase whose handbooks are not all
 * done. The track follows the last visited book: an IT book shows the IT stages, anything else the business phases.
 */
export function TodayRoadmap({
  books,
  business,
  it,
  className,
}: {
  books: HeroBook[];
  business: RoadmapStep[];
  it: RoadmapStep[];
  className?: string;
}) {
  const t = useT();
  const { done, lastVisited: last, loaded } = useProgress();
  const bySlug = new Map(books.map((b) => [b.slug, b]));
  const steps = (last && bySlug.get(last.bookSlug)?.track) === 'it' ? it : business;
  const sums = (slugs: string[]) => {
    let n = 0;
    let total = 0;
    for (const slug of new Set(slugs)) {
      const b = bySlug.get(slug);
      if (b) {
        n += doneOf(done, b);
        total += b.lessonCount;
      }
    }
    return [n, total] as const;
  };
  const found = steps.findIndex((st) => {
    const [n, total] = sums(st.rows.flatMap((r) => r.books));
    return n < total;
  });
  const current = found < 0 ? steps.length - 1 : found;
  const rows = steps
    .slice(current)
    .flatMap((st) => st.rows)
    .slice(0, 3);
  return (
    <section aria-labelledby="today-roadmap" className={cn('flex min-w-0 flex-col gap-3', className)}>
      <SectionHeader
        id="today-roadmap"
        title={t('Tiếp theo trong lộ trình')}
        meta={loaded && steps[current]?.label}
        action={{ label: t('Lộ trình'), href: '/lo-trinh/' }}
      />
      {!loaded ? (
        <Skeleton className="h-[170px] rounded-xl" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {rows.map((r) => {
            const own = r.books.flatMap((slug) => bySlug.get(slug) ?? []);
            const first = own[0];
            const [n, total] = sums(r.books);
            const href = !first
              ? '/lo-trinh/'
              : last?.bookSlug === first.slug
                ? bookHref(first, last.pageSlug)
                : bookHref(first);
            return (
              <li key={r.text}>
                <Link
                  href={href}
                  className="flex h-14 items-center gap-3 px-4 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{r.text}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[r.meta, ...own.map((b) => b.title)].filter(Boolean).join(' · ') || t('Chưa có sổ tay')}
                    </span>
                  </span>
                  {first && (
                    <>
                      <span className="text-xs text-muted-foreground tabular-nums">{percent(n, total)}</span>
                      <Bar done={n} total={total} fill={first.fill} className="w-16 shrink-0 max-sm:hidden" />
                    </>
                  )}
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
