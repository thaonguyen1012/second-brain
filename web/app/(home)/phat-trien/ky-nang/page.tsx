import type { Metadata } from 'next';
import { UnderConstruction } from '@/components/brain/under-construction';

export const metadata: Metadata = { title: 'Kỹ năng' };

export default function Page() {
  return (
    <UnderConstruction
      title="Kỹ năng"
      description="Ma trận kỹ năng có bằng chứng, tự mờ khi 6 tháng không có bằng chứng mới."
    />
  );
}
