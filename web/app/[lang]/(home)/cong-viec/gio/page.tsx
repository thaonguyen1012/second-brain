import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import { RowsSkeleton } from '@/components/brain/work/rows-skeleton';
import { TimePage } from '@/components/brain/work/time-page';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Giờ', null, 'nav') };
}

export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Giờ', null, 'nav')}
        nav="/cong-viec/gio/"
        description={t('Bấm giờ hoặc nhập tay giờ đã làm cho từng dự án.')}
      />
      {/* TimePage reads ?project= (useSearchParams), which needs a Suspense boundary on a static page. */}
      <Suspense
        fallback={
          <div className={`${PAGE_WIDTH} px-4 sm:px-8`}>
            <RowsSkeleton />
          </div>
        }
      >
        <TimePage />
      </Suspense>
    </div>
  );
}
