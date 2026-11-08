import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { LoadingCards } from '@/components/brain/api-state';
import { CaptureForm } from '@/components/capture/capture-form';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Thêm vào Inbox') };
}

/** Target of the bookmarklet and of the PWA share target (app/manifest.ts): ?url=&title=&text=. */
export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Thêm vào Inbox')}
        description={t('Xem lại link và ghi chú rồi lưu. Tag và tóm tắt được thêm sau, trong nền.')}
      />
      <div className="px-4 pb-12 sm:px-8">
        {/* useSearchParams needs a Suspense boundary for the static shell */}
        <Suspense fallback={<LoadingCards />}>
          <CaptureForm />
        </Suspense>
      </div>
    </div>
  );
}
