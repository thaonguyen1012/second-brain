import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingCards } from '@/components/brain/api-state';
import { PageHeader } from '@/components/brain/page-header';
import { TimePage } from '@/components/brain/work/time-page';

export const metadata: Metadata = { title: 'Giờ' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Giờ"
        description="Bấm giờ hoặc nhập tay giờ đã làm cho từng dự án; xem giờ tính tiền và không tính tiền trong tuần."
      />
      {/* TimePage reads ?project= (useSearchParams), which needs a Suspense boundary on a static page. */}
      <Suspense fallback={<LoadingCards />}>
        <TimePage />
      </Suspense>
    </div>
  );
}
