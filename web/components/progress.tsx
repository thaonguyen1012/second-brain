'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { getProgressStore, pageIdentity, useProgress, type ProgressSnapshot } from '@/lib/progress';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BookCover } from './book-cover';

/** "Đã học xong" checkbox at the bottom of every lesson page. */
export function DoneCheckbox({ url }: { url: string }) {
  const { bookSlug, pageSlug } = pageIdentity(url);
  const done = useProgress().done[bookSlug]?.[pageSlug] === true;
  return (
    <label className="mt-10 flex cursor-pointer items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-sm font-medium shadow-depth-1 transition-colors hover:border-primary/50 has-[:checked]:border-primary/60 has-[:checked]:bg-accent">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={done}
        onChange={(e) => getProgressStore().setDone(bookSlug, pageSlug, e.target.checked)}
      />
      Đã học xong
      {done && (
        <span className="ms-auto text-xs font-normal text-muted-foreground">
          {process.env.NEXT_PUBLIC_PROGRESS_STORE === 'api' ? 'Đã lưu trên server' : 'Đã lưu trên trình duyệt này'}
        </span>
      )}
    </label>
  );
}

/** Records the page as "last visited" (for "Tiếp tục học" on the home page). */
export function VisitTracker({ url, title }: { url: string; title: string }) {
  useEffect(() => {
    const { bookSlug, pageSlug } = pageIdentity(url);
    if (bookSlug) getProgressStore().setLastVisited(bookSlug, pageSlug, title);
  }, [url, title]);
  return null;
}

/** Pages marked done in a book. */
export const doneIn = (done: ProgressSnapshot['done'], book: string) => Object.keys(done[book] ?? {}).length;

/** new: no lesson done (a visit alone does not count); finished: every lesson done; started: in between. */
export type BookState = 'new' | 'started' | 'finished';
export function bookState(done: ProgressSnapshot['done'], book: string, total: number): BookState {
  const n = doneIn(done, book);
  return n === 0 ? 'new' : n >= total ? 'finished' : 'started';
}

/** The one verb of each state, on the Hôm nay hero and on the Sổ tay cards alike. */
export const bookVerb: Record<BookState, string> = { new: 'Học ngay', started: 'Học tiếp', finished: 'Ôn lại' };

/** "12%", or "<1%" while the first lessons of a long book round to 0 (colour still arrives with the first one). */
export function percent(done: number, total: number): string {
  const exact = total ? Math.min(100, (done / total) * 100) : 0;
  return done > 0 && exact < 1 ? '<1%' : `${Math.round(exact)}%`;
}

/**
 * Progress bar of one book: done pages / lessonCount, the indicator in the colour of its Sổ tay group on the gray
 * rail (DESIGN.md §4). The server passes the class in, so the colour map stays out of this client module (home
 * bundle). The bar shows a sliver from the first lesson on.
 */
export function BookProgress({
  book,
  total,
  fill,
  className,
}: {
  book: string;
  total: number;
  /** Indicator colour, `trackFill` of the book's group. */
  fill: string;
  className?: string;
}) {
  const progress = useProgress();
  const done = doneIn(progress.done, book);
  const pct = percent(done, total);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Progress value={total ? Math.min(100, (done / total) * 100) : 0} aria-label="Tiến độ" getAriaValueText={() => pct}>
        <ProgressTrack className="h-1.5">
          <ProgressIndicator className={cn(fill, done > 0 && 'min-w-1.5')} />
        </ProgressTrack>
      </Progress>
      {/* until the store answers, a line of the text's height, never a "chưa bắt đầu" that is not known yet */}
      {progress.loaded === false ? (
        <Skeleton className="h-4 w-28" />
      ) : (
        <p className="text-xs text-muted-foreground tabular-nums">
          {done > 0 ? `${done}/${total} bài · ${pct}` : `${total} bài · chưa bắt đầu`}
        </p>
      )}
    </div>
  );
}

/** A handbook as "Hôm nay" shows it; the class string is resolved on the server (lib/track-colors.ts). */
export interface HeroBook {
  slug: string;
  title: string;
  track: string;
  lessonCount: number;
  /** Progress fill of the book's Sổ tay group (`trackFill`). */
  fill: string;
}

/** The hero's lead before the book title, by the state of the last visited book. */
const heroLead: Record<BookState, string> = {
  new: 'Xem gần nhất',
  started: 'Tiếp tục học',
  finished: 'Đã học xong',
};

export const bookHref = (b: { slug: string; track: string }, page = '') =>
  `/docs/${b.track}/${b.slug}/${page ? `${page}/` : ''}`;

/**
 * Focus ring of a link whose first child is a cover: drawn by the link's own ::after, which paints above the
 * positioned cover (an inset ring or outline on the link itself would sit under it). The link is `relative`.
 */
export const coverLinkFocus =
  'relative outline-none focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset';

