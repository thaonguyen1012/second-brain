import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoadingCards } from '@/components/brain/api-state';
import { PageHeader } from '@/components/brain/page-header';
import { BragPage } from '@/components/brain/growth/brag-page';

export const metadata: Metadata = { title: 'Nhật ký thành tựu' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Nhật ký thành tựu"
        area="growth"
        description="Những việc đã làm được, cập nhật mỗi tuần, kèm kết quả bằng số cho hồ sơ đi làm. Bên dưới là các dự đoán, 6 tháng sau chấm lại."
      />
      {/* useSearchParams (?achievement=, ?prediction=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense fallback={<LoadingCards />}>
        <BragPage />
      </Suspense>
    </div>
  );
}
