'use client';
import { useState, useSyncExternalStore } from 'react';
import { Check, Inbox, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api, type ApiNewsFeedback, type ApiNewsItem } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { firstFieldError } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { describeApiError } from './api-state';
import { refreshInboxCount } from './inbox-count';

// News items already sent to the inbox from this browser. The API has no link from a news item to an inbox
// entry, so this is a per-browser memory that keeps the button "done" across reloads; it may be lost (private
// window, cleared storage) and the page works without it.
const SENT_KEY = 'brain:brief-sent-to-inbox';
const SENT_MAX = 300;
const sentListeners = new Set<() => void>();
let sentCache: string | null = null;

function readSent(): string {
  if (sentCache === null) {
    try {
      sentCache = localStorage.getItem(SENT_KEY) ?? '[]';
    } catch {
      sentCache = '[]';
    }
  }
  return sentCache;
}

function sentIds(raw: string): number[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function markSent(id: number) {
  const ids = [...sentIds(readSent()).filter((x) => x !== id), id].slice(-SENT_MAX);
  sentCache = JSON.stringify(ids);
  try {
    localStorage.setItem(SENT_KEY, sentCache);
  } catch {
    // storage unavailable: the "done" state lasts until the page is closed
  }
  for (const l of sentListeners) l();
}

function subscribeSent(cb: () => void) {
  sentListeners.add(cb);
  return () => {
    sentListeners.delete(cb);
  };
}

function useSent(id: number): boolean {
  const raw = useSyncExternalStore(subscribeSent, readSent, () => '[]');
  return sentIds(raw).includes(id);
}

function errorText(err: unknown): string {
  const e = toApiError(err);
  return (e.status === 400 && firstFieldError(e.body)) || describeApiError(e).title;
}

/** "Đưa vào Inbox": one tap moves a brief story into the inbox (POST /api/inbox with its URL, DECISIONS 5). */
function ToInbox({ item }: { item: ApiNewsItem }) {
  const sent = useSent(item.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (busy || sent) return;
    setBusy(true);
    setError(null);
    try {
      await api.createInboxEntry({ url: item.url });
      markSent(item.id);
      void refreshInboxCount();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span aria-live="polite" className="inline-flex">
        {sent ? (
          <span className="inline-flex h-7 items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground sm:h-6">
            <Check className="size-3.5 text-primary" aria-hidden />
            Đã vào Inbox
          </span>
        ) : (
          <Button
            size="xs"
            variant="outline"
            loading={busy}
            aria-label={`Đưa vào Inbox: ${item.title}`}
            onClick={() => void send()}
          >
            <Inbox aria-hidden />
            Đưa vào Inbox
          </Button>
        )}
      </span>
      {error && (
        <span role="alert" className="text-xs text-destructive-foreground">
          {error}
        </span>
      )}
    </>
  );
}

const ratings: {
  value: ApiNewsFeedback;
  label: string;
  icon: typeof ThumbsUp;
}[] = [
  { value: 'useful', label: 'Hữu ích', icon: ThumbsUp },
  { value: 'not_useful', label: 'Không hữu ích', icon: ThumbsDown },
];

/**
 * "Hữu ích / Không hữu ích" (PATCH /api/news/{id}, DECISIONS 5, 10.3): the ratings feed the golden set of
 * `manage.py eval brief`. Pressing the active rating again clears it. The change shows at once and is undone
 * if the save fails.
 */
function Feedback({
  item,
  onRated,
}: {
  item: ApiNewsItem;
  onRated: (id: number, feedback: ApiNewsFeedback | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = item.feedback ?? null;

  const rate = async (value: ApiNewsFeedback) => {
    if (busy) return;
    const next = current === value ? null : value;
    setBusy(true);
    setError(null);
    onRated(item.id, next);
    try {
      const saved = await api.rateNewsItem(item.id, next);
      onRated(item.id, saved.feedback ?? null);
    } catch (err) {
      onRated(item.id, current);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div role="group" aria-label="Tin này có hữu ích không?" className="flex items-center gap-1">
        {ratings.map(({ value, label, icon: Icon }) => {
          const on = current === value;
          return (
            <Button
              key={value}
              size="xs"
              variant={on ? 'secondary' : 'ghost'}
              aria-pressed={on}
              aria-busy={busy || undefined}
              title={on ? `${label} (bấm lần nữa để bỏ)` : label}
              onClick={() => void rate(value)}
              className={on ? 'ring-1 ring-primary/40' : undefined}
            >
              <Icon aria-hidden className={on ? 'text-primary' : undefined} />
              {label}
            </Button>
          );
        })}
      </div>
      {error && (
        <span role="alert" className="text-xs text-destructive-foreground">
          {error}
        </span>
      )}
    </>
  );
}

/** The action row of a morning-brief card, loaded outside the home page's first JS (today.tsx). */
export default function BriefActions({
  item,
  onRated,
}: {
  item: ApiNewsItem;
  onRated: (id: number, feedback: ApiNewsFeedback | null) => void;
}) {
  return (
    <>
      <ToInbox item={item} />
      <Feedback item={item} onRated={onRated} />
    </>
  );
}
