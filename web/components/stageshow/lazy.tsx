'use client';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { GuideFrame } from './guides/guide-frame';

/*
 * The only entry point pages use for Stageshow guides. Each guide is loaded with next/dynamic and ssr: false,
 * so the kit (its JS and CSS) is a separate chunk fetched after the page renders: it never lands in the
 * home page's first load (make check's 220 kB budget), and the server never renders a scene that measures
 * the DOM. The placeholder keeps the guide's box (wide 600 x 452, compact 358 x 470 below 560 px) so the
 * page does not jump when the chunk arrives.
 */

function GuidePlaceholder() {
  return (
    <div
      aria-hidden
      className="mx-auto aspect-[358/470] w-full max-w-[600px] rounded-3xl bg-secondary sm:aspect-[600/452]"
    />
  );
}

const InboxTriage = dynamic(() => import('./guides/inbox-triage'), {
  ssr: false,
  loading: GuidePlaceholder,
});

/** Animated how-to for the Inbox: capture a link, the card unfurls, then j/k, l, a and o triage it. */
export function InboxTriageGuide({ className }: { className?: string }) {
  return <InboxTriage className={cn('w-full', className)} />;
}

// The page guides shown in empty states (all share the 600 x 452 / 358 x 470 design, so one placeholder fits).
const WeekRitual = dynamic(() => import('./guides/week-ritual'), { ssr: false, loading: GuidePlaceholder });
const OpportunityEvidence = dynamic(() => import('./guides/opportunity-evidence'), {
  ssr: false,
  loading: GuidePlaceholder,
});
const WorkTimer = dynamic(() => import('./guides/work-timer'), { ssr: false, loading: GuidePlaceholder });
const SkillFreshness = dynamic(() => import('./guides/skill-freshness'), { ssr: false, loading: GuidePlaceholder });
const LibraryItem = dynamic(() => import('./guides/library-item'), { ssr: false, loading: GuidePlaceholder });

const emptyGuides = {
  inbox: { Guide: InboxTriage, title: 'thu thập và xử lý bằng phím', replay: false },
  week: { Guide: WeekRitual, title: 'lên kế hoạch và nhìn lại tuần', replay: true },
  opportunity: { Guide: OpportunityEvidence, title: 'giả thuyết, bằng chứng và điểm', replay: true },
  work: { Guide: WorkTimer, title: 'bấm giờ và tổng kết tuần', replay: true },
  skill: { Guide: SkillFreshness, title: 'bằng chứng giữ kỹ năng còn mới', replay: true },
  library: { Guide: LibraryItem, title: 'thêm item, xong thì viết ghi chú', replay: true },
} as const;

export type EmptyGuideName = keyof typeof emptyGuides;

/**
 * A how-to guide under a page's empty state, with "Ẩn hướng dẫn" remembered per guide (localStorage).
 * Render it only when the list is loaded, without error, and truly empty (no filter), never while loading.
 * The Inbox guide loops; the others play once when scrolled into view and offer "Xem lại".
 */
export function EmptyStateGuide({ guide, className }: { guide: EmptyGuideName; className?: string }) {
  const g = emptyGuides[guide];
  return <GuideFrame id={guide} title={g.title} Guide={g.Guide} replay={g.replay} className={className} />;
}
