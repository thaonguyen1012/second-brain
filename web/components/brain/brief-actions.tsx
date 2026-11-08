'use client';
import { useState, useSyncExternalStore } from 'react';
import { Check, Inbox, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api, type ApiNewsFeedback, type ApiNewsItem } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { firstFieldError } from '@/lib/labels';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
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

function errorText(err: unknown, t: T): string {
  const e = toApiError(err);
  return (e.status === 400 && firstFieldError(e.body, t)) || describeApiError(e, t).title;
}

/** "Đưa vào Inbox": one tap moves a brief story into the inbox (POST /api/inbox with its URL, DECISIONS 5). */
function ToInbox({ item }: { item: ApiNewsItem }) {
  const t = useT();
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
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  // One button in every state, never natively disabled: a removed or disabled button drops keyboard focus to
  // <body>. While sending and once sent it is aria-disabled (send() ignores presses); the live region
  // announces the new text.
  return (
    <>
      <span aria-live="polite" className="inline-flex">
        <Button
          size="xs"
          variant={sent ? 'ghost' : 'outline'}
          aria-disabled={sent || busy || undefined}
          aria-busy={busy || undefined}
          aria-label={
            sent ? t('Đã vào Inbox: {title}', { title: item.title }) : t('Đưa vào Inbox: {title}', { title: item.title })
          }
          className={sent ? 'cursor-default text-muted-foreground hover:bg-transparent' : undefined}
          onClick={() => void send()}
        >
          {sent ? (
            <Check aria-hidden />
          ) : busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Inbox aria-hidden />
          )}
          {sent ? t('Đã vào Inbox') : t('Đưa vào Inbox')}
        </Button>
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
  label: Msg;
  icon: typeof ThumbsUp;
}[] = [
  { value: 'useful', label: msg('Hữu ích'), icon: ThumbsUp },
  { value: 'not_useful', label: msg('Không hữu ích'), icon: ThumbsDown },
];

/**
 * "Hữu ích / Không hữu ích" (PATCH /api/news/{id}, DECISIONS 5, 10.3): the ratings feed the golden set of
 * `manage.py eval brief`. Pressing the active rating again clears it. The change shows at once and is undone
 * if the save fails. Icon-only toggle buttons with a tooltip; the active one is the neutral secondary fill.
 */
function Feedback({
  item,
  onRated,
}: {
  item: ApiNewsItem;
  onRated: (id: number, feedback: ApiNewsFeedback | null) => void;
}) {
  const t = useT();
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
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        role="group"
        aria-label={t('Tin "{title}" có hữu ích không?', { title: item.title })}
        className="flex items-center gap-0.5"
      >
        {ratings.map(({ value, label, icon: Icon }) => {
          const on = current === value;
          return (
            <Tooltip key={value}>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant={on ? 'secondary' : 'ghost'}
                    aria-label={t(label)}
                    aria-pressed={on}
                    aria-busy={busy || undefined}
                    onClick={() => void rate(value)}
                  />
                }
              >
                <Icon aria-hidden />
              </TooltipTrigger>
              <TooltipPopup>{on ? t('{label} (bấm lần nữa để bỏ)', { label: t(label) }) : t(label)}</TooltipPopup>
            </Tooltip>
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
