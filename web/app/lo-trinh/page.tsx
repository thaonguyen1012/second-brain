import Link from 'next/link';
import type { Metadata } from 'next';
import { bookUrl, getBook } from '@/lib/books';
import { businessPhases, itStages, itTitle, roadmapIntro, type RoadmapLink } from '@/lib/roadmap';

export const metadata: Metadata = { title: 'Lộ trình học' };

function BookLinks({ slugs }: { slugs: string[] }) {
  const list = slugs.map(getBook).filter((b) => !!b);
  if (!list.length) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {list.map((b) => (
        <Link
          key={b.slug}
          href={bookUrl(b)}
          className="rounded-md bg-fd-accent px-2 py-0.5 text-xs font-medium text-fd-accent-foreground hover:underline"
        >
          📘 {b.title}
        </Link>
      ))}
    </span>
  );
}

function CourseLinks({ links }: { links: RoadmapLink[] }) {
  if (!links.length) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="text-fd-primary hover:underline">
          {l.label} ↗
        </a>
      ))}
    </span>
  );
}

export default function RoadmapPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-6 md:py-16">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-fd-primary">Lộ trình</p>
        <h1 className="text-3xl font-bold tracking-tight">Thứ tự học gợi ý</h1>
        <p className="max-w-[70ch] leading-relaxed text-fd-muted-foreground">{roadmapIntro}</p>
        <p className="text-sm">
          <a href="/lo-trinh.pdf" className="font-medium text-fd-primary hover:underline" target="_blank" rel="noreferrer">
            Mở bản PDF đầy đủ (chi phí, mô tả từng khóa, thuế và luật) →
          </a>
        </p>
      </header>

      <ol className="flex flex-col gap-6">
        {businessPhases.map((phase, i) => (
          <li key={phase.title} className="rounded-2xl border bg-fd-card p-5">
            <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
              <span className="flex size-7 items-center justify-center rounded-full bg-fd-primary text-sm text-fd-primary-foreground">
                {i + 1}
              </span>
              {phase.title}
            </h2>
            <ul className="flex flex-col divide-y">
              {phase.items.map((item) => (
                <li key={item.text} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <span className="font-medium">{item.text}</span>
                  <BookLinks slugs={item.books} />
                  <CourseLinks links={item.links} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{itTitle}</h2>
        <div className="flex flex-col gap-3">
          {itStages.map((s) => (
            <div key={s.months} className="grid gap-2 rounded-2xl border bg-fd-card p-5 sm:grid-cols-[7rem_1fr]">
              <span className="text-sm font-semibold text-fd-primary">{/^\d/.test(s.months) ? `Tháng ${s.months}` : s.months}</span>
              <div className="flex flex-col gap-2">
                <span className="font-medium">{s.study}</span>
                <span className="text-sm text-fd-muted-foreground">Sản phẩm kết giai đoạn: {s.outcome}</span>
                <BookLinks slugs={s.books} />
                <CourseLinks links={s.links} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
