import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { RowsSkeleton } from '@/components/brain/library/list-rows';
import { LibraryTabs } from '@/components/brain/library/library-tabs';
import { NotesPage } from '@/components/brain/library/notes-page';

export const metadata: Metadata = { title: 'Ghi chú' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Thư viện"
        nav="/thu-vien/ghi-chu/"
        description="Ghi chú markdown; item xong cần có ghi chú."
      >
        <LibraryTabs current="notes" />
      </PageHeader>
      {/* useSearchParams (?item=) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className="w-full max-w-7xl px-4 sm:px-8">
            <RowsSkeleton />
          </div>
        }
      >
        <NotesPage />
      </Suspense>
    </div>
  );
}
