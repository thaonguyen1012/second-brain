'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useProgress, type LastVisited } from '@/lib/progress';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/brain/layout';
import { BookCover } from './book-cover';
import { bookState, bookVerb, coverLinkFocus, doneIn, percent, type BookState } from './progress';
import { useT } from '@/lib/i18n/client';
import { msg } from '@/lib/i18n/translate';

// The progress-aware parts of the Sổ tay page (DESIGN.md §9a). The server page passes plain props, class strings
// already resolved, so the registry and the colour maps stay out of this chunk.

/** One handbook as the client parts need it; `href` is the book root. */
export interface ShelfBook {
  slug: string;
  title: string;
  href: string;
  lessonCount: number;
  /** Progress fill of the book's Sổ tay group (`trackFill`). */
  fill: string;
}

/** The last visited page when it belongs to this book. */
function lastIn(slug: string, last: LastVisited | null): LastVisited | null {
  return last && last.bookSlug === slug ? last : null;
}

/** Where "Học tiếp" goes: the last visited page when it is in this book, otherwise the book root. */
function continueHref(href: string, last: LastVisited | null): string {
  return last?.pageSlug ? `${href}${last.pageSlug}/` : href;
}

/** A shelf row's bar; it repeats the text beside it, so it stays out of the link's name. */
function ShelfBar({ done, total, fill, className }: { done: number; total: number; fill: string; className: string }) {
  return (
    <Progress value={total ? Math.min(100, (done / total) * 100) : 0} aria-hidden className={className}>
      <ProgressTrack className="h-1.5">
        <ProgressIndicator className={cn(fill, done > 0 && 'min-w-1.5')} />
      </ProgressTrack>
    </Progress>
  );
}

/**
 * The card's one filled button (owner, 03/11/2026: filled on all 15 cards): "Học ngay", "Học tiếp" once started
 * (to the last visited page when it is in this book), "Ôn lại" from the book root once every lesson is done
 * (`bookState`, shared with the Hôm nay hero). Until the store answers, a placeholder of the button's size, so no
 * wrong verb or link shows meanwhile.
 */
export function BookAction({ slug, href, title, total }: { slug: string; href: string; title: string; total: number }) {
  const t = useT();
  const progress = useProgress();
  if (progress.loaded === false) return <Skeleton className="h-8 w-20 rounded-lg sm:h-7" />;
  const state = bookState(progress.done, slug, total);
  const verb = t(bookVerb[state]);
  return (
    <Button
      size="sm"
      aria-label={`${verb}: ${title}`}
      render={<Link href={state === 'started' ? continueHref(href, lastIn(slug, progress.lastVisited)) : href} />}
    >
      {verb}
    </Button>
  );
}

/** "Đã học 1/4.746 bài · 1 sổ tay đang học · 14 chưa bắt đầu" under the page description. */
export function ProgressSummary({ books }: { books: readonly Pick<ShelfBook, 'slug' | 'lessonCount'>[] }) {
  const t = useT();
  const progress = useProgress();
  if (progress.loaded === false) return <Skeleton className="my-0.5 h-4 w-72 max-w-full" />;
  const total = books.reduce((n, b) => n + b.lessonCount, 0);
  const done = books.reduce((n, b) => n + Math.min(doneIn(progress.done, b.slug), b.lessonCount), 0);
  const count = (s: BookState) => books.filter((b) => bookState(progress.done, b.slug, b.lessonCount) === s).length;
  // The first part names the books ("1 sổ tay đang học"), the others only the state ("14 chưa bắt đầu")
  const parts = (
    [
      [count('started'), msg('{n} sổ tay đang học'), msg('{n} đang học')],
      [count('finished'), msg('{n} sổ tay đã xong'), msg('{n} đã xong')],
      [count('new'), msg('{n} sổ tay chưa bắt đầu'), msg('{n} chưa bắt đầu')],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, first, rest], i) => t(i === 0 ? first : rest, { n }));
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      <span className="font-medium text-foreground">
        {t('Đã học {done}/{total} bài', { done: t.num(done), total: t.num(total) })}
      </span>
      {parts.length > 0 && ` · ${parts[0]}`}
      {/* Below sm the line keeps to one row: the rest is what the cards below say. */}
      {parts.length > 1 && <span className="max-sm:hidden"> · {parts.slice(1).join(' · ')}</span>}
    </p>
  );
}

/**
 * "Đang học": the started, unfinished books as 56px rows in one surface, the book of the last visited page first.
 * Each row is split like the Hôm nay hero: the cover's subject flush on the left (a 5rem column the row's height,
 * no tile inside the row), then title, bar and numbers, then the chevron. Each row opens where Alex stopped.
 * Nothing renders while no book is in progress.
 */
export function StartedShelf({ books }: { books: readonly ShelfBook[] }) {
  const t = useT();
  const progress = useProgress();
  const last = progress.lastVisited;
  // Until the store has answered, a one-row placeholder of the shelf's height, so the groups do not jump down.
  if (progress.loaded === false) {
    return (
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="my-1 h-5 w-32" />
        <Skeleton className="h-[58px] rounded-xl" />
      </div>
    );
  }
  const started = books
    .filter((b) => bookState(progress.done, b.slug, b.lessonCount) === 'started')
    .sort(
      (a, b) =>
        Number(lastIn(b.slug, last) !== null) - Number(lastIn(a.slug, last) !== null) ||
        doneIn(progress.done, b.slug) - doneIn(progress.done, a.slug),
    );
  if (started.length === 0) return null;
  return (
    <section aria-labelledby="dang-hoc" className="flex flex-col gap-3">
      <SectionHeader id="dang-hoc" title={t('Đang học')} meta={t('{n} sổ tay', { n: started.length })} />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {started.map((book) => {
          const here = lastIn(book.slug, last);
          const done = doneIn(progress.done, book.slug);
          const count = t('{done}/{total} bài · {pct}', {
            done,
            total: book.lessonCount,
            pct: percent(done, book.lessonCount),
          });
          // The page title, unless the last page was the book's own index (its title is the book title). Told by the
          // empty pageSlug: the stored title is Vietnamese, book.title is in the page's language.
          const page = here?.title && here.pageSlug ? here.title : null;
          return (
            <li key={book.slug}>
              <Link
                href={continueHref(book.href, here)}
                className={cn(
                  'grid h-14 grid-cols-[5rem_minmax(0,1fr)_1rem] items-center gap-3 pe-3 transition-colors duration-150 hover:bg-accent sm:grid-cols-[5rem_minmax(0,1fr)_auto_1rem]',
                  coverLinkFocus,
                )}
              >
                <BookCover slug={book.slug} title={book.title} variant="thumb" className="self-stretch" />
                {/* ms-1: the words 16px from the picture's edge */}
                <span className="ms-1 flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium">{book.title}</span>
                  {/* Phone: the bar under the title. From sm: the last page here (if any), the bar in its own column. */}
                  <span className="flex items-center gap-2 sm:hidden">
                    <ShelfBar done={done} total={book.lessonCount} fill={book.fill} className="w-16" />
                    <span className="truncate text-xs text-muted-foreground tabular-nums">{count}</span>
                  </span>
                  {page && (
                    <span className="truncate text-xs text-muted-foreground max-sm:hidden">
                      {t('Gần nhất: {page}', { page })}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 max-sm:hidden">
                  <ShelfBar done={done} total={book.lessonCount} fill={book.fill} className="w-32" />
                  <span className="min-w-32 whitespace-nowrap text-end text-xs text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </span>
                <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
