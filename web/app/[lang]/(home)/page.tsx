import { books, tracks } from '@/lib/books';
import { businessPhases, itStages } from '@/lib/roadmap';
import { trackFill } from '@/lib/track-colors';
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
import { getT } from '@/lib/i18n/server';
import type { T } from '@/lib/i18n/translate';

/**
 * Resolved here on the server, in the page's language, so the client blocks get plain strings and no registry,
 * roadmap or colour map ships to them.
 */
function homeData(t: T) {
  const homeBooks: HeroBook[] = books.map((b) => ({
    slug: b.slug,
    title: t(b.title),
    track: b.track,
    lessonCount: b.lessonCount,
    fill: trackFill[b.track],
  }));
  const groups = tracks.map(({ slug, title }) => ({ slug, title: t(title), fill: trackFill[slug] }));
  // "Giai đoạn 1, nền · tháng 0–5"
  const business: RoadmapStep[] = businessPhases.map((p) => ({
    label: t('{phase} · tháng {from}–{to}', { phase: t(p.name), from: p.months[0], to: p.months[1] }),
    rows: p.items.map(({ text, books }) => ({ text: t(text), books })),
  }));
  const it: RoadmapStep[] = itStages.map((s) => {
    const months = s.months ? t('tháng {from}–{to}', { from: s.months[0], to: s.months[1] }) : t('Song song');
    return {
      label: t('Lộ trình IT · {months}', { months: months.toLowerCase() }),
      rows: [{ text: t(s.study), books: s.books, meta: months }],
    };
  });
  // The hero's first-run suggestion: the first book of roadmap phase 1, named by that phase ("Giai đoạn 1").
  const start = { slug: businessPhases[0].items[0].books[0], phase: t(businessPhases[0].name).split(',')[0] };
  return { homeBooks, groups, business, it, start };
}

/**
 * "Hôm nay" (DECISIONS 4.4, 9.3; DESIGN.md §9a): the resume hero, then from xl a 20rem rail of status tiles (week
 * rhythm, objectives, inbox, handbooks, predictions due) beside the setup checklist, the roadmap's next steps and
 * today's brief; the background status line closes the page. A prerendered static shell: every date and number is
 * computed in the browser. DOM order is the phone order and the tab order (hero, setup, rail, roadmap, brief: the
 * checklist under the hero, §9a); the rail spans the five rows, so its extra height lands in the last `1fr` row and
 * the main column keeps no gaps. Between lg and xl the rail is two columns; below lg one (beside the 224px sidebar
 * at md, a half-width tile cannot hold the week strip).
 */
export default async function HomePage() {
  const t = await getT();
  const { homeBooks, groups, business, it, start } = homeData(t);
  return (
    <div className="flex w-full flex-col">
      <PageHeader title={t('Hôm nay')} nav="/">
        <ProgressMigrationOffer />
      </PageHeader>

      <div className="grid w-full max-w-7xl gap-6 px-4 pb-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_auto_auto_auto_1fr] xl:items-start">
        <ContinueReading books={homeBooks} start={start} className="xl:col-start-1" />
        <TodaySetup className="xl:col-start-1" />
        <aside
          aria-label={t('Tuần, inbox và sổ tay')}
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
