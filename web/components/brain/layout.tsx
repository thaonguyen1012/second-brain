import Link from 'next/link';
import { isValidElement, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Shared page geometry of the app pages (DESIGN.md §3, §9a). Server-safe: no hooks, no 'use client', no data.

/** Content width (D30): capped and left-aligned with the title; header bands stay full-bleed. */
export const PAGE_WIDTH = 'w-full max-w-7xl';

/** The well (§9a, D15): a borderless grey container for secondary, passive regions; never a card inside it. */
export const wellClass = 'rounded-xl bg-well p-4';

/** A link at the end of a section header ("Xem tất cả", "Lộ trình"). */
export interface SectionLink {
  label: string;
  href: string;
}

function isSectionLink(action: unknown): action is SectionLink {
  return typeof action === 'object' && action !== null && !isValidElement(action) && 'href' in action;
}

/**
 * An 18px section title (h2) with its meta on the same baseline and an optional action at the end: a `SectionLink`
 * renders as a link Button with an arrow, any other node is placed as it is. `dot` is a fill class (trackFill) for
 * a handbook group's dot before the title; `id` lets a section use the h2 as its label or a jump target.
 */
export function SectionHeader({
  title,
  meta,
  action,
  id,
  dot,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: SectionLink | ReactNode;
  id?: string;
  dot?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <h2 id={id} className="font-heading text-lg font-semibold tracking-tight">
        {dot && <span aria-hidden className={cn('me-2 inline-block size-2 rounded-full align-middle', dot)} />}
        {title}
      </h2>
      {/* Below sm the meta drops under the title, so a long meta never pushes the link onto a line of its own */}
      {meta != null && meta !== false && (
        <span className="text-xs text-muted-foreground tabular-nums max-sm:order-last max-sm:basis-full">{meta}</span>
      )}
      {isSectionLink(action) ? (
        <Button variant="link" size="sm" className="ms-auto -me-2.5" render={<Link href={action.href} />}>
          {action.label}
          <ArrowRight aria-hidden />
        </Button>
      ) : action ? (
        <div className="ms-auto">{action}</div>
      ) : null}
    </div>
  );
}
