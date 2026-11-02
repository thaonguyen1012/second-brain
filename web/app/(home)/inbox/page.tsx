import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { InboxPage } from '@/components/brain/inbox-page';

export const metadata: Metadata = { title: 'Inbox' };

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Inbox"
        description="Chỗ duy nhất được phép bừa. Thu thập một chạm, mỗi tuần đi qua bằng phím: một phím, một quyết định."
      />
      <InboxPage />
    </div>
  );
}
