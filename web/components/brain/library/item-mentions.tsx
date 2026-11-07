'use client';
import { useId } from 'react';
import Link from 'next/link';
import { getItemMentions, type ApiItemMentions } from '@/lib/api/library';
import { useApi } from '@/lib/api/use-api';
import { formatDay } from '@/lib/dates';
import { decisionOf, opportunityHref } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState } from '../api-state';
import { StatusBadge } from '../brain-card';
import { freshness } from '../growth/labels';
import { stanceOf } from '../opportunities/labels';

// "Được nhắc tới ở" at the end of the Item page (DECISIONS 9.8 point 2): the opportunities that use the Item as
// evidence, with the stance of each row in words, and the skills that do, with their freshness (the Kỹ năng words and
// dot). Rows in one container per kind (DESIGN.md §3), each a link to its page. Notes that link the Item with [[ ]]
// join this block with the links (9.8 order point 3).

const row = 'flex min-h-14 items-center gap-3 px-3 py-2';
const linkClass =
  'w-fit max-w-full truncate rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <h3 id={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </h3>
      <ul aria-labelledby={id} className="divide-y overflow-hidden rounded-xl border bg-card">
        {children}
      </ul>
    </div>
  );
}

export function ItemMentions({ itemId }: { itemId: number }) {
  const headingId = useId();
  const res = useApi<ApiItemMentions>(`item-mentions:${itemId}`, () => getItemMentions(itemId));
  const data = res.data;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="font-heading text-lg font-semibold tracking-tight">
        Được nhắc tới ở
      </h2>
      {res.error && !data ? (
        <ApiErrorState error={res.error} onRetry={res.reload} />
      ) : !data ? (
        <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label="Đang tải">
          <Skeleton className="h-3.5 w-1/2 motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-1/3 motion-reduce:animate-none" />
        </div>
      ) : data.opportunities.length === 0 && data.skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có cơ hội hay kỹ năng nào dùng item này làm bằng chứng.</p>
      ) : (
        <>
          {data.opportunities.length > 0 && (
            <Group label="Cơ hội">
              {data.opportunities.map((o) => {
                const d = decisionOf(o.decision);
                return (
                  <li key={o.id} className={row}>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link href={opportunityHref(o.id)} className={linkClass}>
                        {o.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.evidence.map((e, i) => (
                          <span key={e.id}>
                            {i > 0 && '; '}
                            <span className="font-medium text-foreground">{stanceOf(e.stance).label}</span>
                            {` · ${formatDay(e.date)}`}
                          </span>
                        ))}
                      </p>
                    </div>
                    <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
                  </li>
                );
              })}
            </Group>
          )}
          {data.skills.length > 0 && (
            <Group label="Kỹ năng">
              {data.skills.map((s) => {
                const f = freshness[s.freshness];
                return (
                  <li key={s.id} className={row}>
                    <span className={cn('size-2 shrink-0 rounded-full', f.dot)} aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link href={`/phat-trien/ky-nang/?id=${s.id}`} className={linkClass}>
                        {s.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.label} · bằng chứng {s.evidence.map((e) => formatDay(e.date)).join(', ')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </Group>
          )}
        </>
      )}
    </section>
  );
}
