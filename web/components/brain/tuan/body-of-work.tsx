'use client';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Clock, Layers } from 'lucide-react';
import type { ApiDayWork } from '@/lib/api/weeks';
import { useT } from '@/lib/i18n/client';
import type { T } from '@/lib/i18n/translate';
import { itemTypeLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { dayLevel, StripLegend, type StripDay, WeekStrip } from '../week-strip';
import { WeekSection } from './week-section';
import { dayLabel, minutesShort, todayPrague, weekdayIndex, weekdayLong } from './week-utils';

/** Slug -> title and URL of the handbooks, passed from the server page (lib/books.ts stays out of the bundle). */
export type BookIndex = Record<string, { title: string; href: string }>;

function pageHref(books: BookIndex, book: string, page: string): string | null {
  const b = books[book];
  if (!b) return null;
  return page ? `${b.href}${page.split('/').map(encodeURIComponent).join('/')}` : b.href;
}

const minutesOf = (d: ApiDayWork) => d.minutesForObjectives + d.minutesOther;

const hasWork = (d: ApiDayWork) =>
  d.itemsFinished.length + d.inboxArchived.length + d.pagesDone.length > 0 || minutesOf(d) > 0;

/** The strip cell's native tooltip: "Thứ Hai 2/11: 1 trang sổ tay, 1 mục inbox". */
function cellLabel(d: ApiDayWork, future: boolean, t: T): string {
  if (future) return `${dayLabel(d.date, t)}: ${t('chưa tới')}`;
  const parts = [
    d.pagesDone.length && t('{n} trang sổ tay', { n: d.pagesDone.length }),
    d.itemsFinished.length && t('{n} item xong', { n: d.itemsFinished.length }),
    d.inboxArchived.length && t('{n} mục inbox', { n: d.inboxArchived.length }),
    minutesOf(d) && t('{time} đã ghi', { time: minutesShort(minutesOf(d), t) }),
  ].filter(Boolean);
  return `${dayLabel(d.date, t)}: ${parts.length ? parts.join(', ') : t('chưa ghi gì')}`;
}

/** "Thứ Ba, Năm, Sáu, Bảy": the first weekday in full, the next ones without "Thứ" (Chủ nhật stays whole). */
function foldedDays(days: ApiDayWork[], t: T): string {
  return days
    .map((d, i) => {
      const name = t(weekdayLong[weekdayIndex(d.date)]);
      return i > 0 && name.startsWith('Thứ ') ? name.slice(4) : name; // i18n-ignore: Vietnamese weekday names only
    })
    .join(', ');
}

/**
 * One day with something in it, one icon line per thing done; the day sits on the left once the list is 36rem wide
 * (a container query: the section is half the page from xl), above its lines in a narrower column.
 */
function DayRow({ day, books, isToday }: { day: ApiDayWork; books: BookIndex; isToday: boolean }) {
  const t = useT();
  const minutes = minutesOf(day);
  // Pages done are grouped per handbook: a long day of study reads as "Sổ tay X: 6 trang".
  const byBook = new Map<string, string[]>();
  for (const p of day.pagesDone) byBook.set(p.book, [...(byBook.get(p.book) ?? []), p.page]);

  return (
    <li className="grid gap-x-4 gap-y-1 py-2.5 @xl:grid-cols-[7rem_minmax(0,1fr)]">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold @xl:flex-col @xl:gap-0">
        {dayLabel(day.date, t)}
        {isToday && <span className="text-xs font-normal text-muted-foreground">{t('Hôm nay')}</span>}
      </h3>
      <ul className="flex flex-col gap-1 text-[13px] leading-relaxed">
        {[...byBook].map(([book, pages]) => {
          const b = books[book];
          const first = pageHref(books, book, pages[0]);
          return (
            <li key={`b${book}`} className="flex items-start gap-2">
              <BookOpen className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="text-muted-foreground">{t('Sổ tay:')} </span>
                {first ? (
                  <Link href={first} className="hover:text-primary">
                    {b?.title ?? book}
                  </Link>
                ) : (
                  (b?.title ?? book)
                )}
                <span className="text-muted-foreground"> · {t('{n} trang học xong', { n: pages.length })}</span>
              </span>
            </li>
          );
        })}
        {day.itemsFinished.map((it) => (
          <li key={`i${it.id}`} className="flex items-start gap-2">
            <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="text-muted-foreground">
                {/* a tool is "done" once mastered */}
                {it.type === 'tool'
                  ? t('Đã thành thạo:')
                  : t('Xong {type}:', { type: t(itemTypeLabel(it.type)).toLowerCase() })}{' '}
              </span>
              {it.title}
            </span>
          </li>
        ))}
        {day.inboxArchived.map((e) => (
          <li key={`e${e.id}`} className="flex items-start gap-2">
            <Layers className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="text-muted-foreground">{t('Inbox lưu trữ:')} </span>
              {e.title || t('Không tên')}
            </span>
          </li>
        ))}
        {minutes > 0 && (
          <li className="flex items-start gap-2">
            <Clock className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              <span className="text-muted-foreground">{t('Giờ đã ghi:')} </span>
              <span className="tabular-nums">{minutesShort(minutes, t)}</span>
            </span>
          </li>
        )}
      </ul>
    </li>
  );
}

/**
 * Body of work, Monday to Sunday (finished items, handbook pages, processed inbox, logged hours): the week strip
 * for its shape (DESIGN.md §9a), then only the days with something in them; the empty days so far fold into one
 * line ("Thứ Ba, Năm: chưa ghi gì.").
 */
export function BodyOfWork({ days, books }: { days: ApiDayWork[]; books: BookIndex }) {
  const t = useT();
  const today = todayPrague();
  const shown = days.filter((d) => d.date <= today);
  const busy = shown.filter(hasWork);
  const idle = shown.filter((d) => !hasWork(d));
  const strip: StripDay[] = days.map((d) => ({
    date: d.date,
    level: d.date > today ? 0 : dayLevel(d),
    label: cellLabel(d, d.date > today, t),
  }));
  return (
    <WeekSection id="week-body" title={t('Đã làm được gì, theo ngày')}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <WeekStrip days={strip} today={today} />
        <StripLegend className="pb-1" />
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('Tuần này chưa bắt đầu.')}</p>
      ) : (
        <div className="flex flex-col">
          {busy.length > 0 && (
            <ol className="@container flex flex-col divide-y">
              {busy.map((d) => (
                <DayRow key={d.date} day={d} books={books} isToday={d.date === today} />
              ))}
            </ol>
          )}
          {idle.length > 0 && (
            <p className={cn('text-xs text-muted-foreground', busy.length > 0 && 'border-t pt-2.5')}>
              {t('{days}: chưa ghi gì.', { days: foldedDays(idle, t) })}
            </p>
          )}
        </div>
      )}
    </WeekSection>
  );
}
