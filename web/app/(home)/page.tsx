import Link from 'next/link';
import { books } from '@/lib/books';
import { Button } from '@/components/ui/button';
import { ContinueReading } from '@/components/progress';
import { ProgressMigrationOffer } from '@/components/progress-migration';
import { PageHeader } from '@/components/brain/page-header';
import { TodayBrief, TodayInbox, TodayPredictions, TodayStatus, TodayWeek } from '@/components/brain/today';

/**
 * "Hôm nay" (DECISIONS 4.4, 9.3): continue learning, the week's objectives, inbox count, predictions due for
 * re-scoring, today's brief and the background status line.
 */
export default function HomePage() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader title="Hôm nay" description="Học tiếp, giữ 3 ưu tiên của tuần, dọn inbox và đọc bản tin sáng.">
        <ContinueReading books={books.map(({ slug, title, track }) => ({ slug, title, track }))} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" render={<Link href="/phat-trien/" />}>
            Tất cả sổ tay
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/lo-trinh/" />}>
            Lộ trình học
          </Button>
        </div>
        <ProgressMigrationOffer />
      </PageHeader>

      <section
        className="grid gap-x-10 gap-y-8 px-4 pt-2 pb-10 sm:px-8 md:grid-cols-2 xl:grid-cols-3"
        aria-label="Tuần, inbox và dự đoán"
      >
        <TodayWeek />
        <TodayInbox />
        <TodayPredictions className="md:col-span-2 xl:col-span-1" />
      </section>

      <div className="border-t px-4 py-8 sm:px-8">
        <TodayBrief />
      </div>

      <div className="border-t px-4 py-4 sm:px-8">
        <TodayStatus />
      </div>
    </div>
  );
}
