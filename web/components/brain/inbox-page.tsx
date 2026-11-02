'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Inbox, Loader2 } from 'lucide-react';
import {
  api,
  type ApiInboxEntry,
  type ApiInboxStatus,
  type ApiOpportunity,
  type ApiStance,
  type Page,
} from '@/lib/api/client';
import { toApiError, useApi } from '@/lib/api/use-api';
import { destinations, formatDate, hostOf, inboxStatuses, inboxStatusOf } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Textarea } from '@/components/ui/textarea';
import { ApiErrorState, EmptyState, LoadingCards, describeApiError } from './api-state';
import { BrainCard, StatusBadge } from './brain-card';
import { refreshInboxCount } from './inbox-count';
import { OpportunityDialog } from './opportunity-dialog';

const PAGE = 100;

function titleOf(e: ApiInboxEntry): string {
  return e.ogTitle || e.url || (e.text ?? '').split('\n')[0].slice(0, 140) || `Mục #${e.id}`;
}

/** A capture is a URL when the whole box is one http(s) link, otherwise text (API_CONTRACT.md). */
function captureBody(value: string): { url: string } | { text: string } {
  const v = value.trim();
  return /^https?:\/\/\S+$/i.test(v) ? { url: v } : { text: v };
}

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

function CaptureBox({
  inputRef,
  onCaptured,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onCaptured: (e: ApiInboxEntry) => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCaptured(await api.createInboxEntry(captureBody(value)));
      setValue('');
      void refreshInboxCount();
    } catch (err) {
      const e = toApiError(err);
      setError(e.status === 400 ? 'Link không hợp lệ (chỉ nhận http và https).' : describeApiError(e).title);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-3xl border bg-card p-3 shadow-depth-1"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="capture" className="px-1 text-sm font-medium">
        Thu thập nhanh
      </label>
      <Textarea
        id="capture"
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
          if (e.key === 'Escape') e.currentTarget.blur();
        }}
        placeholder="Dán một link hoặc ghi một ý tưởng…"
        rows={2}
      />
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs text-muted-foreground">
          <Kbd>⌘</Kbd>+<Kbd>Enter</Kbd> để lưu · tag và tóm tắt được thêm sau, trong nền
        </span>
        {error && (
          <span className="text-xs text-destructive-foreground" role="alert">
            {error}
          </span>
        )}
        <Button type="submit" size="sm" className="ms-auto" disabled={busy || !value.trim()}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Lưu vào inbox
        </Button>
      </div>
    </form>
  );
}

function EntryCard({
  entry,
  selected,
  onSelect,
  onTriage,
  onOpportunity,
}: {
  entry: ApiInboxEntry;
  selected: boolean;
  onSelect: () => void;
  onTriage: (status: ApiInboxStatus) => void;
  onOpportunity: () => void;
}) {
  const s = inboxStatusOf(entry.status);
  const site = entry.ogSiteName || hostOf(entry.url);
  const body = entry.summary || entry.ogDescription || (entry.ogTitle || entry.url ? '' : entry.text);
  const id = `inbox-entry-${entry.id}`;
  useEffect(() => {
    if (selected) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [selected, id]);

  return (
    <BrainCard
      id={id}
      selected={selected}
      onClick={onSelect}
      thumbnail={entry.thumbnailUrl}
      badges={
        <>
          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          {!entry.processed && !entry.error && (
            <Badge variant="secondary">
              <Loader2 className="animate-spin" aria-hidden />
              Đang xử lý
            </Badge>
          )}
          {entry.error && <Badge variant="error">Lỗi xử lý</Badge>}
          {entry.suggestedDestination && (
            <Badge variant="outline">→ {destinations[entry.suggestedDestination] ?? entry.suggestedDestination}</Badge>
          )}
        </>
      }
      title={
        entry.url ? (
          <a href={entry.url} target="_blank" rel="noreferrer" className="hover:text-primary">
            {titleOf(entry)}
          </a>
        ) : (
          titleOf(entry)
        )
      }
      meta={[site, formatDate(entry.createdAt)].filter(Boolean).join(' · ')}
      actions={
        <>
          {entry.status !== 'later' && (
            <Button size="xs" variant="outline" onClick={() => onTriage('later')}>
              Đọc sau <Kbd>L</Kbd>
            </Button>
          )}
          {entry.status !== 'archived' && (
            <Button size="xs" variant="outline" onClick={() => onTriage('archived')}>
              Lưu trữ <Kbd>A</Kbd>
            </Button>
          )}
          {entry.status !== 'inbox' && (
            <Button size="xs" variant="outline" onClick={() => onTriage('inbox')}>
              Về inbox <Kbd>U</Kbd>
            </Button>
          )}
          <Button size="xs" variant="outline" onClick={onOpportunity}>
            Cơ hội <Kbd>O</Kbd>
          </Button>
          {entry.url && (
            <Button size="xs" variant="ghost" render={<a href={entry.url} target="_blank" rel="noreferrer" />}>
              Mở <Kbd>I</Kbd>
            </Button>
          )}
        </>
      }
    >
      {body && (
        <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-line">{body}</p>
      )}
      {entry.suggestedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.suggestedTags.map((t) => (
            <Badge key={t} variant="outline">
              #{t}
            </Badge>
          ))}
        </div>
      )}
    </BrainCard>
  );
}

