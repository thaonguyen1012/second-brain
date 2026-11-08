import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { LibraryPage } from '@/components/brain/library-page';
import { RowsSkeleton } from '@/components/brain/library/list-rows';
import { LibraryTabs } from '@/components/brain/library/library-tabs';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Thư viện') };
}

export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Thư viện')}
        nav="/thu-vien/"
        description={t('Sách, phim, khóa học, bài viết và dự án.')}
      >
        <LibraryTabs current="items" />
      </PageHeader>
      {/* useSearchParams (?item=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className="w-full max-w-7xl px-4 sm:px-8">
            <RowsSkeleton />
          </div>
        }
      >
        <LibraryPage />
      </Suspense>
    </div>
  );
}
