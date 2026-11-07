'use client';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { GuideFrame } from './guides/guide-frame';

/*
 * The only entry point pages use for Stageshow guides. Each guide is loaded with next/dynamic and ssr: false,
 * so the kit (its JS and CSS) is a separate chunk fetched after the page renders: it never lands in the
 * home page's first load (make check's 220 kB budget), and the server never renders a scene that measures
 * the DOM. The placeholder keeps the guide's box so the page does not jump when the chunk arrives. Like the
 * Stage, it switches on its container's width, not the viewport's: below 560 px the compact design at
 * 358 x 470 (never wider; narrower containers scale it down), from 560 px the wide design, 600 x 452 at most.
 * Under a `data-ss-wide` host (the empty panel's side slot) it keeps the wide shape, like the Stage; in a flush
 * frame (`data-guide-flush`) it has no edge or ground, as the stage it stands for.
 */

/** Wide shape under data-ss-wide, frameless under data-guide-flush (class strings written out for Tailwind). */
const hostAware =
  '[[data-ss-wide]_&]:aspect-[600/452] [[data-ss-wide]_&]:max-w-[600px] [[data-guide-flush]_&]:rounded-none [[data-guide-flush]_&]:border-0 [[data-guide-flush]_&]:bg-transparent';

function GuidePlaceholder() {
  return (
    <div aria-hidden className="@container w-full">
      <div
        className={`mx-auto aspect-[358/470] w-full max-w-[358px] rounded-3xl border bg-secondary @min-[560px]:aspect-[600/452] @min-[560px]:max-w-[600px] ${hostAware}`}
      />
    </div>
  );
}

const InboxTriage = dynamic(() => import('./guides/inbox-triage'), {
  ssr: false,
  loading: GuidePlaceholder,
});

// The page guides (all share the 600 x 452 / 358 x 470 design), shown in empty states and on /huong-dan/; the Inbox
// guide only on /huong-dan/ (the Inbox's empty state has none), and the bookmarklet guide in the Inbox's "Thu thập từ
// trình duyệt" box.
const WeekRitual = dynamic(() => import('./guides/week-ritual'), { ssr: false, loading: GuidePlaceholder });
const OpportunityEvidence = dynamic(() => import('./guides/opportunity-evidence'), {
  ssr: false,
  loading: GuidePlaceholder,
});
const WorkTimer = dynamic(() => import('./guides/work-timer'), { ssr: false, loading: GuidePlaceholder });
const SkillFreshness = dynamic(() => import('./guides/skill-freshness'), { ssr: false, loading: GuidePlaceholder });
const LibraryItem = dynamic(() => import('./guides/library-item'), { ssr: false, loading: GuidePlaceholder });
// Its compact design is square (358 x 356, guides/capture-bookmarklet.tsx COMPACT), so its placeholder is too
function SquarePlaceholder() {
  return (
    <div aria-hidden className="@container w-full">
      <div
        className={`mx-auto aspect-[358/356] w-full max-w-[358px] rounded-3xl border bg-secondary @min-[560px]:aspect-[600/452] @min-[560px]:max-w-[600px] ${hostAware}`}
      />
    </div>
  );
}

const CaptureBookmarklet = dynamic(() => import('./guides/capture-bookmarklet'), {
  ssr: false,
  loading: SquarePlaceholder,
});

const emptyGuides = {
  inbox: { Guide: InboxTriage, title: 'thu thập và xử lý bằng phím', replay: false },
  bookmarklet: { Guide: CaptureBookmarklet, title: 'cài và dùng bookmarklet', replay: true },
  week: { Guide: WeekRitual, title: 'lên kế hoạch và nhìn lại tuần', replay: true },
  opportunity: { Guide: OpportunityEvidence, title: 'giả thuyết, bằng chứng và điểm', replay: true },
  work: { Guide: WorkTimer, title: 'bấm giờ và tổng kết tuần', replay: true },
  skill: { Guide: SkillFreshness, title: 'bằng chứng giữ kỹ năng còn mới', replay: true },
  library: { Guide: LibraryItem, title: 'thêm item, xong thì viết ghi chú', replay: true },
} as const;

export type EmptyGuideName = keyof typeof emptyGuides;

/**
 * A how-to guide under a page's empty state, closed until "Xem hướng dẫn" (`open` starts it open); the open or
 * hidden choice is remembered per guide (localStorage) and wins over `open`. /huong-dan/ passes
 * `variant="page" hideable={false} open`: an 18px section title, always open, only "Xem lại". The first-run empty
 * panel passes `variant="flush"`: open by default, no frame of its own, `fallback` (ghost rows) while hidden.
 * Render it only when the list is loaded, without error, and truly empty (no filter), never while loading.
 * The Inbox guide loops; the others play once when scrolled into view and offer "Xem lại".
 */
export function EmptyStateGuide({
  guide,
  open,
  hideable = true,
  variant = 'empty',
  fallback,
  className,
}: {
  guide: EmptyGuideName;
  /** Start open when nothing is stored (default: false, true for the flush variant) */
  open?: boolean;
  /** false: ignore the stored hidden choice and offer no hide toggle (see GuideFrame) */
  hideable?: boolean;
  variant?: 'empty' | 'page' | 'flush';
  /** Flush only: what the slot shows while the guide is hidden */
  fallback?: ReactNode;
  className?: string;
}) {
  const g = emptyGuides[guide];
  return (
    <GuideFrame
      id={guide}
      title={g.title}
      Guide={g.Guide}
      replay={g.replay}
      defaultHidden={!(open ?? variant === 'flush')}
      hideable={hideable}
      variant={variant}
      fallback={fallback}
      className={className}
    />
  );
}
