import { Construction } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { PageHeader } from './page-header';

/** Placeholder for a sidebar page that is not built yet, so every link works. */
export function UnderConstruction({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex w-full flex-col">
      <PageHeader title={title} description={description} />
      <div className="px-4 pb-12 sm:px-8">
        <Empty className="rounded-3xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Construction aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Đang xây</EmptyTitle>
            <EmptyDescription>Trang này sẽ có trong bước tiếp theo của giai đoạn 2.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
}
