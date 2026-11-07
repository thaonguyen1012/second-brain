import Link from 'next/link';
import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { books, booksByTrack, bookUrl, tracks } from '@/lib/books';
import { trackFill } from '@/lib/track-colors';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BookCard } from '@/components/book-card';
import { ProgressSummary, StartedShelf, type ShelfBook } from '@/components/book-actions';
import { PageHeader } from '@/components/brain/page-header';
import { PAGE_WIDTH, SectionHeader } from '@/components/brain/layout';
import { EXPORT_URL } from '@/lib/api/client';

export const metadata: Metadata = { title: 'Sổ tay' };

/** Content column: capped and left-aligned with the header (D30), the page gutters inside it. */
const column = cn(PAGE_WIDTH, 'px-4 sm:px-8');
const footerLink =
  'rounded-sm font-medium whitespace-nowrap text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

/** "Phát triển › Sổ tay": every handbook by track (was the phase 1 home page). */
export default function HandbooksPage() {
  const lessons = books.reduce((n, b) => n + b.lessonCount, 0);
  // Plain props for the client parts, class strings resolved here (the colour maps stay on the server).
  const shelf: ShelfBook[] = tracks.flatMap((t) =>
    booksByTrack(t.slug).map((b) => ({
      slug: b.slug,
      title: b.title,
      href: bookUrl(b),
      lessonCount: b.lessonCount,
      fill: trackFill[b.track],
    })),
  );
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Sổ tay"
        nav="/phat-trien/"
        description={`${books.length} sổ tay từ các khóa Coursera và F8, ${lessons.toLocaleString('vi-VN')} bài học, chia theo ba nhóm.`}
      >
        <ProgressSummary books={shelf.map(({ slug, lessonCount }) => ({ slug, lessonCount }))} />
        <div>
          <Button variant="outline" render={<Link href="/lo-trinh/" />}>
            Xem lộ trình học
          </Button>
        </div>
      </PageHeader>

      {/* Jump links to the three groups, kept under the top bar while scrolling (full-bleed, flush with the band:
          -mt-6 takes back the header's margin). The dot is the group colour; the text stays neutral. */}
      <nav
        aria-label="Nhóm sổ tay"
        data-sticky-groups
        className="sticky top-16 z-10 -mt-6 mb-6 border-b bg-background/95 py-2"
      >
        <div className={cn(column, 'flex flex-wrap items-center gap-x-1')}>
          {tracks.map((t, i) => (
            <Button
              key={t.slug}
              variant="ghost"
              size="sm"
              className={cn(i === 0 && '-ms-2.5')}
              render={<a href={`#track-${t.slug}`} />}
            >
              <span aria-hidden className={cn('size-2 rounded-full', trackFill[t.slug])} />
              {t.title}
              <span className="font-normal text-muted-foreground tabular-nums">
                {booksByTrack(t.slug).length}
                <span className="sr-only"> sổ tay</span>
              </span>
            </Button>
          ))}
        </div>
      </nav>

      <div className={cn(column, 'flex flex-col gap-6 sm:gap-8')}>
        <StartedShelf books={shelf} />
        {tracks.map((track) => {
          const group = booksByTrack(track.slug);
          const groupLessons = group.reduce((n, b) => n + b.lessonCount, 0);
          return (
            <section
              key={track.slug}
              id={`track-${track.slug}`}
              // A jump link lands below the top bar and the sticky group row (scroll-padding, app/global.css).
              className="flex flex-col gap-3 sm:gap-4"
              aria-labelledby={`track-${track.slug}-title`}
            >
              <div className="flex flex-col gap-1">
                <SectionHeader
                  id={`track-${track.slug}-title`}
                  title={track.title}
                  dot={trackFill[track.slug]}
                  meta={`${group.length} sổ tay · ${groupLessons.toLocaleString('vi-VN')} bài`}
                />
                <p className="text-sm text-muted-foreground max-sm:hidden">{track.description}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((book) => (
                  <BookCard key={book.slug} book={book} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* mt-6 below sm: the same 24px as between the groups; there the links stand alone on one line (P2: the phone
          page stays under 2,200 px), the question joins them from sm. */}
      <footer className="mt-6 border-t py-3 text-sm text-muted-foreground sm:mt-12 sm:py-6">
        <p className={column}>
          <span className="max-sm:hidden">Alex&apos;s Brain là gì và được xây thế nào? </span>
          <Link href="/gioi-thieu/" className={footerLink}>
            Giới thiệu và case study
          </Link>
          <span aria-hidden> · </span>
          {/* DECISIONS 4.7: the data is Alex's, downloadable at any time (GET /api/export). */}
          <a
            href={EXPORT_URL}
            download
            title="Ghi chú dạng markdown và mọi dữ liệu khác dạng JSON, trong một tệp zip"
            className={footerLink}
          >
            <Download aria-hidden className="me-1 inline size-3.5 align-text-bottom" />
            Tải bản sao dữ liệu
          </a>
        </p>
      </footer>
    </div>
  );
}
