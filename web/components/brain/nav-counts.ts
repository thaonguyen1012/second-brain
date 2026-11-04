import { useSyncExternalStore } from 'react';
import { API_WRITE_EVENT, api, type ApiCounts } from '@/lib/api/client';

// The sidebar's row counts (GET /api/counts: one request, one COUNT per number), shared like inbox-count.tsx.
// Refreshed on every navigation (app-shell.tsx), when the tab comes back and after every API write (lib/api/client.ts
// fires API_WRITE_EVENT); the last two only while a sidebar is mounted. A refresh asked for while one is in flight
// runs again after it, so a write is never answered by numbers read before it. null = unknown (API absent or not
// signed in): no counts show.
let counts: ApiCounts | null = null;
let inflight = false;
let again = false;
let started = false;
const listeners = new Set<() => void>();

export function refreshNavCounts(): void {
  if (inflight) {
    again = true;
    return;
  }
  inflight = true;
  api
    .getCounts()
    .then(
      (c) => {
        counts = c;
      },
      () => {
        counts = null;
      },
    )
    .finally(() => {
      inflight = false;
      for (const l of listeners) l();
      if (again) {
        again = false;
        refreshNavCounts();
      }
    });
}

/** Tab focus and API writes refresh only while a sidebar shows the counts (not on lesson pages). */
function refreshIfShown() {
  if (listeners.size > 0) refreshNavCounts();
}

let writeTimer: ReturnType<typeof setTimeout> | undefined;

/** A burst of writes (the progress move on Hôm nay sends 4 PUTs at a time) refreshes once, 300 ms after it ends. */
function onWrite() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(refreshIfShown, 300);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshIfShown();
    });
    window.addEventListener(API_WRITE_EVENT, onWrite);
  }
  return () => {
    listeners.delete(cb);
  };
}

const snapshot = () => counts;

/** The counts, or null while unknown. The first fetch comes from the sidebar's navigation effect. */
export function useNavCounts(): ApiCounts | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
