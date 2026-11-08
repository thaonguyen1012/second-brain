import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingCards } from '@/components/brain/api-state';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import { MarketPage } from '@/components/brain/growth/market-page';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Thị trường') };
}

export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Thị trường')}
        nav="/phat-trien/thi-truong/"
        description={t('Mỗi tháng dán vài tin tuyển dụng, xem kỹ năng nào được đòi và mình còn thiếu gì.')}
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
