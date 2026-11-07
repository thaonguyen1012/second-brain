import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingCards } from '@/components/brain/api-state';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import { MarketPage } from '@/components/brain/growth/market-page';

export const metadata: Metadata = { title: 'Thị trường' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Thị trường"
        nav="/phat-trien/thi-truong/"
        description="Mỗi tháng dán vài tin tuyển dụng, xem kỹ năng nào được đòi và mình còn thiếu gì."
      />
      {/* useSearchParams (?jobAd=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className={`${PAGE_WIDTH} px-4 sm:px-8`}>
            <LoadingCards />
          </div>
        }
      >
        <MarketPage />
      </Suspense>
    </div>
  );
}
