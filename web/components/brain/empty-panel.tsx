'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AreaKey } from '@/lib/app-nav';
import { EmptyStateGuide, type EmptyGuideName } from '@/components/stageshow/lazy';
import { cn } from '@/lib/utils';
import { GhostRows } from './ghost-rows';

// The first-run empty panel (DESIGN.md §9a, D26): what a list page shows before its first record, unfiltered. Its
// own file on purpose: api-state.tsx is in the Hôm nay bundle, and this one pulls in the Stageshow wrappers, so
// nothing on Hôm nay may import it. Filtered-empty keeps EmptyState with "Xóa bộ lọc"; a cleared list is one line.

/** The tile's area: one of the five hued areas, or `neutral` (Inbox: the muted fill and ink). */
export type EmptyPanelArea = Exclude<AreaKey, 'today'> | 'neutral';

/** Tile tint and glyph ink, written out for Tailwind; the glyph keeps >= 3.4:1 on its tint (§4 palette). */
const tile: Record<EmptyPanelArea, string> = {
  week: 'bg-area-week-soft text-area-week',
  growth: 'bg-area-growth-soft text-area-growth',
  library: 'bg-area-library-soft text-area-library',
  opportunity: 'bg-area-opportunity-soft text-area-opportunity',
  work: 'bg-area-work-soft text-area-work',
  neutral: 'bg-muted text-muted-foreground',
};

/** The @3xl container width (48rem) from which the slot sits beside the message. */
const BESIDE_PX = 768;

/**
 * One surface: on the left the area tile (48px, the missing object's glyph at 24px), the title, one sentence, the one
 * primary `action` and optional `quick` actions (at most 6 outline `sm` Buttons, or one inline form); on the right,
 * from a 48rem container, a well with the page's `guide` (open unless the owner hid it) or `ghost`. While the guide is
 * hidden the slot shows `ghost`, by default three ghost rows. Without `guide` and `ghost` there is no slot.
 */
export function EmptyPanel({
  area,
  glyph: Glyph,
  title,
  text,
  action,
  quick,
  guide,
  ghost,
  className,
}: {
  area: EmptyPanelArea;
  /** The missing object (BookPlus, FlaskConical...), never the page's nav icon (D21) */
  glyph: LucideIcon;
  title: string;
  /** One sentence on what to do */
  text: ReactNode;
  /** The one primary Button of the screen */
  action?: ReactNode;
  /** Secondary: outline sm Buttons (<= 6) or one inline form, built from the owner's own content */
  quick?: ReactNode;
  guide?: EmptyGuideName;
  /** The slot's content without a guide, or while it is hidden (e.g. `<GhostRows variant="chart" caption=... />`) */
  ghost?: ReactNode;
  className?: string;
}) {
  const hasSlot = Boolean(guide || ghost);
  const ghostNode = ghost ?? <GhostRows />;
  const shell = useRef<HTMLDivElement>(null);
  // Beside the message the slot is at most 34rem wide: data-ss-wide keeps the guide's wide design, scaled to fit,
  // instead of the phone-width one (kit/stage.tsx reads it and re-measures when it changes).
  const [beside, setBeside] = useState(false);
  useEffect(() => {
    const el = shell.current;
    if (!el || !hasSlot) return;
    const ro = new ResizeObserver(([entry]) => setBeside(entry.contentRect.width >= BESIDE_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasSlot]);

  return (
    <div ref={shell} className={cn('@container overflow-hidden rounded-xl border bg-card', className)}>
      <div className={cn('grid', hasSlot && '@3xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]')}>
        <div className="flex min-w-0 flex-col items-start gap-3 p-6">
          <span aria-hidden className={cn('flex size-12 items-center justify-center rounded-xl', tile[area])}>
            <Glyph className="size-6 forced-colors:text-inherit" />
          </span>
          <h2 className="font-heading text-lg font-semibold tracking-tight text-balance">{title}</h2>
          <p className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">{text}</p>
          {action}
          {quick && <div className="flex w-full flex-wrap gap-2">{quick}</div>}
        </div>
        {hasSlot && (
          <div
            data-ss-wide={beside || undefined}
            className="flex min-w-0 flex-col justify-center border-t bg-well @3xl:border-t-0 @3xl:border-s"
          >
            {guide ? (
              <EmptyStateGuide guide={guide} variant="flush" fallback={ghostNode} />
            ) : (
              <div className="p-6">{ghostNode}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
