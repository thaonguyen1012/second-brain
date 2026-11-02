import type { Metadata } from 'next';
import { UnderConstruction } from '@/components/brain/under-construction';

export const metadata: Metadata = { title: 'Nhật ký thành tựu' };

export default function Page() {
  return (
    <UnderConstruction
      title="Nhật ký thành tựu"
      description="Những việc đã làm được, cập nhật mỗi tuần, dùng cho hồ sơ đi làm."
    />
  );
}
