'use client';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/client';

/**
 * Loading state of a Thư viện list (DESIGN.md §6 States, D27): skeleton rows at the real two-line row geometry
 * (`min-h-14 px-3`, title over meta) in the same bordered container, instead of card-shaped blocks. `picture`: the
 * rows' flush 56px picture track (the list had pictures last time), so the text does not jump when the rows arrive.
 */
export function RowsSkeleton({ count = 4, picture = false }: { count?: number; picture?: boolean }) {
  const t = useT();
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card" aria-busy="true" aria-label={t('Đang tải')}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={picture ? 'flex h-14 gap-3 pe-3' : 'flex h-14 flex-col justify-center gap-2 px-3'}>
          {picture && <Skeleton className="w-14 shrink-0 rounded-none motion-reduce:animate-none" />}
          <span className={picture ? 'flex min-w-0 flex-1 flex-col justify-center gap-2' : 'contents'}>
            <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-1/3 motion-reduce:animate-none" />
          </span>
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
  const t = useT();
  return (
    <p className="text-sm text-muted-foreground">
      {children}{' '}
      <Button variant="link" size="sm" className="px-0" onClick={onClear}>
        {t('Xóa bộ lọc')}
      </Button>
    </p>
  );
}
