import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { RowsSkeleton } from '@/components/brain/work/rows-skeleton';
import { TimePage } from '@/components/brain/work/time-page';

export const metadata: Metadata = { title: 'Giờ' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Giờ"
        area="work"
        description="Bấm giờ hoặc nhập tay giờ đã làm cho từng dự án; xem giờ tính tiền và không tính tiền trong tuần."
      />
      {/* TimePage reads ?project= (useSearchParams), which needs a Suspense boundary on a static page. */}
      <Suspense
        fallback={
          <div className="px-4 sm:px-8">
            <RowsSkeleton />
          </div>
        }
      >
        <TimePage />
      </Suspense>
    </div>
  );
}
