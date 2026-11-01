'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { getProgressStore, pageIdentity, useProgress } from '@/lib/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';

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
      {done && <span className="ms-auto text-xs font-normal text-muted-foreground">Đã lưu trên trình duyệt này</span>}
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

/** Progress bar of one book: done pages / lessonCount. */
export function BookProgress({ book, total }: { book: string; total: number }) {
  const done = Object.keys(useProgress().done[book] ?? {}).length;
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <Progress value={pct} aria-label="Tiến độ">
        <ProgressTrack className="h-1.5">
          <ProgressIndicator className="bg-bw-red" />
        </ProgressTrack>
      </Progress>
      <p className="text-[11px] font-medium leading-4 text-muted-foreground">
        {done > 0 ? `${done}/${total} bài · ${pct}%` : `${total} bài · chưa bắt đầu`}
      </p>
    </div>
  );
}

export interface BookLink {
  slug: string;
  title: string;
  track: string;
}

/** "Tiếp tục học" block: the last visited page, hidden until there is one. */
export function ContinueReading({ books }: { books: BookLink[] }) {
  const last = useProgress().lastVisited;
  const book = last && books.find((b) => b.slug === last.bookSlug);
  if (!last || !book) return null;
  const href = `/docs/${book.track}/${book.slug}/${last.pageSlug ? `${last.pageSlug}/` : ''}`;
  return (
    <Card
      render={<Link href={href} />}
      className="group mt-4 flex max-w-4xl flex-col gap-2 rounded-3xl border p-2 shadow-depth-1 transition-shadow hover:shadow-popover sm:flex-row sm:items-center sm:gap-4"
    >
      <span className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-xs font-semibold">
        <span className="size-1.5 rounded-full bg-bw-red" aria-hidden />
        Tiếp tục học
      </span>
      <span className="flex min-w-0 flex-1 flex-col px-3 py-2 sm:px-0">
        <span className="truncate text-sm font-semibold tracking-tight">{last.title ?? book.title}</span>
        <span className="truncate text-xs text-muted-foreground">{book.title}</span>
      </span>
      <Button size="sm" render={<span />} className="m-1 self-start sm:self-auto">
        Học tiếp →
      </Button>
    </Card>
  );
}
