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
 * The second-brain card (inbox entries, library items, brief stories), after BookCard: a tinted header panel
 * with badges and the title, then body and actions. `selected` marks the keyboard cursor.
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
      className={cn(
        'flex flex-col gap-2 rounded-3xl border p-2 shadow-depth-1 transition-shadow duration-200 hover:shadow-popover',
        'data-selected:border-primary/70 data-selected:ring-2 data-selected:ring-primary/30',
        className,
      )}
    >
      <div className="flex gap-3 rounded-2xl bg-secondary p-3 sm:p-4">
        {isLocal(thumbnail) && (
          // eslint-disable-next-line @next/next/no-img-element -- local webp thumbnail, already sized at ingest
          <img src={thumbnail} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover sm:size-20" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {badges && <div className="flex flex-wrap items-center gap-1.5">{badges}</div>}
          <h3 className="font-heading text-[15px] font-semibold leading-5 tracking-tight break-words">{title}</h3>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        </div>
      </div>
      {(children || actions) && (
        <div className="flex flex-col gap-3 px-3 pt-1 pb-2">
          {children}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </Card>
  );
}
