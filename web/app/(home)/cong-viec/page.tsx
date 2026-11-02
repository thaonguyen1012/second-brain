import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { ProjectsPage } from '@/components/brain/work/projects-page';

export const metadata: Metadata = { title: 'Dự án' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Dự án"
        description="Dự án freelance: khách, cách tính tiền và giá. Giá giờ thực tế chia số tiền cho mọi giờ đã làm, kể cả giờ không tính tiền."
      />
      <ProjectsPage />
    </div>
  );
}
