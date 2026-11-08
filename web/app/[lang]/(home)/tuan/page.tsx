import { Suspense } from 'react';
import type { Metadata } from 'next';
import { books, bookUrl } from '@/lib/books';
import { getT } from '@/lib/i18n/server';
import { LoadingCards } from '@/components/brain/api-state';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import type { BookIndex } from '@/components/brain/tuan/body-of-work';
import { WeekPage } from '@/components/brain/tuan/week-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Tuần') };
}

export default async function Page() {
  const t = await getT();
  // Titles and URLs of the handbooks for the review's "body of work" (only these two fields reach the browser).
  const bookIndex: BookIndex = Object.fromEntries(books.map((b) => [b.slug, { title: t(b.title), href: bookUrl(b) }]));
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Tuần')}
        nav="/tuan/"
        description={t('Đầu tuần chọn 3–5 mục tiêu, cuối tuần nhìn lại trong 15 phút.')}
      />
      {/* The week comes from ?w= (useSearchParams): rendered in the browser, never during next build. */}
      <Suspense
        fallback={
          <div className={`${PAGE_WIDTH} px-4 pb-12 sm:px-8`}>
            <LoadingCards count={3} />
          </div>
        }
      >
        <WeekPage books={bookIndex} />
      </Suspense>
    </div>
  );
}
