'use client';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Inbox } from 'lucide-react';
import { api } from '@/lib/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// One shared count of entries with status "inbox" for the top bar and "Hôm nay"; refreshed on mount, on tab
// focus and after every capture or triage (refreshInboxCount). null = unknown (API absent or not signed in).
const LIMIT = 200;
let count: number | null = null;
let more = false;
let inflight: Promise<void> | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function refreshInboxCount(): Promise<void> {
  inflight ??= api
    .listInbox({ status: 'inbox', limit: LIMIT })
    .then(
      (page) => {
        count = page.results.length;
        more = page.next !== null;
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

const snapshot = () => (count === null ? null : more ? `${LIMIT}+` : String(count));

/** "12", "200+", or null while unknown. */
export function useInboxCount(): string | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

/** Top bar button: Inbox with its count (DECISIONS 9.3). */
export function InboxButton() {
  const n = useInboxCount();
  return (
    <Button variant="outline" render={<Link href="/inbox/" aria-label={n ? `Inbox, ${n} mục chưa xử lý` : 'Inbox'} />}>
      <Inbox aria-hidden />
      <span className="hidden sm:inline">Inbox</span>
      {n && n !== '0' && (
        <Badge variant="warning" size="sm">
          {n}
        </Badge>
      )}
    </Button>
  );
}
