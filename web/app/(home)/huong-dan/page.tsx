import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/brain/page-header';
import { EmptyStateGuide, InboxTriageGuide, type EmptyGuideName } from '@/components/stageshow/lazy';

export const metadata: Metadata = { title: 'Hướng dẫn' };

// The page guides that also show in each page's empty state ("Ẩn hướng dẫn" there hides them here too).
const pageGuides: { guide: EmptyGuideName; href: string; label: string }[] = [
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
        description="Mỗi hướng dẫn là một đoạn minh họa ngắn. Hướng dẫn Inbox chạy lặp lại; các hướng dẫn khác chạy một lần, bấm Xem lại để xem lần nữa. Nếu máy đang bật giảm chuyển động, bạn sẽ thấy một khung hình tĩnh."
      />
      <section className="flex flex-col gap-4 px-4 pb-12 sm:px-8" aria-labelledby="guide-inbox">
        <div className="flex flex-col gap-1">
          <h2 id="guide-inbox" className="font-heading text-lg font-semibold tracking-tight">
            Inbox: thu thập và xử lý bằng phím
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Dán link vào ô Thu thập nhanh, nhấn ⌘↵. Thẻ hiện ngay, ảnh thu nhỏ và tag được thêm sau trong nền. Esc để
            rời ô nhập, rồi mỗi phím là một quyết định: J/K đi xuống/lên, L đọc sau, A lưu trữ, O gắn làm bằng chứng cho một cơ hội.{' '}
            <Link href="/inbox/" className="text-primary underline-offset-4 hover:underline">
              Mở Inbox
            </Link>
          </p>
        </div>
        <InboxTriageGuide className="max-w-[600px]" />
      </section>
      {pageGuides.map((g) => (
        <section key={g.guide} className="flex flex-col gap-2 px-4 pb-12 sm:px-8">
          <EmptyStateGuide guide={g.guide} className="mx-0" />
          <Link href={g.href} className="text-sm text-primary underline-offset-4 hover:underline">
            {g.label}
          </Link>
        </section>
      ))}
    </div>
  );
}
