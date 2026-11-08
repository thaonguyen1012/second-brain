import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/brain/page-header';
import { SkillsPage } from '@/components/brain/growth/skills-page';
import { freshness, freshnessOrder } from '@/components/brain/growth/labels';
import { getT } from '@/lib/i18n/server';
import { msg } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Kỹ năng') };
}

/** How long each freshness lasts, short enough for one legend line (the sheet shows the full hint). */
const lasts = {
  fresh: msg('bằng chứng trong 3 tháng'),
  aging: msg('3 đến 6 tháng'),
  faded: msg('quá 6 tháng hoặc chưa có'),
} as const;

export default async function Page() {
  const t = await getT();
  return (
    <div className="flex w-full flex-col">
      <PageHeader
        title={t('Kỹ năng')}
        nav="/phat-trien/ky-nang/"
        description={t('Ma trận kỹ năng có bằng chứng, không tự chấm điểm.')}
      >
        {/* The freshness key: the same dots as the matrix tiles; a skill fades by itself without new evidence */}
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
          aria-label={t('Độ mới của kỹ năng')}
        >
          {freshnessOrder.map((f) => (
            <li key={f} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2 shrink-0 rounded-full', freshness[f].dot)} aria-hidden />
              <span>
                <span className="font-medium text-foreground">{t(freshness[f].label)}</span>
                <span className="max-sm:hidden">: {t(lasts[f])}</span>
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
