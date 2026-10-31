import Link from 'next/link';
import { books, booksByTrack, tracks } from '@/lib/books';
import { BookCard } from '@/components/book-card';
import { ContinueReading } from '@/components/progress';

export default function HomePage() {
  const lessons = books.reduce((n, b) => n + b.lessonCount, 0);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 md:py-16">
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-fd-primary">Sổ tay học tập</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Học tiếp từ chỗ đã dừng.</h1>
        <p className="max-w-2xl text-base leading-relaxed text-fd-muted-foreground">
          {books.length} sổ tay từ các khóa Coursera và F8, {lessons.toLocaleString('vi-VN')} bài học, chia theo
          ba nhóm. Tìm nhanh với <kbd className="rounded border bg-fd-muted px-1.5 text-xs">/</kbd> hoặc{' '}
          <kbd className="rounded border bg-fd-muted px-1.5 text-xs">⌘K</kbd>.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/lo-trinh/"
            className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition hover:opacity-90"
          >
            Xem lộ trình học
          </Link>
        </div>
      </section>

      <ContinueReading books={books.map(({ slug, title, track }) => ({ slug, title, track }))} />

      {tracks.map((track) => (
        <section key={track.slug} className="flex flex-col gap-5" aria-labelledby={`track-${track.slug}`}>
          <div className="flex flex-col gap-1 border-b pb-3">
            <h2 id={`track-${track.slug}`} className="text-xl font-semibold tracking-tight">
              {track.title}
            </h2>
            <p className="text-sm text-fd-muted-foreground">{track.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {booksByTrack(track.slug).map((book) => (
              <BookCard key={book.slug} book={book} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
