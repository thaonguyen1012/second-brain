import { books } from '@/lib/books';
import { ContinueReading } from '@/components/progress';
import { ProgressMigrationOffer } from '@/components/progress-migration';
import { PageHeader } from '@/components/brain/page-header';
import { TodayBrief, TodayInbox, TodayPredictions, TodayStatus, TodayWeek } from '@/components/brain/today';

/**
 * "Hôm nay" (DECISIONS 4.4, 9.3): continue learning, the week's objectives, inbox count, predictions due for
 * re-scoring, today's brief and the background status line. The handbook grid and the roadmap are in the sidebar.
 */
export default function HomePage() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader title="Hôm nay" nav="/">
        <ContinueReading books={books.map(({ slug, title, track }) => ({ slug, title, track }))} />
        <ProgressMigrationOffer />
      </PageHeader>

      {/* Two tiles; a third column only while the predictions tile is shown (it renders nothing when none is due). */}
      <section
        className="grid gap-4 px-4 pt-2 sm:px-8 md:grid-cols-2 xl:has-[>:nth-child(3)]:grid-cols-3"
        aria-label="Tuần, inbox và dự đoán"
      >
        <TodayWeek />
        <TodayInbox />
        <TodayPredictions className="md:col-span-2 xl:col-span-1" />
      </section>

      <div className="px-4 pt-10 pb-8 sm:px-8">
        <TodayBrief />
      </div>

      <div className="border-t px-4 py-4 sm:px-8">
        <TodayStatus />
      </div>
    </div>
  );
}
