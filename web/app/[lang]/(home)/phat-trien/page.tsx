import Link from 'next/link';
import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { books, booksByTrack, bookUrl, tracks } from '@/lib/books';
import { hasRoadmap } from '@/lib/content/roadmap';
import { trackFill } from '@/lib/track-colors';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BookCard } from '@/components/book-card';
import { GroupMark } from '@/components/group-mark';
import { ProgressSummary, StartedShelf, type ShelfBook } from '@/components/book-actions';
import { HandbooksEmpty } from '@/components/brain/content-empty';
import { PageHeader } from '@/components/brain/page-header';
import { PAGE_WIDTH, SectionHeader } from '@/components/brain/layout';
import { EXPORT_URL } from '@/lib/api/client';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Sổ tay') };
}

/** Content column: capped and left-aligned with the header (D30), the page gutters inside it. */
const column = cn(PAGE_WIDTH, 'px-4 sm:px-8');
const footerLink =
  'rounded-sm font-medium whitespace-nowrap text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

/**
 * "Phát triển › Sổ tay": every handbook by track (was the phase 1 home page). Only the groups that have a handbook
 * show; before the first import the page is the first-run panel with the import guide (DESIGN.md §9a, D26).
 */
export default async function HandbooksPage() {
  const t = await getT();
  const lessons = books.reduce((n, b) => n + b.lessonCount, 0);
  const groups = tracks.filter((track) => booksByTrack(track.slug).length > 0);
  // Plain props for the client parts, class strings resolved here (the colour maps stay on the server).
  const shelf: ShelfBook[] = tracks.flatMap((track) =>
    booksByTrack(track.slug).map((b) => ({
      slug: b.slug,
      title: t(b.title),
      href: bookUrl(b),
      lessonCount: b.lessonCount,
      fill: trackFill[b.track],
      cover: b.cover ?? null,
    })),
  );
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Sổ tay')}
        nav="/phat-trien/"
        description={
          books.length > 0
            ? t('{n} sổ tay với {lessons} bài học, chia theo nhóm.', { n: books.length, lessons: t.num(lessons) })
            : t('Ghi chú khóa học của bạn, đọc theo từng bài và đánh dấu khi học xong.')
        }
      >
        {books.length > 0 && (
          <ProgressSummary books={shelf.map(({ slug, lessonCount }) => ({ slug, lessonCount }))} />
        )}
        {/* The roadmap is a file of the owner (lib/content/roadmap.ts): no file, no button */}
        {hasRoadmap() && (
          <div>
            <Button variant="outline" render={<Link href="/lo-trinh/" />}>
              {t('Xem lộ trình học')}
            </Button>
          </div>
        )}
      </PageHeader>

      {/* Jump links to the groups (from two groups on), kept under the top bar while scrolling (full-bleed, flush
          with the band: -mt-6 takes back the header's margin). The group's mark carries its colour; the text stays neutral.
          opacity-100: the Button dims its icons to 80%, the mark keeps its full colour. -ms-2 on the first link: the
          Button's padding less the -mx-0.5 it gives every icon, so the first mark starts on the column edge, in line
          with the group marks of the section titles below. */}
      {groups.length > 1 && (
        <nav
          aria-label={t('Nhóm sổ tay')}
          data-sticky-groups
          className="sticky top-16 z-10 -mt-6 mb-6 border-b bg-background/95 py-2"
        >
          <div className={cn(column, 'flex flex-wrap items-center gap-x-1')}>
            {groups.map((track, i) => (
              <Button
                key={track.slug}
                variant="ghost"
                size="sm"
                className={cn(i === 0 && '-ms-2')}
                render={<a href={`#track-${track.slug}`} />}
              >
                <GroupMark track={track.slug} className="size-4.5 opacity-100" />
                {t(track.title)}
                <span className="font-normal text-muted-foreground tabular-nums">
                  <span aria-hidden>{booksByTrack(track.slug).length}</span>
                  <span className="sr-only">{t('{n} sổ tay', { n: booksByTrack(track.slug).length })}</span>
                </span>
              </Button>
            ))}
          </div>
        </nav>
      )}

      <div className={cn(column, 'flex flex-col gap-6 sm:gap-8')}>
        {books.length === 0 && <HandbooksEmpty />}
        {books.length > 0 && <StartedShelf books={shelf} />}
        {groups.map((track) => {
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
                  title={t(track.title)}
                  mark={<GroupMark track={track.slug} className="size-5" />}
                  meta={t('{books} sổ tay · {lessons} bài', { books: group.length, lessons: t.num(groupLessons) })}
                />
                <p className="text-sm text-muted-foreground max-sm:hidden">{t(track.description)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((book) => (
                  <BookCard key={book.slug} book={book} t={t} />
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
          <span className="max-sm:hidden">{t("Alex's Brain là gì và được xây thế nào?")} </span>
          <Link href="/gioi-thieu/" className={footerLink}>
            {t('Giới thiệu và case study')}
          </Link>
          <span aria-hidden> · </span>
          {/* DECISIONS 4.7: the data is Alex's, downloadable at any time (GET /api/export). */}
          <a
            href={EXPORT_URL}
            download
            title={t('Ghi chú dạng markdown và mọi dữ liệu khác dạng JSON, trong một tệp zip')}
            className={footerLink}
          >
            <Download aria-hidden className="me-1 inline size-3.5 align-text-bottom" />
            {t('Tải bản sao dữ liệu')}
          </a>
        </p>
      </footer>
    </div>
  );
}
