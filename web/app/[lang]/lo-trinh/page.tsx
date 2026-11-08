import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowUpRight, BookOpen, ExternalLink } from 'lucide-react';
import { bookUrl, getBook } from '@/lib/books';
import { businessPhases, itStages, itTitle, roadmapIntro, type RoadmapLink } from '@/lib/roadmap';
import { Button } from '@/components/ui/button';
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
import { getT } from '@/lib/i18n/server';
import type { T } from '@/lib/i18n/translate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Lộ trình học') };
}

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
 */
export default async function RoadmapPage() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader title={t('Thứ tự học gợi ý')} nav="/lo-trinh/" description={t(roadmapIntro)}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button variant="outline" size="sm" render={<a href="/lo-trinh.pdf" target="_blank" rel="noreferrer" />}>
            {t('Mở bản PDF đầy đủ')}
            <ExternalLink aria-hidden />
          </Button>
          <span className="text-xs text-muted-foreground">{t('Chi phí, mô tả từng khóa, thuế và luật')}</span>
        </div>
      </PageHeader>

      <div className="flex max-w-4xl flex-col gap-12 px-4 pb-12 sm:px-8">
        <Timeline defaultValue={0}>
          {businessPhases.map((phase, i) => {
            return (
              <TimelineItem key={phase.name.msgid} step={i + 1}>
                <TimelineHeader>
                  <TimelineSeparator className="bg-border" />
                  <TimelineDate>{monthsLabel(phase.months, t)}</TimelineDate>
                  <TimelineTitle className="font-heading font-semibold">{t(phase.name)}</TimelineTitle>
                  <TimelineIndicator className="border-border" />
                </TimelineHeader>
                <TimelineContent>
                  <ul className="mt-3 flex flex-col divide-y rounded-xl border bg-card px-3">
                    {phase.items.map((item) => (
                      <li key={item.text.msgid} className="flex flex-col gap-1 py-3">
                        <span className="text-sm font-medium text-foreground">{t(item.text)}</span>
                        <RowMeta slugs={item.books} links={item.links} t={t} />
                      </li>
                    ))}
                  </ul>
                </TimelineContent>
              </TimelineItem>
            );
          })}
        </Timeline>

        <section className="flex flex-col gap-6">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{t(itTitle)}</h2>
          <Timeline defaultValue={0}>
            {itStages.map((s, i) => (
              <TimelineItem key={s.study.msgid} step={i + 1}>
                <TimelineHeader>
                  <TimelineSeparator className="bg-border" />
                  <TimelineDate>{s.months ? monthsLabel(s.months, t) : t('Song song')}</TimelineDate>
                  <TimelineTitle className="font-heading font-semibold">{t(s.study)}</TimelineTitle>
                  <TimelineIndicator className="border-border" />
                </TimelineHeader>
                <TimelineContent>
                  {/* Same surface and row anatomy as the business phases above (DESIGN.md §1.5, D29). */}
                  <div className="mt-3 flex flex-col gap-1 rounded-xl border bg-card px-3 py-3">
                    <span className="text-sm text-muted-foreground">
                      {t('Sản phẩm kết giai đoạn: {outcome}', { outcome: t(s.outcome) })}
                    </span>
                    <RowMeta slugs={s.books} links={s.links} t={t} />
                  </div>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </section>
      </div>
    </div>
  );
}
