import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/brain/page-header';
import { Button } from '@/components/ui/button';
import { EmptyStateGuide, type EmptyGuideName } from '@/components/stageshow/lazy';
import { getT } from '@/lib/i18n/server';
import { msg, type Msg } from '@/lib/i18n/translate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Hướng dẫn') };
}

// Every guide but the Inbox one also shows in its page's empty state. Here each one is always open (`hideable={false}`: the hidden
// choice made under an empty state does not apply) with the same anatomy: section title, guide, link to the page.
// The Inbox guide's legend shows J/K, L, A and O only; ⌘↵ and Esc are written out under it (a still poster under
// reduced motion shows no keys at all).
const guides: { guide: EmptyGuideName; href: string; label: Msg; text?: Msg }[] = [
  {
    guide: 'inbox',
    href: '/inbox/',
    label: msg('Mở Inbox'),
    text: msg(
      'Dán link vào ô Thu thập nhanh, nhấn ⌘↵. Thẻ hiện ngay, ảnh thu nhỏ và tag được thêm sau trong nền. Esc để rời ô nhập, rồi mỗi phím là một quyết định: J/K đi xuống/lên, L đọc sau, A lưu trữ, O gắn làm bằng chứng cho một cơ hội.',
    ),
  },
  {
    guide: 'bookmarklet',
    href: '/inbox/',
    label: msg('Mở Inbox'),
    text: msg(
      'Cài một lần: tìm ô "Thu thập từ trình duyệt" trên trang Inbox (bên phải danh sách trên màn hình rộng, bên dưới trên điện thoại), nhấn ⌘⇧B để hiện thanh dấu trang rồi kéo nút Lưu vào Brain lên đó. Sau đó ở trang bất kỳ, bấm Lưu vào Brain trên thanh dấu trang (bôi đen một đoạn trước nếu muốn lưu kèm), rồi nhấn Enter trong cửa sổ nhỏ. Bookmarklet trỏ về đúng địa chỉ bạn kéo nó từ đó.',
    ),
  },
  { guide: 'week', href: '/tuan/', label: msg('Mở Tuần') },
  { guide: 'opportunity', href: '/co-hoi/', label: msg('Mở Cơ hội') },
  { guide: 'work', href: '/cong-viec/gio/', label: msg('Mở Giờ') },
  { guide: 'skill', href: '/phat-trien/ky-nang/', label: msg('Mở Kỹ năng') },
  { guide: 'library', href: '/thu-vien/', label: msg('Mở Thư viện') },
];

/** Animated how-tos for the brain pages (Stageshow guides, components/stageshow). Loaded lazily in the browser. */
export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Hướng dẫn')}
        description={t(
          'Mỗi trang có một đoạn minh họa ngắn; nếu máy bật giảm chuyển động, bạn thấy một khung hình tĩnh.',
        )}
      />
      <div className="flex flex-col gap-8 px-4 pb-12 sm:px-8">
        {guides.map((g) => (
          <div key={g.guide} className="flex flex-col gap-2">
            <EmptyStateGuide guide={g.guide} variant="page" hideable={false} open />
            {g.text && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{t(g.text)}</p>}
            <Button variant="link" size="sm" className="self-start px-0" render={<Link href={g.href} />}>
              {t(g.label)}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
