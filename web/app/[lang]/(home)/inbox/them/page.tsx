import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { LoadingCards } from '@/components/brain/api-state';
import { CaptureForm } from '@/components/capture/capture-form';

export const metadata: Metadata = { title: 'Thêm vào Inbox' };

/** Target of the bookmarklet and of the PWA share target (app/manifest.ts): ?url=&title=&text=. */
export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Thêm vào Inbox"
        description="Xem lại link và ghi chú rồi lưu. Tag và tóm tắt được thêm sau, trong nền."
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
