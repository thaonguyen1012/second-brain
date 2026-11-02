import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { BragPage } from '@/components/brain/growth/brag-page';

export const metadata: Metadata = { title: 'Nhật ký thành tựu' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Nhật ký thành tựu"
        description="Những việc đã làm được, cập nhật mỗi tuần, kèm kết quả bằng số cho hồ sơ đi làm. Bên dưới là các dự đoán, 6 tháng sau chấm lại."
      />
      <BragPage />
    </div>
  );
}
