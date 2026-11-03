import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RowsSkeleton } from '@/components/brain/opportunities/bits';
import { OpportunitiesView } from '@/components/brain/opportunities/opportunities-view';

export const metadata: Metadata = { title: 'Cơ hội' };

export default function Page() {
  return (
    // useSearchParams (?id=) needs a Suspense boundary so the shell still prerenders
    <Suspense
      fallback={
        <div className="w-full px-4 pt-10 sm:px-8 md:pt-12">
          <RowsSkeleton />
        </div>
      }
    >
      <OpportunitiesView />
    </Suspense>
  );
}
