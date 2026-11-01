import Link from 'next/link';
import { books, booksByTrack, tracks } from '@/lib/books';
import { BookCard } from '@/components/book-card';
import { ContinueReading } from '@/components/progress';

export default function HomePage() {
  const lessons = books.reduce((n, b) => n + b.lessonCount, 0);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col">
      <section className="flex flex-col gap-4 px-4 py-10 sm:px-12 md:py-12">
        <span className="bw-label self-start">Sổ tay học tập</span>
        <h1 className="text-[32px] font-normal leading-10 tracking-[-0.03em]">Học tiếp từ chỗ đã dừng.</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-fd-muted-foreground">
          {books.length} sổ tay từ các khóa Coursera và F8, {lessons.toLocaleString('vi-VN')} bài học, chia theo
          ba nhóm. Tìm nhanh với <kbd className="bw-kbd">/</kbd> hoặc <kbd className="bw-kbd">⌘ K</kbd>.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/lo-trinh/" className="bw-btn bw-btn-primary">
            Xem lộ trình học
          </Link>
        </div>
        <ContinueReading books={books.map(({ slug, title, track }) => ({ slug, title, track }))} />
      </section>

      {tracks.map((track) => (
        <section
          key={track.slug}
          className="flex flex-col gap-6 border-t px-4 py-10 sm:px-12 md:py-12"
          aria-labelledby={`track-${track.slug}`}
        >
          <div className="flex flex-col gap-1">
            <h2 id={`track-${track.slug}`} className="text-xl font-medium leading-7 tracking-[-0.03em]">
              {track.title}
            </h2>
            <p className="text-sm text-fd-muted-foreground">{track.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {booksByTrack(track.slug).map((book) => (
              <BookCard key={book.slug} book={book} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
