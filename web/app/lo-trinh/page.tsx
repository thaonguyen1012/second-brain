import Link from 'next/link';
import type { Metadata } from 'next';
import { bookUrl, getBook } from '@/lib/books';
import { businessPhases, itStages, itTitle, roadmapIntro, type RoadmapLink } from '@/lib/roadmap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

function BookLinks({ slugs }: { slugs: string[] }) {
  const list = slugs.map(getBook).filter((b) => !!b);
  if (!list.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {list.map((b) => (
        <Badge key={b.slug} variant="secondary" render={<Link href={bookUrl(b)} />}>
          📘 {b.title}
        </Badge>
      ))}
    </span>
  );
}

function CourseLinks({ links }: { links: RoadmapLink[] }) {
  if (!links.length) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
          {l.label} ↗
        </a>
      ))}
    </span>
  );
}

/** Phases and stages are read-only here, so no step is "completed" (defaultValue 0). */
export default function RoadmapPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-4 py-10 sm:px-8 md:py-12">
      <header className="flex flex-col gap-3">
        <Badge variant="secondary" className="self-start">
          Lộ trình
        </Badge>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Thứ tự học gợi ý</h1>
        <p className="max-w-[70ch] leading-relaxed text-muted-foreground">{roadmapIntro}</p>
        <div>
          <Button variant="outline" size="sm" render={<a href="/lo-trinh.pdf" target="_blank" rel="noreferrer" />}>
            Mở bản PDF đầy đủ (chi phí, mô tả từng khóa, thuế và luật) ↗
          </Button>
        </div>
      </header>

      <Timeline defaultValue={0}>
        {businessPhases.map((phase, i) => (
          <TimelineItem key={phase.title} step={i + 1}>
            <TimelineHeader>
              <TimelineSeparator />
              <TimelineDate>Giai đoạn {i + 1}</TimelineDate>
              <TimelineTitle className="font-heading">{phase.title}</TimelineTitle>
              <TimelineIndicator />
            </TimelineHeader>
            <TimelineContent>
              <ul className="mt-3 flex flex-col divide-y rounded-2xl border bg-card px-4 shadow-depth-1">
                {phase.items.map((item) => (
                  <li key={item.text} className="flex flex-col gap-2 py-3">
                    <span className="font-medium">{item.text}</span>
                    <BookLinks slugs={item.books} />
                    <CourseLinks links={item.links} />
                  </li>
                ))}
              </ul>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>

      <section className="flex flex-col gap-6">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{itTitle}</h2>
        <Timeline defaultValue={0}>
          {itStages.map((s, i) => (
            <TimelineItem key={s.months} step={i + 1}>
              <TimelineHeader>
                <TimelineSeparator />
                <TimelineDate className="text-bw-orange">
                  {/^\d/.test(s.months) ? `Tháng ${s.months}` : s.months}
                </TimelineDate>
                <TimelineTitle className="font-heading">{s.study}</TimelineTitle>
                <TimelineIndicator />
              </TimelineHeader>
              <TimelineContent className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">Sản phẩm kết giai đoạn: {s.outcome}</span>
                <BookLinks slugs={s.books} />
                <CourseLinks links={s.links} />
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </section>
    </div>
  );
}