const keyHelp: [string, string][] = [
  ['J / K', 'xuống / lên'],
  ['L', 'đọc sau'],
  ['A', 'lưu trữ'],
  ['U', 'về inbox'],
  ['O', 'bằng chứng cho cơ hội'],
  ['I', 'mở link'],
  ['C', 'thu thập'],
];

/** Inbox (DECISIONS 9.2): capture, OG cards, keyboard triage with one key per decision. */
export function InboxPage() {
  const [status, setStatus] = useState<ApiInboxStatus>('inbox');
  const [cursor, setCursor] = useState(0);
  const [pickFor, setPickFor] = useState<ApiInboxEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const inbox = useApi<Page<ApiInboxEntry>>(`inbox:${status}`, () => api.listInbox({ status, limit: PAGE }));
  const shown = inbox.loading ? [] : (inbox.data?.results ?? []);
  const selected = Math.min(cursor, Math.max(0, shown.length - 1));
  const current = shown[selected];
  const { mutate, reload } = inbox;

  const remove = useCallback(
    (id: number) => mutate((d) => d && { ...d, results: d.results.filter((e) => e.id !== id) }),
    [mutate],
  );

  const triage = useCallback(
    async (entry: ApiInboxEntry, next: ApiInboxStatus) => {
      if (entry.status === next) return;
      remove(entry.id);
      try {
        await api.triageInboxEntry(entry.id, { status: next });
        setNotice(`"${titleOf(entry)}" → ${inboxStatusOf(next).label}`);
      } catch (err) {
        setNotice(describeApiError(toApiError(err)).title);
        reload();
      }
      void refreshInboxCount();
    },
    [reload, remove],
  );

  const attach = useCallback(
    async (entry: ApiInboxEntry, opp: ApiOpportunity, stance: ApiStance) => {
      setPickFor(null);
      remove(entry.id);
      try {
        const res = await api.attachInboxEvidence(opp.id, { inboxEntry: entry.id, stance, archive: true });
        setNotice(`${res.created ? 'Đã thêm' : 'Đã có sẵn'} làm bằng chứng cho "${opp.title}", mục đã lưu trữ`);
      } catch (err) {
        setNotice(describeApiError(toApiError(err)).title);
        reload();
      }
      void refreshInboxCount();
    },
    [reload, remove],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pickFor || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      const act: Record<string, () => void> = {
        j: () => setCursor(Math.min(selected + 1, shown.length - 1)),
        arrowdown: () => setCursor(Math.min(selected + 1, shown.length - 1)),
        k: () => setCursor(Math.max(selected - 1, 0)),
        arrowup: () => setCursor(Math.max(selected - 1, 0)),
        c: () => captureRef.current?.focus(),
        ...(current && {
          l: () => void triage(current, 'later'),
          a: () => void triage(current, 'archived'),
          u: () => void triage(current, 'inbox'),
          o: () => setPickFor(current),
          i: () => current.url && window.open(current.url, '_blank', 'noopener'),
        }),
      };
      const run = act[k];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickFor, selected, shown.length, current, triage]);

  const loadMore = async () => {
    const next = inbox.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await api.page<ApiInboxEntry>(next);
      inbox.mutate((d) => d && { results: [...d.results, ...page.results], next: page.next });
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-4 pb-12 sm:px-8">
      <CaptureBox
        inputRef={captureRef}
        onCaptured={(e) => {
          if (status === 'inbox') inbox.mutate((d) => d && { ...d, results: [e, ...d.results] });
          setCursor(0);
          setNotice('Đã lưu vào inbox');
        }}
      />

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Trạng thái">
        {inboxStatuses.map((s) => (
          <Button
            key={s.value}
            role="tab"
            aria-selected={status === s.value}
            size="sm"
            variant={status === s.value ? 'default' : 'outline'}
            onClick={() => {
              setStatus(s.value);
              setCursor(0);
            }}
          >
            {s.label}
          </Button>
        ))}
        <p className="ms-auto hidden flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground lg:flex">
          {keyHelp.map(([k, label]) => (
            <span key={k}>
              <Kbd>{k}</Kbd> {label}
            </span>
          ))}
        </p>
      </div>

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      {inbox.error && !inbox.data ? (
        <ApiErrorState error={inbox.error} onRetry={inbox.reload} />
      ) : inbox.loading && shown.length === 0 ? (
        <LoadingCards />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Inbox aria-hidden />}
          title={status === 'inbox' ? 'Inbox đã về 0' : `Không có mục nào ở "${inboxStatusOf(status).label}"`}
          description={status === 'inbox' ? 'Mọi thứ đã được xử lý. Dán link mới vào ô thu thập ở trên.' : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((e, i) => (
            <EntryCard
              key={e.id}
              entry={e}
              selected={i === selected}
              onSelect={() => setCursor(i)}
              onTriage={(next) => void triage(e, next)}
              onOpportunity={() => setPickFor(e)}
            />
          ))}
          {inbox.data?.next && (
            <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
              Tải thêm
            </Button>
          )}
        </div>
      )}

      <OpportunityDialog
        open={pickFor !== null}
        onOpenChange={(o) => !o && setPickFor(null)}
        entryTitle={pickFor ? titleOf(pickFor) : ''}
        onPick={(opp, stance) => pickFor && void attach(pickFor, opp, stance)}
      />
    </div>
  );
}
