import type { Metadata } from 'next';
import { UnderConstruction } from '@/components/brain/under-construction';

export const metadata: Metadata = { title: 'Giờ' };

export default function Page() {
  return (
    <UnderConstruction
      title="Giờ"
      description="Nhập giờ hoặc bấm giờ cho từng dự án; giờ không tính tiền trong tuần."
    />
  );
}
