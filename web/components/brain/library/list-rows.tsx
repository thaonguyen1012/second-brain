import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading state of a Thư viện list (DESIGN.md §6 States, D27): skeleton rows at the real two-line row geometry
 * (`min-h-14 px-3`, title over meta) in the same bordered container, instead of card-shaped blocks.
 */
export function RowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex h-14 flex-col justify-center gap-2 px-3">
          <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
          <Skeleton className="h-3 w-1/3 motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Click anywhere on a list row opens its record, except on the row's own controls (links, buttons, menu items)
 * and except events that bubble through React portals (an open row menu) or end a text selection.
 */
export function onRowClick(e: MouseEvent<HTMLElement>, open: () => void) {
  const target = e.target as HTMLElement;
  if (!e.currentTarget.contains(target)) return;
  if (target.closest('a, button, input, [role="menuitem"]')) return;
  if (window.getSelection()?.toString()) return;
  open();
}

/** "Filtered empty" (DESIGN.md §7, D26): one line with a "Xóa bộ lọc" link, no icon art and no guide. */
export function FilteredEmpty({ children, onClear }: { children: string; onClear: () => void }) {
  return (
    <p className="text-sm text-muted-foreground">
      {children}{' '}
      <Button variant="link" size="sm" className="px-0" onClick={onClear}>
        Xóa bộ lọc
      </Button>
    </p>
  );
}
