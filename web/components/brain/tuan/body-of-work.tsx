'use client';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Layers } from 'lucide-react';
import type { ApiDayWork } from '@/lib/api/weeks';
import { itemTypeLabel } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { WeekSection } from './week-section';
import { dayLabel, minutesShort, todayPrague } from './week-utils';

/** Slug -> title and URL of the handbooks, passed from the server page (lib/books.ts stays out of the bundle). */
export type BookIndex = Record<string, { title: string; href: string }>;

function pageHref(books: BookIndex, book: string, page: string): string | null {
  const b = books[book];
  if (!b) return null;
  return page ? `${b.href}${page.split('/').map(encodeURIComponent).join('/')}` : b.href;
}

function DayBlock({ day, books, isToday }: { day: ApiDayWork; books: BookIndex; isToday: boolean }) {
  const minutes = day.minutesForObjectives + day.minutesOther;
  const empty = day.itemsFinished.length + day.inboxArchived.length + day.pagesDone.length === 0;
  // Pages done are grouped per handbook: a long day of study reads as "Sổ tay X: 6 trang".
  const byBook = new Map<string, string[]>();
  for (const p of day.pagesDone) byBook.set(p.book, [...(byBook.get(p.book) ?? []), p.page]);

  return (
    <li className="flex flex-col gap-1.5 border-b py-2.5 last:border-0">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">{dayLabel(day.date)}</h3>
        {isToday && <Badge variant="info">Hôm nay</Badge>}
        {minutes > 0 && <span className="ms-auto text-xs text-muted-foreground tabular-nums">{minutesShort(minutes)} đã ghi</span>}
      </div>
      {empty ? (
        <p className="text-xs text-muted-foreground">Không có gì được ghi lại.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-[13px] leading-relaxed">
          {day.itemsFinished.map((it) => (
            <li key={`i${it.id}`} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="text-muted-foreground">Xong {itemTypeLabel(it.type).toLowerCase()}: </span>
                {it.title}
              </span>
            </li>
          ))}
          {[...byBook].map(([book, pages]) => {
            const b = books[book];
            const first = pageHref(books, book, pages[0]);
            return (
              <li key={`b${book}`} className="flex items-start gap-2">
                <BookOpen className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <span className="text-muted-foreground">Sổ tay: </span>
                  {first ? (
                    <Link href={first} className="hover:text-primary">
                      {b?.title ?? book}
                    </Link>
                  ) : (
                    (b?.title ?? book)
                  )}
                  <span className="text-muted-foreground"> · {pages.length} trang học xong</span>
                </span>
              </li>
            );
          })}
          {day.inboxArchived.map((e) => (
            <li key={`e${e.id}`} className="flex items-start gap-2">
              <Layers className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="text-muted-foreground">Inbox lưu trữ: </span>
                {e.title || 'Không tên'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Body of work per day (finished items, handbook pages, processed inbox), Monday to Sunday. */
export function BodyOfWork({ days, books }: { days: ApiDayWork[]; books: BookIndex }) {
  const today = todayPrague();
  const shown = days.filter((d) => d.date <= today);
  return (
    <WeekSection
      id="week-body"
      title="Đã làm được gì, theo ngày"
      description="Item xong, trang sổ tay học xong và mục inbox đã xử lý. Dùng để trả lời câu thắng lớn nhất."
    >
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tuần này chưa bắt đầu.</p>
      ) : (
        <ol className="flex flex-col">
          {shown.map((d) => (
            <DayBlock key={d.date} day={d} books={books} isToday={d.date === today} />
          ))}
        </ol>
      )}
    </WeekSection>
  );
}
