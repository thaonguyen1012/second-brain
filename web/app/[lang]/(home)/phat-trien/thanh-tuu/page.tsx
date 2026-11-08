import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingCards } from '@/components/brain/api-state';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import { BragPage } from '@/components/brain/growth/brag-page';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Nhật ký thành tựu') };
}

export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Nhật ký thành tựu')}
        nav="/phat-trien/thanh-tuu/"
        description={t('Việc đã làm được mỗi tuần kèm con số tác động, và các dự đoán chấm lại sau 6 tháng.')}
      />
      {/* useSearchParams (?achievement=, ?prediction=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className={`${PAGE_WIDTH} px-4 sm:px-8`}>
            <LoadingCards />
          </div>
        }
      >
        <BragPage />
      </Suspense>
    </div>
  );
}
