import type { Metadata } from 'next';
import { UnderConstruction } from '@/components/brain/under-construction';

export const metadata: Metadata = { title: 'Cơ hội' };

export default function Page() {
  return (
    <UnderConstruction
      title="Cơ hội"
      description="Giả thuyết kinh doanh, bằng chứng ủng hộ hoặc phản bác, điểm tự chấm và hạn quyết định."
    />
  );
}