/**
 * The focal block of "Hôm nay" (DESIGN.md §1.2, §9a): a split card, the book's cover flush on one side (owner,
 * 07/11/2026: "chia hẳn 1 phần là ảnh của sổ tay, một bên là title", no tile inside the card), the last visited page,
 * the book's progress and the page's one filled button on the other; below a divider, up to two other books with
 * lessons done. From sm the cover is a 14rem column the card's height, clipped by its corners; below sm a 16:7 band
 * on top. With no last visited page it suggests the first book of the roadmap (`start`). Lead and verb follow the
 * book's state as the Sổ tay card does (`bookState`): a visit with no lesson done is "Xem gần nhất" and "Học ngay",
 * never "Tiếp tục học". A skeleton of the same geometry holds the place until the store has loaded, so the
 * suggestion never flashes before the stored pointer arrives.
 */
export function ContinueReading({
  books,
  start,
  className,
}: {
  books: HeroBook[];
  /** First book of roadmap phase 1 and that phase's name. */
  start: { slug: string; phase: string };
  className?: string;
}) {
  const { done, lastVisited: last, loaded } = useProgress();
  const frame = 'grid sm:min-h-42 sm:grid-cols-[14rem_minmax(0,1fr)]';
  const body = 'flex min-w-0 flex-col gap-4 p-4 sm:justify-center sm:p-5 lg:flex-row lg:items-center lg:gap-5';
  if (!loaded) {
    // the hero's own geometry, line for line (lead, a two-line title as lesson titles mostly are in this column,
    // BookProgress, the button), so the tiles below do not jump when the store answers
    return (
      <div aria-hidden className={cn(frame, 'overflow-hidden rounded-xl border bg-card shadow-depth-1', className)}>
        <Skeleton className="aspect-[16/7] rounded-none sm:aspect-auto" />
        <div className={body}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-4 w-48 max-w-full" />
            <div className="flex h-14 flex-col justify-center gap-2">
              <Skeleton className="h-5 w-64 max-w-full" />
              <Skeleton className="h-5 w-40 max-w-full" />
            </div>
            <div className="mt-1 flex max-w-md flex-col gap-1.5">
              <Skeleton className="h-1.5" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <Skeleton className="h-9 rounded-lg sm:h-8 sm:w-28" />
        </div>
      </div>
    );
  }
  const resumed = last && books.find((b) => b.slug === last.bookSlug);
  const book = resumed || books.find((b) => b.slug === start.slug);
  if (!book) return null;
  const state = bookState(done, book.slug, book.lessonCount);
  const lead = resumed ? heroLead[state] : 'Gợi ý từ lộ trình';
  const others = books
    .filter((b) => b !== book && doneIn(done, b.slug) > 0)
    .sort((a, b) => doneIn(done, b.slug) - doneIn(done, a.slug))
    .slice(0, 2);
  const row =
    'outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
  return (
    <section
      aria-label={lead}
      className={cn('overflow-hidden rounded-xl border bg-card shadow-depth-1', className)}
    >
      <Link
        href={resumed && last ? bookHref(book, last.pageSlug) : bookHref(book)}
        className={cn(frame, 'transition-colors duration-150 hover:bg-accent', coverLinkFocus)}
      >
        <BookCover slug={book.slug} title={book.title} variant="side" />
        <span className={body}>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-xs text-muted-foreground">
              {lead} · {resumed ? book.title : start.phase}
            </span>
            <span className="line-clamp-2 font-heading text-lg font-semibold tracking-tight">
              {/* the book's own root page is "Mở đầu sổ tay", so the book name is never said twice */}
              {!resumed ? book.title : last?.title && last.title !== book.title ? last.title : 'Mở đầu sổ tay'}
            </span>
            <BookProgress book={book.slug} total={book.lessonCount} fill={book.fill} className="mt-1 max-w-md" />
          </span>
          <Button render={<span />} className="sm:self-start lg:self-auto">
            {bookVerb[state]}
            <ArrowRight aria-hidden />
          </Button>
        </span>
      </Link>
      {others.length > 0 && (
        <ul className="divide-y border-t" aria-label="Sổ tay khác đang học">
          {others.map((b) => {
            const n = doneIn(done, b.slug);
            const pct = percent(n, b.lessonCount);
            return (
              <li key={b.slug}>
                <Link href={bookHref(b)} className={cn('flex h-10 items-center gap-3 px-4 text-sm sm:px-5', row)}>
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', b.fill)} />
                  <span className="min-w-0 flex-1 truncate">{b.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{pct}</span>
                  <span
                    aria-hidden
                    className="h-1.5 w-16 overflow-hidden rounded-full bg-input forced-colors:outline max-sm:hidden"
                  >
                    <span
                      className={cn('block h-full min-w-1.5 forced-colors:bg-[CanvasText]', b.fill)}
                      style={{ width: `${Math.min(100, (n / (b.lessonCount || 1)) * 100)}%` }}
                    />
                  </span>
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
