import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingCards } from '@/components/brain/api-state';
import { PageHeader } from '@/components/brain/page-header';
import { MarketPage } from '@/components/brain/growth/market-page';

export const metadata: Metadata = { title: 'Thị trường' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Thị trường"
        area="growth"
        description="Mình so với thị trường theo thời gian: mỗi tháng dán vài tin tuyển dụng của vai trò nhắm tới, xem kỹ năng nào được đòi nhiều lên và kỹ năng nào mình chưa có bằng chứng."
      />
      {/* useSearchParams (?jobAd=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense fallback={<LoadingCards />}>
        <MarketPage />
      </Suspense>
    </div>
  );
}
