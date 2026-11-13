import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import { RowsSkeleton } from '@/components/brain/library/list-rows';
import { ToolsPage } from '@/components/brain/tools/tools-page';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Công cụ', null, 'nav') };
}

export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Công cụ', null, 'nav')}
        nav="/phat-trien/cong-cu/"
        description={t('Công cụ engineer giỏi dùng ở từng công đoạn, và công cụ để học bằng cách mổ xẻ code thật.')}
      />
      {/* useSearchParams (?item=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className={`${PAGE_WIDTH} px-4 sm:px-8`}>
            <RowsSkeleton picture />
          </div>
        }
      >
        <ToolsPage />
      </Suspense>
    </div>
  );
}
