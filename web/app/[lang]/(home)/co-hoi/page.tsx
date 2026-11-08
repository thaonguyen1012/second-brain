import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RowsSkeleton } from '@/components/brain/opportunities/bits';
import { OpportunitiesView } from '@/components/brain/opportunities/opportunities-view';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Cơ hội', null, 'nav') };
}

export default function Page() {
  return (
    // useSearchParams (?id=) needs a Suspense boundary so the shell still prerenders
    <Suspense
      fallback={
        <div className="w-full max-w-7xl px-4 pt-10 sm:px-8 md:pt-12">
          <RowsSkeleton />
        </div>
      }
    >
      <OpportunitiesView />
    </Suspense>
  );
}
