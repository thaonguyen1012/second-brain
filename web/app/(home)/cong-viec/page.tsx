import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { ProjectsPage } from '@/components/brain/work/projects-page';

export const metadata: Metadata = { title: 'Dự án' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Dự án"
        nav="/cong-viec/"
        description="Dự án freelance: khách, cách tính tiền và giá."
      />
      <ProjectsPage />
    </div>
  );
}
