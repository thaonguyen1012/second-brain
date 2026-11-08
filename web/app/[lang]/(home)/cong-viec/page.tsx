import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import { ProjectsPage } from '@/components/brain/work/projects-page';
import { RowsSkeleton } from '@/components/brain/work/rows-skeleton';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Dự án', null, 'nav') };
}

export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Dự án', null, 'nav')}
        nav="/cong-viec/"
        description={t('Dự án freelance: khách, cách tính tiền và giá.')}
      />
      {/* ProjectsPage reads ?view= (useSearchParams), which needs a Suspense boundary on a static page. The
          fallback keeps the toolbar row's place above loading rows, the page's geometry before its data. */}
      <Suspense
        fallback={
          <div className={`${PAGE_WIDTH} flex flex-col gap-6 px-4 pb-12 sm:px-8`}>
            {/* the list view's toolbar: one 34px row from sm; at 390 px the view switch and "Thêm dự án" (38px),
                then the status filter on a row of its own (36px) */}
            <div className="flex flex-col gap-2" aria-hidden>
              <div className="h-9.5 sm:h-8.5" />
              <div className="h-9 sm:hidden" />
            </div>
            <RowsSkeleton />
          </div>
        }
      >
        <ProjectsPage />
      </Suspense>
    </div>
  );
}
