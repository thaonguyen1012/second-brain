'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { getProgressStore, pageIdentity, useProgress } from '@/lib/progress';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

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

/**
 * Progress bar of one book: done pages / lessonCount, the indicator in the colour of its Sổ tay group on the gray
 * rail (DESIGN.md §4). The server-rendered card passes the class in, so the colour map stays out of this client
 * module (home bundle). The first lessons of a long book are under 1%: the bar still shows a sliver and the text
 * says "<1%", so colour arrives with the first lesson.
 */
export function BookProgress({
  book,
  total,
  fill,
}: {
  book: string;
  total: number;
  /** Indicator colour, `trackFill` of the book's group. */
  fill: string;
}) {
  const done = Object.keys(useProgress().done[book] ?? {}).length;
  const exact = total ? Math.min(100, (done / total) * 100) : 0;
  const pct = done > 0 && exact < 1 ? '<1%' : `${Math.round(exact)}%`;
  return (
    <div className="flex flex-col gap-1.5">
      <Progress value={exact} aria-label="Tiến độ" getAriaValueText={() => pct}>
        <ProgressTrack className="h-1.5">
          <ProgressIndicator className={cn(fill, done > 0 && 'min-w-1.5')} />
        </ProgressTrack>
      </Progress>
      <p className="text-xs text-muted-foreground tabular-nums">
        {done > 0 ? `${done}/${total} bài · ${pct}` : `${total} bài · chưa bắt đầu`}
      </p>
    </div>
  );
}

export interface BookLink {
  slug: string;
  title: string;
  track: string;
}

/**
 * "Tiếp tục học" block: the last visited page, hidden until there is one. The progress store has no "loaded" flag
 * (the API store starts empty and fills in later), so a first-visit fallback could flash before the stored pointer
 * arrives: nothing is shown instead, and the handbooks stay one click away in the sidebar.
 */
export function ContinueReading({ books }: { books: BookLink[] }) {
  const last = useProgress().lastVisited;
  const book = last && books.find((b) => b.slug === last.bookSlug);
  if (!last || !book) return null;
  const href = `/docs/${book.track}/${book.slug}/${last.pageSlug ? `${last.pageSlug}/` : ''}`;
  // The focal block of "Hôm nay" (DESIGN.md §1.2): a white surface like the tiles below, lifted by shadow-depth-1,
  // the larger title and the page's one filled blue button.
  return (
    <Link
      href={href}
      className="group mt-2 flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-depth-1 transition-colors duration-150 hover:bg-accent sm:flex-row sm:items-center sm:gap-6 sm:p-5"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 shrink-0 rounded-full bg-bw-red" aria-hidden />
          <span className="truncate">Tiếp tục học · {book.title}</span>
        </span>
        <span className="line-clamp-2 font-heading text-lg font-semibold tracking-tight">{last.title ?? book.title}</span>
      </span>
      <Button render={<span />} className="max-sm:w-full sm:shrink-0">
        Học tiếp
        <ArrowRight aria-hidden />
      </Button>
    </Link>
  );
}
