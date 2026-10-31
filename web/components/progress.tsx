'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { getProgressStore, pageIdentity, useProgress } from '@/lib/progress';

/** "Đã học xong" checkbox at the bottom of every lesson page. */
export function DoneCheckbox({ url }: { url: string }) {
  const { bookSlug, pageSlug } = pageIdentity(url);
  const done = useProgress().done[bookSlug]?.[pageSlug] === true;
  return (
    <label className="mt-10 flex cursor-pointer items-center gap-3 rounded-xl border bg-fd-card px-4 py-3 text-sm font-medium transition-colors hover:border-fd-primary/50 has-[:checked]:border-fd-primary/60 has-[:checked]:bg-fd-accent">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-fd-primary)]"
        checked={done}
        onChange={(e) => getProgressStore().setDone(bookSlug, pageSlug, e.target.checked)}
      />
      Đã học xong
      {done && <span className="ms-auto text-xs font-normal text-fd-muted-foreground">Đã lưu trên trình duyệt này</span>}
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
      <div
        className="h-1.5 overflow-hidden rounded-full bg-fd-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Tiến độ"
      >
        <div className="h-full rounded-full bg-fd-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-fd-muted-foreground">
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
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-2xl border bg-fd-card p-5 transition hover:-translate-y-0.5 hover:border-fd-primary/50 hover:shadow-md sm:flex-row sm:items-center sm:gap-6"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-fd-primary">Tiếp tục học</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{last.title ?? book.title}</span>
        <span className="truncate text-sm text-fd-muted-foreground">{book.title}</span>
      </span>
      <span className="text-sm font-medium text-fd-primary transition group-hover:translate-x-0.5">Học tiếp →</span>
    </Link>
  );
}
