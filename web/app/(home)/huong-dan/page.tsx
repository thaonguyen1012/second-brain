import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/brain/page-header';
import { EmptyStateGuide, type EmptyGuideName } from '@/components/stageshow/lazy';

export const metadata: Metadata = { title: 'Hướng dẫn' };

// Every guide also shows in its page's empty state ("Ẩn hướng dẫn" there hides it here too, and the other way).
// All of them go through EmptyStateGuide (GuideFrame), so the looping Inbox guide can be hidden like the others.
const guides: { guide: EmptyGuideName; href: string; label: string; text?: string }[] = [
  {
    guide: 'inbox',
    href: '/inbox/',
    label: 'Mở Inbox',
    text:
      'Dán link vào ô Thu thập nhanh, nhấn ⌘↵. Thẻ hiện ngay, ảnh thu nhỏ và tag được thêm sau trong nền. Esc để ' +
      'rời ô nhập, rồi mỗi phím là một quyết định: J/K đi xuống/lên, L đọc sau, A lưu trữ, O gắn làm bằng chứng cho một cơ hội.',
  },
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
        description="Mỗi hướng dẫn là một đoạn minh họa ngắn. Hướng dẫn Inbox chạy lặp lại (bấm Ẩn hướng dẫn để dừng); các hướng dẫn khác chạy một lần, bấm Xem lại để xem lần nữa. Nếu máy đang bật giảm chuyển động, bạn sẽ thấy một khung hình tĩnh."
      />
      {guides.map((g) => (
        <section key={g.guide} className="flex flex-col gap-2 px-4 pb-12 sm:px-8">
          <EmptyStateGuide guide={g.guide} className="mx-0" />
          {g.text && <p className="max-w-[600px] text-sm leading-relaxed text-muted-foreground">{g.text}</p>}
          <Link href={g.href} className="text-sm text-primary underline-offset-4 hover:underline">
            {g.label}
          </Link>
        </section>
      ))}
    </div>
  );
}
