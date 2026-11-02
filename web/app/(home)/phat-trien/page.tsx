import Link from 'next/link';
import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { books, booksByTrack, tracks } from '@/lib/books';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { BookCard } from '@/components/book-card';
import { PageHeader } from '@/components/brain/page-header';
import { EXPORT_URL } from '@/lib/api/client';

export const metadata: Metadata = { title: 'Sổ tay' };

/** "Phát triển › Sổ tay": every handbook by track (was the phase 1 home page). */
export default function HandbooksPage() {
  const lessons = books.reduce((n, b) => n + b.lessonCount, 0);
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Sổ tay"
        description={
          <>
            {books.length} sổ tay từ các khóa Coursera và F8, {lessons.toLocaleString('vi-VN')} bài học, chia theo ba
            nhóm. Tìm nhanh với <Kbd>/</Kbd> hoặc <span className="whitespace-nowrap"><Kbd>⌘ K</Kbd>.</span>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href="/lo-trinh/" />}>Xem lộ trình học</Button>
          {tracks.map((t) => (
            <Button key={t.slug} variant="outline" render={<a href={`#track-${t.slug}`} />}>
              {t.title}
            </Button>
          ))}
          {/* DECISIONS 4.7: the data is Alex's, downloadable at any time (GET /api/export). */}
          <Button
            variant="ghost"
            className="sm:ms-auto"
            title="Ghi chú dạng markdown và mọi dữ liệu khác dạng JSON, trong một tệp zip"
            render={<a href={EXPORT_URL} download />}
          >
            <Download aria-hidden />
            Tải bản sao dữ liệu
          </Button>
        </div>
      </PageHeader>

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

      <footer className="border-t px-4 py-6 text-sm text-muted-foreground sm:px-8">
        Alex&apos;s Brain là gì và được xây thế nào?{' '}
        <Link href="/gioi-thieu/" className="font-medium text-primary underline-offset-4 hover:underline">
          Giới thiệu và case study →
        </Link>
      </footer>
    </div>
  );
}
