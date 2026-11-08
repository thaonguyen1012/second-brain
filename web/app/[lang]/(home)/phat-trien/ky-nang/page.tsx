import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { SkillsPage } from '@/components/brain/growth/skills-page';
import { freshness, freshnessOrder } from '@/components/brain/growth/labels';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Kỹ năng' };

/** How long each freshness lasts, short enough for one legend line (the sheet shows the full hint). */
const lasts = { fresh: 'bằng chứng trong 3 tháng', aging: '3 đến 6 tháng', faded: 'quá 6 tháng hoặc chưa có' } as const;

export default function Page() {
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title="Kỹ năng"
        nav="/phat-trien/ky-nang/"
        description="Ma trận kỹ năng có bằng chứng, không tự chấm điểm."
      >
        {/* The freshness key: the same dots as the matrix tiles; a skill fades by itself without new evidence */}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Độ mới của kỹ năng">
          {freshnessOrder.map((f) => (
            <li key={f} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 shrink-0 rounded-full', freshness[f].dot)} aria-hidden />
              <span>
                <span className="font-medium text-foreground">{freshness[f].label}</span>
                <span className="max-sm:hidden">: {lasts[f]}</span>
              </span>
            </li>
          ))}
        </ul>
      </PageHeader>
      {/* useSearchParams (?id=, Cmd+K results) needs a Suspense boundary for the static shell */}
      <Suspense fallback={null}>
        <SkillsPage />
      </Suspense>
    </div>
  );
}
