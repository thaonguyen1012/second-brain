import type { Metadata } from 'next';
import { UnderConstruction } from '@/components/brain/under-construction';

export const metadata: Metadata = { title: 'Công việc' };

export default function Page() {
  return (
    <UnderConstruction
      title="Công việc"
      description="Dự án freelance: khách, giá, loại tính tiền và giá giờ thực tế."
    />
  );
}
