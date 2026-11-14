'use client';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Inbox } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LazyTooltip } from '@/components/lazy-tooltip';
import { useT } from '@/lib/i18n/client';

// One shared count of entries with status "inbox" for the top bar and "Hôm nay"; refreshed on mount, on tab
// focus and after every capture or triage (refreshInboxCount: GET /api/inbox/count, one COUNT on the server,
// no rows). null = unknown (API absent or not signed in).
let count: number | null = null;
let inflight: Promise<void> | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function refreshInboxCount(): Promise<void> {
  inflight ??= api
    .countInbox({ status: 'inbox' })
    .then(
      (r) => {
        count = r.count;
      },
      () => {
        count = null;
      },
    )
    .finally(() => {
      inflight = null;
      emit();
    });
  return inflight;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    void refreshInboxCount();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refreshInboxCount();
    });
  }
  return () => {
    listeners.delete(cb);
  };
}

const snapshot = () => (count === null ? null : String(count));

/** "12", or null while unknown. */
export function useInboxCount(): string | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/**
 * Top bar button: Inbox with its count (DECISIONS 9.3). Icon-only below sm, so it carries a tooltip (loaded
 * lazily: the shell is on the home page, see components/lazy-tooltip.tsx). Named "Inbox, 5 mục chưa xử lý": the
 * visible "Inbox 5", then what the number counts (WCAG 2.5.3).
 */
export function InboxButton() {
  const t = useT();
  const n = useInboxCount();
  return (
    <LazyTooltip label="Inbox">
      <Button
        variant="outline"
        render={<Link href="/inbox/" aria-label={n ? t('Inbox, {count} mục chưa xử lý', { count: n }) : 'Inbox'} />}
      >
        <Inbox aria-hidden />
        <span className="hidden sm:inline">Inbox</span>
        {/* A real space before the count: the text reads "Inbox 5", not "Inbox5" (the flex button does not draw it) */}
        {n && n !== '0' && (
          <>
            {' '}
            <Badge variant="warning" size="sm">
              {n}
            </Badge>
          </>
        )}
      </Button>
    </LazyTooltip>
  );
}
