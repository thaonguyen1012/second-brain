import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { LoadingCards } from '@/components/brain/api-state';
import { InboxPage } from '@/components/brain/inbox-page';
import { PAGE_WIDTH, wellClass } from '@/components/brain/layout';
import { BookmarkletHelp } from '@/components/capture/bookmarklet-help';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Inbox' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader title="Inbox" description="Chỗ duy nhất được phép bừa: thu thập một chạm, mỗi tuần xử lý bằng phím." />
      {/* From xl the list keeps a reading width (48rem) beside a sticky help rail (a well, DESIGN.md §9a); narrower,
          the rail follows the list, so setup help never sits above it (D4) */}
      <div className={cn(PAGE_WIDTH, 'grid gap-8 px-4 pb-12 sm:px-8 xl:grid-cols-[minmax(0,48rem)_18rem] xl:items-start')}>
        {/* useSearchParams (?id=, Cmd+K results) needs a Suspense boundary for the static shell */}
        <Suspense fallback={<LoadingCards />}>
          <InboxPage />
        </Suspense>
        <aside aria-label="Cách thu thập" className={cn(wellClass, 'xl:sticky xl:top-20')}>
          <BookmarkletHelp />
        </aside>
      </div>
    </div>
  );
}
