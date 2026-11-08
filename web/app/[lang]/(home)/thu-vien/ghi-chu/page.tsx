import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { RowsSkeleton } from '@/components/brain/library/list-rows';
import { LibraryTabs } from '@/components/brain/library/library-tabs';
import { NotesRoute, UnlessNote } from '@/components/brain/library/notes-route';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Ghi chú', null, 'nav') };
}

export default async function Page() {
  const t = await getT();
  const header = (
    <PageHeader
      title={t('Thư viện')}
      nav="/thu-vien/ghi-chu/"
      description={t('Ghi chú markdown; item xong cần có ghi chú.')}
    >
      <LibraryTabs current="notes" />
    </PageHeader>
  );
  return (
    <div className="flex w-full flex-col">
      {/* The list's header; a note's page (?id=) has none. The static shell shows it (the fallback). */}
      <Suspense fallback={header}>
        <UnlessNote>{header}</UnlessNote>
      </Suspense>
      {/* useSearchParams (?id=, ?item=) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className="w-full max-w-7xl px-4 sm:px-8">
            <RowsSkeleton />
          </div>
        }
      >
        <NotesRoute />
      </Suspense>
    </div>
  );
}
