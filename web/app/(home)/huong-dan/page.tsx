import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/brain/page-header';
import { Button } from '@/components/ui/button';
import { EmptyStateGuide, type EmptyGuideName } from '@/components/stageshow/lazy';

export const metadata: Metadata = { title: 'Hướng dẫn' };

// Every guide also shows in its page's empty state. Here each one is always open (`hideable={false}`: the hidden
// choice made under an empty state does not apply) with the same anatomy: section title, guide, link to the page.
const guides: { guide: EmptyGuideName; href: string; label: string }[] = [
  { guide: 'inbox', href: '/inbox/', label: 'Mở Inbox' },
  { guide: 'week', href: '/tuan/', label: 'Mở Tuần' },
  { guide: 'opportunity', href: '/co-hoi/', label: 'Mở Cơ hội' },
  { guide: 'work', href: '/cong-viec/gio/', label: 'Mở Giờ' },
  { guide: 'skill', href: '/phat-trien/ky-nang/', label: 'Mở Kỹ năng' },
  { guide: 'library', href: '/thu-vien/', label: 'Mở Thư viện' },
];

/** Animated how-tos for the brain pages (Stageshow guides, components/stageshow). Loaded lazily in the browser. */
export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Hướng dẫn"
        description="Mỗi trang có một đoạn minh họa ngắn; nếu máy bật giảm chuyển động, bạn thấy một khung hình tĩnh."
      />
      <div className="flex flex-col gap-8 px-4 pb-12 sm:px-8">
        {guides.map((g) => (
          <div key={g.guide} className="flex flex-col gap-2">
            <EmptyStateGuide guide={g.guide} variant="page" hideable={false} open />
            <Button variant="link" size="sm" className="self-start px-0" render={<Link href={g.href} />}>
              {g.label}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
