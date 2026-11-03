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

export const metadata: Metadata = { title: 'Lộ trình học' };

/**
 * One meta line under a course or stage (DESIGN.md §2 meta): the handbooks it maps to, then its course pages.
 * Muted 12px links with a 14px icon, no badges.
 */
function RowMeta({ slugs, links }: { slugs: string[]; links: RoadmapLink[] }) {
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
          {b.title}
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

/**
 * "Giai đoạn 1, nền (tháng 0 đến 5)" -> title "Giai đoạn 1, nền" and date "Tháng 0 đến 5": the number is already
 * in the title, so the date line carries the months instead of repeating it.
 */
function phaseLabel(title: string, index: number): { title: string; date: string | null } {
  const months = /^(.*?)\s*\((tháng [^)]+)\)\s*$/i.exec(title);
  if (months) return { title: months[1], date: months[2].replace(/^t/, 'T') };
  return { title, date: /^giai đoạn \d/i.test(title) ? null : `Giai đoạn ${index + 1}` };
}

/**
 * Phases and stages are read-only here, so no step is "completed" (defaultValue 0). The Space UI indicator and line
 * are tinted primary by default; here they are neutral, since blue is only for actions, links and focus (D29).
 */
export default function RoadmapPage() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader title="Thứ tự học gợi ý" area="growth" description={roadmapIntro}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button variant="outline" size="sm" render={<a href="/lo-trinh.pdf" target="_blank" rel="noreferrer" />}>
            Mở bản PDF đầy đủ
            <ExternalLink aria-hidden />
          </Button>
          <span className="text-xs text-muted-foreground">Chi phí, mô tả từng khóa, thuế và luật</span>
        </div>
      </PageHeader>

      <div className="flex max-w-4xl flex-col gap-12 px-4 pb-12 sm:px-8">
        <Timeline defaultValue={0}>
          {businessPhases.map((phase, i) => {
            const label = phaseLabel(phase.title, i);
            return (
              <TimelineItem key={phase.title} step={i + 1}>
                <TimelineHeader>
                  <TimelineSeparator className="bg-border" />
                  {label.date && <TimelineDate>{label.date}</TimelineDate>}
                  <TimelineTitle className="font-heading font-semibold">{label.title}</TimelineTitle>
                  <TimelineIndicator className="border-border" />
                </TimelineHeader>
                <TimelineContent>
                  <ul className="mt-3 flex flex-col divide-y rounded-xl border bg-card px-3">
                    {phase.items.map((item) => (
                      <li key={item.text} className="flex flex-col gap-1 py-3">
                        <span className="text-sm font-medium text-foreground">{item.text}</span>
                        <RowMeta slugs={item.books} links={item.links} />
                      </li>
                    ))}
                  </ul>
                </TimelineContent>
              </TimelineItem>
            );
          })}
        </Timeline>

        <section className="flex flex-col gap-6">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{itTitle}</h2>
          <Timeline defaultValue={0}>
            {itStages.map((s, i) => (
              <TimelineItem key={s.months} step={i + 1}>
                <TimelineHeader>
                  <TimelineSeparator className="bg-border" />
                  <TimelineDate>{/^\d/.test(s.months) ? `Tháng ${s.months}` : s.months}</TimelineDate>
                  <TimelineTitle className="font-heading font-semibold">{s.study}</TimelineTitle>
                  <TimelineIndicator className="border-border" />
                </TimelineHeader>
                <TimelineContent>
                  {/* Same surface and row anatomy as the business phases above (DESIGN.md §1.5, D29). */}
                  <div className="mt-3 flex flex-col gap-1 rounded-xl border bg-card px-3 py-3">
                    <span className="text-sm text-muted-foreground">Sản phẩm kết giai đoạn: {s.outcome}</span>
                    <RowMeta slugs={s.books} links={s.links} />
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
