import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { SkillsPage } from '@/components/brain/growth/skills-page';

export const metadata: Metadata = { title: 'Kỹ năng' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Kỹ năng"
        description="Ma trận kỹ năng có bằng chứng. Không tự chấm điểm: kỹ năng sáng lên khi có bằng chứng mới và tự mờ dần khi 6 tháng không có."
      />
      <SkillsPage />
    </div>
  );
}
