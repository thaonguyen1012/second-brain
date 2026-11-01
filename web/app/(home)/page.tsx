import Link from 'next/link';
import { books, booksByTrack, tracks } from '@/lib/books';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { BookCard } from '@/components/book-card';
import { ContinueReading } from '@/components/progress';

export default function HomePage() {
  const lessons = books.reduce((n, b) => n + b.lessonCount, 0);
  return (
    <div className="flex w-full flex-col">
      <section className="flex flex-col gap-4 px-4 py-10 sm:px-8 md:py-12">
        <Badge variant="secondary" className="self-start">
          Sổ tay học tập
        </Badge>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Học tiếp từ chỗ đã dừng.</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {books.length} sổ tay từ các khóa Coursera và F8, {lessons.toLocaleString('vi-VN')} bài học, chia theo
          ba nhóm. Tìm nhanh với <Kbd>/</Kbd> hoặc <Kbd>⌘ K</Kbd>.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button render={<Link href="/lo-trinh/" />}>Xem lộ trình học</Button>
        </div>
        <ContinueReading books={books.map(({ slug, title, track }) => ({ slug, title, track }))} />
      </section>

      {tracks.map((track) => (
        <section
          key={track.slug}
          className="flex scroll-mt-20 flex-col gap-6 border-t px-4 py-10 sm:px-8 md:py-12"
          aria-labelledby={`track-${track.slug}`}
        >
          <div className="flex flex-col gap-1">
            <h2 id={`track-${track.slug}`} className="font-heading text-xl font-semibold tracking-tight">
              {track.title}
            </h2>
            <p className="text-sm text-muted-foreground">{track.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {booksByTrack(track.slug).map((book) => (
              <BookCard key={book.slug} book={book} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
