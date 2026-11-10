import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/brain/page-header';
import { Button } from '@/components/ui/button';
import { EmptyStateGuide, type EmptyGuideName } from '@/components/stageshow/lazy';
import { getT } from '@/lib/i18n/server';
import { msg, type Msg, type T } from '@/lib/i18n/translate';

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

/** The importer's inputs as the commands to type; shown as they are in both languages. */
const importCommands = [
  'node web/scripts/import-gitbook.mjs export.zip --track ky-nang --slug my-notes --title "My notes"',
  'node web/scripts/import-gitbook.mjs handbook.html --track it --slug my-course --title "My course"',
  'node web/scripts/import-gitbook.mjs ~/notes/course --track kinh-doanh --slug course --title "Course notes"',
];

/**
 * "Nhập sổ tay": how handbooks get into the app (a command, not a page of the app). The block every "no handbook
 * yet" state links to (lib/import-guide.ts), so it keeps its id and stands first.
 */
function ImportGuide({ t }: { t: T }) {
  return (
    <section id="nhap-so-tay" aria-labelledby="nhap-so-tay-title" className="flex scroll-mt-20 flex-col gap-2">
      <h2 id="nhap-so-tay-title" className="font-heading text-lg font-semibold tracking-tight">
        {t('Nhập sổ tay')}
      </h2>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t.rich(
          'Sổ tay vào app bằng một lệnh chạy trong thư mục mã nguồn, không qua giao diện. Lệnh đọc một file zip xuất từ GitBook (có <code>SUMMARY.md</code>), một file HTML đơn hoặc một thư mục markdown (có <code>SUMMARY.md</code> thì đọc như file zip; không có thì mỗi thư mục con là một module, mỗi file là một bài, theo thứ tự tên), gộp các mục thành trang học, ghi vào <code>web/content/docs/</code>, đăng ký sổ tay và cập nhật chỉ mục tìm kiếm. <code>--track</code> là nhóm của sổ tay: <code>kinh-doanh</code>, <code>it</code> hoặc <code>ky-nang</code>.',
          { code: (c) => <code className="rounded bg-muted px-1 py-0.5 text-xs">{c}</code> },
        )}
      </p>
      <pre className="max-w-full overflow-x-auto rounded-xl border bg-card p-3 text-xs leading-relaxed">
        <code>{importCommands.join('\n')}</code>
      </pre>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t.rich(
          'Nhập xong, chạy lại <code>npm run build</code> (hoặc tải lại trang khi đang chạy <code>npm run dev</code>): sổ tay hiện ở trang Sổ tay, tìm được bằng ⌘K, và mỗi trang có ô "Đã học xong" để ghi tiến độ.',
          { code: (c) => <code className="rounded bg-muted px-1 py-0.5 text-xs">{c}</code> },
        )}
      </p>
      <Button variant="link" size="sm" className="self-start px-0" render={<Link href="/phat-trien/" />}>
        {t('Mở Sổ tay')}
      </Button>
    </section>
  );
}

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
        <ImportGuide t={t} />
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
