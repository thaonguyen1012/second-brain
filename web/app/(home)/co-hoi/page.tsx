import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingCards } from '@/components/brain/api-state';
import { OpportunitiesView } from '@/components/brain/opportunities/opportunities-view';

export const metadata: Metadata = { title: 'Cơ hội' };

export default function Page() {
  return (
    // useSearchParams (?id=) needs a Suspense boundary so the shell still prerenders
    <Suspense
      fallback={
        <div className="w-full px-4 pt-12 sm:px-8">
          <LoadingCards />
        </div>
      }
    >
      <OpportunitiesView />
    </Suspense>
  );
}
