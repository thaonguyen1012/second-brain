import Link from 'next/link';
import { books } from '@/lib/books';
import { Button } from '@/components/ui/button';
import { ContinueReading } from '@/components/progress';
import { PageHeader } from '@/components/brain/page-header';
import { TodayBrief, TodayInbox, TodayWeek } from '@/components/brain/today';

/** "Hôm nay" (DECISIONS 4.4, 9.3): continue learning, the week's objectives, inbox count, today's brief. */
export default function HomePage() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader title="Hôm nay" description="Học tiếp, giữ 3 ưu tiên của tuần, dọn inbox và đọc bản tin sáng.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/phat-trien/" />}>
            Tất cả sổ tay
          </Button>
          <Button variant="outline" render={<Link href="/lo-trinh/" />}>
            Lộ trình học
          </Button>
        </div>
        <ContinueReading books={books.map(({ slug, title, track }) => ({ slug, title, track }))} />
      </PageHeader>

      <section className="grid gap-3 px-4 pb-8 sm:px-8 md:grid-cols-2" aria-label="Tuần và inbox">
        <TodayWeek />
        <TodayInbox />
      </section>

      <div className="border-t px-4 py-10 sm:px-8">
        <TodayBrief />
      </div>
    </div>
  );
}
