import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { LoadingCards } from '@/components/brain/api-state';
import { LibraryPage } from '@/components/brain/library-page';
import { LibraryTabs } from '@/components/brain/library/library-tabs';

export const metadata: Metadata = { title: 'Thư viện' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Thư viện"
        description="Sách, phim, khóa học, bài viết và dự án, lọc theo loại và trạng thái. Ghi chú nằm ở tab bên cạnh."
      >
        <LibraryTabs current="items" />
      </PageHeader>
      {/* useSearchParams (?item=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className="px-4 sm:px-8">
            <LoadingCards />
          </div>
        }
      >
        <LibraryPage />
      </Suspense>
    </div>
  );
}
