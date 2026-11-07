import { books, tracks } from '@/lib/books';
import { markOf } from '@/lib/book-marks';
import { businessPhases, itStages } from '@/lib/roadmap';
import { trackFill, trackInk, trackSoft } from '@/lib/track-colors';
import { ContinueReading, type HeroBook } from '@/components/progress';
import { ProgressMigrationOffer } from '@/components/progress-migration';
import { PageHeader } from '@/components/brain/page-header';
import {
  TodayBooks,
  TodayBrief,
  TodayInbox,
  TodayPredictions,
  TodayRhythm,
  TodayRoadmap,
  TodaySetup,
  TodayStatus,
  TodayWeek,
} from '@/components/brain/today';
import type { RoadmapStep } from '@/components/brain/today-learning';

// Resolved here on the server, so the client blocks get plain strings and no registry or colour map ships to them.
const homeBooks: HeroBook[] = books.map((b) => ({
  slug: b.slug,
  title: b.title,
  track: b.track,
  lessonCount: b.lessonCount,
  mark: markOf(b),
  soft: trackSoft[b.track],
  ink: trackInk[b.track],
  fill: trackFill[b.track],
}));
const groups = tracks.map(({ slug, title }) => ({ slug, title, fill: trackFill[slug] }));

/** "Giai đoạn 1, nền (tháng 0 đến 5)" -> "Giai đoạn 1, nền · tháng 0–5". */
const phaseLabel = (title: string) => title.replace(/ \(tháng (\d+) đến (\d+)\)$/, ' · tháng $1–$2');
const business: RoadmapStep[] = businessPhases.map((p) => ({
  label: phaseLabel(p.title),
  rows: p.items.map(({ text, books }) => ({ text, books })),
}));
const it: RoadmapStep[] = itStages.map((s) => {
  const months = s.months.replace(/^(\d+) đến (\d+)$/, 'tháng $1–$2');
  return { label: `Lộ trình IT · ${months.toLowerCase()}`, rows: [{ text: s.study, books: s.books, meta: months }] };
});
// The hero's first-run suggestion: the first book of roadmap phase 1, named by that phase ("Giai đoạn 1").
const start = { slug: businessPhases[0].items[0].books[0], phase: businessPhases[0].title.split(',')[0] };

/**
 * "Hôm nay" (DECISIONS 4.4, 9.3; DESIGN.md §9a): the resume hero, then from xl a 20rem rail of status tiles (week
 * rhythm, objectives, inbox, handbooks, predictions due) beside the setup checklist, the roadmap's next steps and
 * today's brief; the background status line closes the page. A prerendered static shell: every date and number is
 * computed in the browser. DOM order is the phone order and the tab order (hero, setup, rail, roadmap, brief: the
 * checklist under the hero, §9a); the rail spans the five rows, so its extra height lands in the last `1fr` row and
 * the main column keeps no gaps. Between lg and xl the rail is two columns; below lg one (beside the 224px sidebar
 * at md, a half-width tile cannot hold the week strip).
 */
export default function HomePage() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader title="Hôm nay" nav="/">
        <ProgressMigrationOffer />
      </PageHeader>

      <div className="grid w-full max-w-7xl gap-6 px-4 pb-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_auto_auto_auto_1fr] xl:items-start">
        <ContinueReading books={homeBooks} start={start} className="xl:col-start-1" />
        <TodaySetup className="xl:col-start-1" />
        <aside
          aria-label="Tuần, inbox và sổ tay"
          className="grid gap-4 lg:grid-cols-2 xl:col-start-2 xl:row-span-5 xl:row-start-1 xl:grid-cols-1"
        >
          <TodayRhythm />
          <TodayWeek />
          <TodayInbox />
          <TodayBooks books={homeBooks} groups={groups} />
          <TodayPredictions className="lg:col-span-2 xl:col-span-1" />
        </aside>
        <TodayRoadmap books={homeBooks} business={business} it={it} className="xl:col-start-1" />
        <TodayBrief className="xl:col-start-1" />
      </div>

      <div className="border-t px-4 py-4 sm:px-8">
        <TodayStatus />
      </div>
    </div>
  );
}
