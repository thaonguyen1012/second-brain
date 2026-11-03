'use client';
import dynamic from 'next/dynamic';
import { GuideFrame } from './guides/guide-frame';

/*
 * The only entry point pages use for Stageshow guides. Each guide is loaded with next/dynamic and ssr: false,
 * so the kit (its JS and CSS) is a separate chunk fetched after the page renders: it never lands in the
 * home page's first load (make check's 220 kB budget), and the server never renders a scene that measures
 * the DOM. The placeholder keeps the guide's box so the page does not jump when the chunk arrives. Like the
 * Stage, it switches on its container's width, not the viewport's: below 560 px the compact design at
 * 358 x 470 (never wider; narrower containers scale it down), from 560 px the wide design, 600 x 452 at most.
 */

function GuidePlaceholder() {
  return (
    <div aria-hidden className="@container w-full">
      <div className="mx-auto aspect-[358/470] w-full max-w-[358px] rounded-3xl bg-secondary @min-[560px]:aspect-[600/452] @min-[560px]:max-w-[600px]" />
    </div>
  );
}

const InboxTriage = dynamic(() => import('./guides/inbox-triage'), {
  ssr: false,
  loading: GuidePlaceholder,
});

// The page guides shown in empty states (all, the Inbox too, share the 600 x 452 / 358 x 470 design).
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
