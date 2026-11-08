import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingCards } from '@/components/brain/api-state';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import { BragPage } from '@/components/brain/growth/brag-page';

export const metadata: Metadata = { title: 'Nhật ký thành tựu' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Nhật ký thành tựu"
        nav="/phat-trien/thanh-tuu/"
        description="Việc đã làm được mỗi tuần kèm con số tác động, và các dự đoán chấm lại sau 6 tháng."
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
