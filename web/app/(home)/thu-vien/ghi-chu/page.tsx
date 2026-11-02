import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { LoadingCards } from '@/components/brain/api-state';
import { LibraryTabs } from '@/components/brain/library/library-tabs';
import { NotesPage } from '@/components/brain/library/notes-page';

export const metadata: Metadata = { title: 'Ghi chú' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Thư viện"
        description="Ghi chú markdown, liên kết tới sách, phim, khóa học, bài viết và dự án. Không có ghi chú thì item chưa tính là xong."
      >
        <LibraryTabs current="notes" />
      </PageHeader>
      {/* useSearchParams (?item=) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className="px-4 sm:px-8">
            <LoadingCards />
          </div>
        }
      >
        <NotesPage />
      </Suspense>
    </div>
  );
}
