import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { LoadingCards } from '@/components/brain/api-state';
import { InboxPage } from '@/components/brain/inbox-page';
import { BookmarkletHelp } from '@/components/capture/bookmarklet-help';

export const metadata: Metadata = { title: 'Inbox' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Inbox"
        description="Chỗ duy nhất được phép bừa. Thu thập một chạm, mỗi tuần đi qua bằng phím: một phím, một quyết định."
      >
        <BookmarkletHelp />
      </PageHeader>
      {/* useSearchParams (?id=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense
        fallback={
          <div className="px-4 sm:px-8">
            <LoadingCards />
          </div>
        }
      >
        <InboxPage />
      </Suspense>
    </div>
  );
}
