import type { Metadata } from 'next';
import { UnderConstruction } from '@/components/brain/under-construction';

export const metadata: Metadata = { title: 'Thị trường' };

export default function Page() {
  return (
    <UnderConstruction
      title="Thị trường"
      description="Kỹ năng mà tin tuyển dụng đòi, so với bằng chứng mình đang có."
    />
  );
}
