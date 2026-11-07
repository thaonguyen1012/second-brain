'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useProgress, type LastVisited } from '@/lib/progress';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/brain/layout';
import { bookState, bookVerb, doneIn, percent, type BookState } from './progress';

// The progress-aware parts of the Sổ tay page (DESIGN.md §9a). The server page passes plain props, class strings
// already resolved, so the registry and the colour maps stay out of this chunk.

/** One handbook as the client parts need it; `href` is the book root. */
export interface ShelfBook {
  slug: string;
  title: string;
  href: string;
  lessonCount: number;
  mark: string;
  /** Cover tint, monogram colour and progress fill (trackSoft, trackInk, trackFill). */
  soft: string;
  ink: string;
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
  const progress = useProgress();
  if (progress.loaded === false) return <Skeleton className="h-8 w-20 rounded-lg sm:h-7" />;
  const state = bookState(progress.done, slug, total);
  return (
    <Button
      size="sm"
      aria-label={`${bookVerb[state]}: ${title}`}
      render={<Link href={state === 'started' ? continueHref(href, lastIn(slug, progress.lastVisited)) : href} />}
    >
      {bookVerb[state]}
    </Button>
  );
}

/** "Đã học 1/4.746 bài · 1 sổ tay đang học · 14 chưa bắt đầu" under the page description. */
export function ProgressSummary({ books }: { books: readonly Pick<ShelfBook, 'slug' | 'lessonCount'>[] }) {
  const progress = useProgress();
  if (progress.loaded === false) return <Skeleton className="my-0.5 h-4 w-72 max-w-full" />;
  const total = books.reduce((n, b) => n + b.lessonCount, 0);
  const done = books.reduce((n, b) => n + Math.min(doneIn(progress.done, b.slug), b.lessonCount), 0);
  const count = (s: BookState) => books.filter((b) => bookState(progress.done, b.slug, b.lessonCount) === s).length;
  const parts = (
    [
      [count('started'), 'đang học'],
      [count('finished'), 'đã xong'],
      [count('new'), 'chưa bắt đầu'],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, label], i) => `${n} ${i === 0 ? 'sổ tay ' : ''}${label}`);
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      <span className="font-medium text-foreground">
        Đã học {done.toLocaleString('vi-VN')}/{total.toLocaleString('vi-VN')} bài
      </span>
      {parts.length > 0 && ` · ${parts[0]}`}
      {/* Below sm the line keeps to one row: the rest is what the cards below say. */}
      {parts.length > 1 && <span className="max-sm:hidden"> · {parts.slice(1).join(' · ')}</span>}
    </p>
  );
}

/**
 * "Đang học": the started, unfinished books as 56px rows in one surface (cover, title, bar, chevron), the book of
 * the last visited page first. Each row opens where Alex stopped. Nothing renders while no book is in progress.
 */
export function StartedShelf({ books }: { books: readonly ShelfBook[] }) {
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
      <SectionHeader id="dang-hoc" title="Đang học" meta={`${started.length} sổ tay`} />
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {started.map((book) => {
          const here = lastIn(book.slug, last);
          const done = doneIn(progress.done, book.slug);
          const count = `${done}/${book.lessonCount} bài · ${percent(done, book.lessonCount)}`;
          // The page title, unless the last page was the book's own index (its title is the book title).
          const page = here?.title && here.title !== book.title ? here.title : null;
          return (
            <li key={book.slug}>
              <Link
                href={continueHref(book.href, here)}
                className="grid h-14 grid-cols-[2.5rem_minmax(0,1fr)_1rem] items-center gap-3 px-3 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_1rem]"
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg font-heading text-sm font-semibold',
                    book.soft,
                    book.ink,
                  )}
                >
                  {book.mark}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium">{book.title}</span>
                  {/* Phone: the bar under the title. From sm: the last page here (if any), the bar in its own column. */}
                  <span className="flex items-center gap-2 sm:hidden">
                    <ShelfBar done={done} total={book.lessonCount} fill={book.fill} className="w-16" />
                    <span className="truncate text-xs text-muted-foreground tabular-nums">{count}</span>
                  </span>
                  {page && <span className="truncate text-xs text-muted-foreground max-sm:hidden">Gần nhất: {page}</span>}
                </span>
                <span className="flex items-center gap-3 max-sm:hidden">
                  <ShelfBar done={done} total={book.lessonCount} fill={book.fill} className="w-32" />
                  <span className="w-32 text-end text-xs text-muted-foreground tabular-nums">{count}</span>
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
