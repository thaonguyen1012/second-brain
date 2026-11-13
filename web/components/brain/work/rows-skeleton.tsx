'use client';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/client';

/** Loading rows at the real geometry (DESIGN.md D27): one bordered list of 56px two-line rows. */
export function RowsSkeleton({ count = 4 }: { count?: number }) {
  const t = useT();
  return (
    <div className="flex flex-col divide-y rounded-xl border bg-card" role="status" aria-busy="true" aria-label={t('Đang tải')}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 px-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2 max-w-72" />
            <Skeleton className="h-3 w-1/3 max-w-44" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}
