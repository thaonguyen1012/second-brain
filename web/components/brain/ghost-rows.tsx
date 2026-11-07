import { cn } from '@/lib/utils';

// Ghost content for a first-run empty panel (DESIGN.md §9a): what the list or chart will look like, in muted fills
// at its real geometry. Static (no shimmer: it is not loading) and hidden from screen readers; only the caption is
// read. Never seeded sample rows with invented text.

const rowOpacity = ['opacity-100', 'opacity-70', 'opacity-40'] as const;

/** Bar lengths of the ghost chart (horizontal, like the frequency chart), fixed so it never looks like data. */
const barWidth = ['w-11/12', 'w-3/4', 'w-3/5', 'w-1/2', 'w-1/3', 'w-1/5'] as const;

/**
 * `rows`: a "Ví dụ" label over three 56px list rows (dot, title and meta bars, two chips), fading out. `chart`:
 * six horizontal bars with label stubs. `caption` says when the real thing appears.
 */
export function GhostRows({
  variant = 'rows',
  caption,
  className,
}: {
  variant?: 'rows' | 'chart';
  caption?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {variant === 'chart' ? (
        <div aria-hidden className="flex flex-col gap-2.5 border-s ps-3 py-1">
          {barWidth.map((w) => (
            <span key={w} className="flex items-center gap-3">
              <span className="h-2 w-16 shrink-0 rounded-sm bg-foreground/10" />
              <span className={cn('h-3 rounded-e-sm bg-foreground/10', w)} />
            </span>
          ))}
        </div>
      ) : (
        <div aria-hidden className="flex flex-col">
          <span className="text-xs text-muted-foreground">Ví dụ</span>
          {rowOpacity.map((o) => (
            <div key={o} className={cn('flex h-14 items-center gap-3 px-3', o)}>
              <span className="size-4 shrink-0 rounded-full bg-foreground/10" />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="h-2.5 w-2/5 rounded-sm bg-foreground/10" />
                <span className="h-2 w-1/4 rounded-sm bg-foreground/10" />
              </span>
              <span className="flex shrink-0 gap-1.5">
                <span className="h-5 w-10 rounded-sm bg-foreground/10" />
                <span className="h-5 w-10 rounded-sm bg-foreground/10" />
              </span>
            </div>
          ))}
        </div>
      )}
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}
