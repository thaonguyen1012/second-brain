import { Suspense } from 'react';
import type { Metadata } from 'next';
import { books, bookUrl } from '@/lib/books';
import { LoadingCards } from '@/components/brain/api-state';
import { PageHeader } from '@/components/brain/page-header';
import type { BookIndex } from '@/components/brain/tuan/body-of-work';
import { WeekPage } from '@/components/brain/tuan/week-page';

export const metadata: Metadata = { title: 'Tuần' };

// Titles and URLs of the handbooks for the review's "body of work" (only these two fields reach the browser).
const bookIndex: BookIndex = Object.fromEntries(books.map((b) => [b.slug, { title: b.title, href: bookUrl(b) }]));

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Tuần"
        description="Đầu tuần lên kế hoạch: kéo mục tiêu chưa xong sang, chọn 3–5 mục tiêu, viết kỳ vọng. Cuối tuần nhìn lại trong 15 phút: giờ đi đâu, làm được gì, cơ hội nào có thêm bằng chứng."
      />
      {/* The week comes from ?w= (useSearchParams): rendered in the browser, never during next build. */}
      <Suspense
        fallback={
          <div className="px-4 pb-12 sm:px-8">
            <LoadingCards count={3} />
          </div>
        }
      >
        <WeekPage books={bookIndex} />
      </Suspense>
    </div>
  );
}
