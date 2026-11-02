import type { Metadata } from 'next';
import { UnderConstruction } from '@/components/brain/under-construction';

export const metadata: Metadata = { title: 'Tuần' };

export default function Page() {
  return (
    <UnderConstruction
      title="Tuần"
      description="Lên kế hoạch đầu tuần (3–5 mục tiêu) và nhìn lại cuối tuần trong 15 phút."
    />
  );
}
