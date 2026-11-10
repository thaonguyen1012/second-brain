import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, BookOpen, ExternalLink } from 'lucide-react';
import { bookUrl, getBook } from '@/lib/books';
import { loadRoadmap, roadmapText, type RoadmapLink, type RoadmapText } from '@/lib/content/roadmap';
import { Button } from '@/components/ui/button';
import { RoadmapEmpty } from '@/components/brain/content-empty';
import { PAGE_WIDTH } from '@/components/brain/layout';
import { PageHeader } from '@/components/brain/page-header';
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/spaceui/timeline';
import { contentText } from '@/lib/i18n/content-lang';
import { getT } from '@/lib/i18n/server';
import type { T } from '@/lib/i18n/translate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Lộ trình học') };
}

// Rendered on request: the roadmap is a file on disk beside the handbooks (lib/content/roadmap.ts), never bundled,
// so an edit shows on reload and a missing file is an empty state, not a build error.
export const dynamic = 'force-dynamic';

/**
 * One meta line under a course or stage (DESIGN.md §2 meta): the handbooks it maps to, then its course pages.
 * Muted 12px links with a 14px icon, no badges.
 */
function RowMeta({ slugs, links, t }: { slugs: string[]; links: RoadmapLink[]; t: T }) {
  const list = slugs.map(getBook).filter((b) => !!b);
  if (!list.length && !links.length) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {list.map((b) => (
        <Link
          key={b.slug}
          href={bookUrl(b)}
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <BookOpen className="size-3.5 shrink-0" aria-hidden />
          {t(b.title)}
        </Link>
      ))}
      {links.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          {l.label}
          <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
        </a>
      ))}
    </span>
  );
}

/** A phase's months as its date line ("Tháng 0 đến 5"): the phase number is already in its name. */
const monthsLabel = ([from, to]: [number, number], t: T) => t('Tháng {from} đến {to}', { from, to });

/**
 * Phases and stages are read-only here, so no step is "completed" (defaultValue 0). The Space UI indicator and line
 * are tinted primary by default; here they are neutral, since blue is only for actions, links and focus (D29).
 * The texts are the owner's data: shown in the page's language when the file gives one, else as written, with the
 * Vietnamese parts marked on English pages (contentText).
 */
export default async function RoadmapPage() {
  const t = await getT();
  const roadmap = loadRoadmap();
  const show = (text: RoadmapText) => contentText(roadmapText(text, t.locale), t.locale);
  const key = (text: RoadmapText) => roadmapText(text, 'vi');

  if (!roadmap) {
    return (
      <div className="flex w-full flex-col">
        <PageHeader title={t('Thứ tự học gợi ý')} nav="/lo-trinh/" />
        <div className={`${PAGE_WIDTH} px-4 pb-12 sm:px-8`}>
          <RoadmapEmpty />
        </div>
      </div>
    );
  }

  const intro = roadmapText(roadmap.roadmapIntro, t.locale);
  const note = roadmap.pdf ? roadmapText(roadmap.pdf.note, t.locale) : '';
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Thứ tự học gợi ý')}
        nav="/lo-trinh/"
        description={intro ? contentText(intro, t.locale) : undefined}
      >
        {roadmap.pdf && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button variant="outline" size="sm" render={<a href={roadmap.pdf.href} target="_blank" rel="noreferrer" />}>
              {t('Mở bản PDF đầy đủ')}
              <ExternalLink aria-hidden />
            </Button>
            {note && <span className="text-xs text-muted-foreground">{contentText(note, t.locale)}</span>}
          </div>
        )}
      </PageHeader>

      <div className="flex max-w-4xl flex-col gap-12 px-4 pb-12 sm:px-8">
        {roadmap.businessPhases.length > 0 && (
          <Timeline defaultValue={0}>
            {roadmap.businessPhases.map((phase, i) => {
              return (
                <TimelineItem key={key(phase.name)} step={i + 1}>
                  <TimelineHeader>
                    <TimelineSeparator className="bg-border" />
                    <TimelineDate>{monthsLabel(phase.months, t)}</TimelineDate>
                    <TimelineTitle className="font-heading font-semibold">{show(phase.name)}</TimelineTitle>
                    <TimelineIndicator className="border-border" />
                  </TimelineHeader>
                  <TimelineContent>
                    <ul className="mt-3 flex flex-col divide-y rounded-xl border bg-card px-3">
                      {phase.items.map((item) => (
                        <li key={key(item.text)} className="flex flex-col gap-1 py-3">
                          <span className="text-sm font-medium text-foreground">{show(item.text)}</span>
                          <RowMeta slugs={item.books} links={item.links} t={t} />
                        </li>
                      ))}
                    </ul>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        )}

        {roadmap.itStages.length > 0 && (
          <section className="flex flex-col gap-6">
            {roadmapText(roadmap.itTitle, t.locale) && (
              <h2 className="font-heading text-lg font-semibold tracking-tight">{show(roadmap.itTitle)}</h2>
            )}
            <Timeline defaultValue={0}>
              {roadmap.itStages.map((s, i) => (
                <TimelineItem key={key(s.study)} step={i + 1}>
                  <TimelineHeader>
                    <TimelineSeparator className="bg-border" />
                    <TimelineDate>{s.months ? monthsLabel(s.months, t) : t('Song song')}</TimelineDate>
                    <TimelineTitle className="font-heading font-semibold">{show(s.study)}</TimelineTitle>
                    <TimelineIndicator className="border-border" />
                  </TimelineHeader>
                  <TimelineContent>
                    {/* Same surface and row anatomy as the phases above (DESIGN.md §1.5, D29). */}
                    <div className="mt-3 flex flex-col gap-1 rounded-xl border bg-card px-3 py-3">
                      <span className="text-sm text-muted-foreground">
                        {t.rich('Sản phẩm kết giai đoạn: {outcome}', { outcome: show(s.outcome) })}
                      </span>
                      <RowMeta slugs={s.books} links={s.links} t={t} />
                    </div>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </section>
        )}
      </div>
    </div>
  );
}
