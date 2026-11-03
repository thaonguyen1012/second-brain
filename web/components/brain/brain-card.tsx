import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/labels';

/** Status colour used on every page (lib/labels.ts). */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <Badge variant={tone}>{children}</Badge>;
}

/** Only local images: thumbnails are stored by Django at ingest, never loaded from other domains. */
function isLocal(src: string | null | undefined): src is string {
  return !!src && src.startsWith('/') && !src.startsWith('//');
}

/**
 * The second-brain card (inbox entries, library items, brief stories): one bordered container per record
 * (DESIGN.md D12, D15), thumbnail beside badges, title and meta, then body and actions. Hierarchy comes from type
 * weight and colour, not from an inner panel. `selected` marks the keyboard cursor with a darker neutral border
 * (blue is for the primary action, DESIGN.md §4); in light the card stays a white surface (a grey fill would melt
 * into the grey page, D29), in dark it also takes the lighter accent step.
 */
export function BrainCard({
  badges,
  title,
  meta,
  thumbnail,
  children,
  actions,
  selected,
  className,
  ...rest
}: {
  badges?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  thumbnail?: string | null;
  children?: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
  className?: string;
} & Omit<React.ComponentProps<'article'>, 'title' | 'ref'>) {
  return (
    <Card
      render={<article />}
      {...rest}
      data-selected={selected || undefined}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 transition-colors duration-150',
        'data-selected:border-foreground/40 dark:data-selected:bg-accent',
        className,
      )}
    >
      <div className="flex gap-3">
        {isLocal(thumbnail) && (
          // eslint-disable-next-line @next/next/no-img-element -- local webp thumbnail, already sized at ingest
          <img src={thumbnail} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg object-cover sm:size-16" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {badges && <div className="flex flex-wrap items-center gap-1.5 pb-0.5">{badges}</div>}
          <h3 className="font-heading text-[15px] font-semibold leading-5 tracking-tight break-words">{title}</h3>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        </div>
      </div>
      {children}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </Card>
  );
}
