import { books, tracks } from '@/lib/books';
import { loadRoadmap, roadmapText, type RoadmapText } from '@/lib/content/roadmap';
import { trackFill } from '@/lib/track-colors';
import { HandbooksStart } from '@/components/handbooks-start';
import { ContinueReading, type HeroBook, type HeroStart } from '@/components/progress';
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
 * roadmap or colour map ships to them. The roadmap is the file as it is when this shell is prerendered
 * (lib/content/roadmap.ts); without one the page has no roadmap block and the hero suggests the first handbook.
 */
function homeData(t: T) {
  const homeBooks: HeroBook[] = books.map((b) => ({
    slug: b.slug,
    title: t(b.title),
    track: b.track,
    lessonCount: b.lessonCount,
    fill: trackFill[b.track],
    cover: b.cover ?? null,
  }));
  // Only the groups that have a handbook: an empty group is no bar on the Sổ tay tile
  const groups = tracks
    .filter(({ slug }) => books.some((b) => b.track === slug))
    .map(({ slug, title }) => ({ slug, title: t(title), fill: trackFill[slug] }));
  const roadmap = loadRoadmap();
  const text = (x: RoadmapText) => roadmapText(x, t.locale);
  // "Giai đoạn 1, nền · tháng 0–5"
  const business: RoadmapStep[] = (roadmap?.businessPhases ?? []).map((p) => ({
    label: t('{phase} · tháng {from}–{to}', { phase: text(p.name), from: p.months[0], to: p.months[1] }),
    rows: p.items.map(({ text: label, books }) => ({ text: text(label), books })),
  }));
  const it: RoadmapStep[] = (roadmap?.itStages ?? []).map((s) => {
    const months = s.months ? t('tháng {from}–{to}', { from: s.months[0], to: s.months[1] }) : t('Song song');
    return {
      label: t('Lộ trình IT · {months}', { months: months.toLowerCase() }),
      rows: [{ text: text(s.study), books: s.books, meta: months }],
    };
  });
  // The hero's first-run suggestion: the first handbook the roadmap names, said with its phase ("Giai đoạn 1");
  // with no roadmap (or none of its handbooks imported), the first handbook of the registry.
  const known = new Set(books.map((b) => b.slug));
  let start: HeroStart | undefined;
  for (const phase of roadmap?.businessPhases ?? []) {
    const slug = phase.items.flatMap((i) => i.books).find((s) => known.has(s));
    if (slug) {
      start = { slug, lead: t('Gợi ý từ lộ trình'), detail: text(phase.name).split(',')[0] };
      break;
    }
  }
  if (!start && homeBooks.length > 0) start = { slug: homeBooks[0].slug, lead: t('Bắt đầu từ đây'), detail: '' };
  return { homeBooks, groups, business, it, start };
}

/**
 * "Hôm nay" (DECISIONS 4.4, 9.3; DESIGN.md §9a): the resume hero, then from xl a 20rem rail of status tiles (week
 * rhythm, objectives, inbox, handbooks, predictions due) beside the setup checklist, the roadmap's next steps and
 * today's brief; the background status line closes the page. A prerendered static shell: every date and number is
 * computed in the browser. DOM order is the phone order and the tab order (hero, setup, rail, roadmap, brief: the
 * checklist under the hero, §9a); the rail spans the five rows, so its extra height lands in the last `1fr` row and
 * the main column keeps no gaps. Between lg and xl the rail is two columns; below lg one (beside the 224px sidebar
 * at md, a half-width tile cannot hold the week strip). Before the first import the hero's place says how handbooks
 * get in and the Sổ tay tile is left out; without a roadmap file its block is left out.
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
        {homeBooks.length > 0 ? (
          <ContinueReading books={homeBooks} start={start} className="xl:col-start-1" />
        ) : (
          <HandbooksStart t={t} className="xl:col-start-1" />
        )}
        <TodaySetup className="xl:col-start-1" />
        <aside
          aria-label={t('Tuần, inbox và sổ tay')}
          className="grid gap-4 lg:grid-cols-2 xl:col-start-2 xl:row-span-5 xl:row-start-1 xl:grid-cols-1"
        >
          <TodayRhythm />
          <TodayWeek />
          <TodayInbox />
          {homeBooks.length > 0 && <TodayBooks books={homeBooks} groups={groups} />}
          <TodayPredictions className="lg:col-span-2 xl:col-span-1" />
        </aside>
        {business.length + it.length > 0 && (
          <TodayRoadmap books={homeBooks} business={business} it={it} className="xl:col-start-1" />
        )}
        <TodayBrief className="xl:col-start-1" />
      </div>

      <div className="border-t px-4 py-4 sm:px-8">
        <TodayStatus />
      </div>
    </div>
  );
}
