'use client';
import Link from 'next/link';
import { BookPlus, Milestone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMPORT_GUIDE_HREF } from '@/lib/import-guide';
import { useT } from '@/lib/i18n/client';
import { EmptyPanel } from './empty-panel';

// First-run panels (DESIGN.md §9a, D26) of the two pages whose content is files on disk, not records of the API:
// Sổ tay before the first import and Lộ trình before content/roadmap.json exists. Client wrappers, because a server
// page cannot hand EmptyPanel its glyph (a component). Never imported by "Hôm nay": the panel pulls in the guides.

/** Sổ tay with no handbook in the registry: how handbooks get in, and the guide beside it. */
export function HandbooksEmpty({ className }: { className?: string }) {
  const t = useT();
  return (
    <EmptyPanel
      glyph={BookPlus}
      title={t('Chưa có sổ tay nào')}
      text={t.rich(
        'Sổ tay được nhập bằng một lệnh, từ file zip GitBook hoặc một file HTML: <code>node web/scripts/import-gitbook.mjs</code>. Nhập xong, sổ tay hiện ở đây cùng tiến độ học.',
        { code: (c) => <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">{c}</code> },
      )}
      action={<Button render={<Link href={IMPORT_GUIDE_HREF} />}>{t('Xem cách nhập sổ tay')}</Button>}
      className={className}
    />
  );
}

/** Lộ trình with no roadmap file: what the file is and where it goes. */
export function RoadmapEmpty({ className }: { className?: string }) {
  const t = useT();
  return (
    <EmptyPanel
      glyph={Milestone}
      title={t('Chưa có lộ trình')}
      text={t.rich(
        'Lộ trình là dữ liệu của bạn: một file <code>web/content/roadmap.json</code> với các giai đoạn, số tháng và những gì học trong từng giai đoạn. Tạo file theo mẫu trong README rồi tải lại trang.',
        { code: (c) => <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">{c}</code> },
      )}
      action={
        <Button variant="outline" render={<Link href="/phat-trien/" />}>
          {t('Mở Sổ tay')}
        </Button>
      }
      className={className}
    />
  );
}
