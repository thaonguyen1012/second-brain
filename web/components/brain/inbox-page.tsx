'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Inbox, Library, Loader2, NotebookPen, Plus } from 'lucide-react';
import {
  api,
  type ApiInboxEntry,
  type ApiInboxStatus,
  type ApiItem,
  type ApiOpportunity,
  type ApiStance,
  type Page,
} from '@/lib/api/client';
import { linkInboxItem } from '@/lib/api/library';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { destinations, formatDate, hostOf, inboxStatuses, inboxStatusOf, itemTypeLabel } from '@/lib/labels';
import { itemDraftFromEntry, noteTitle } from '@/lib/library-labels';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Textarea } from '@/components/ui/textarea';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError } from './api-state';
import { BrainCard, StatusBadge } from './brain-card';
import { ConfirmDelete, DeleteButton } from './confirm-delete';
import { refreshInboxCount } from './inbox-count';
import { ItemDialog } from './item-dialog';
import { NoteDialog, type NoteDraft } from './library/note-dialog';
import { useItemIndex } from './library/use-item-index';
import { OpportunityDialog } from './opportunity-dialog';
import { SaveKeys } from './save-keys';

const PAGE = 100;

function titleOf(e: ApiInboxEntry): string {
  return e.ogTitle || e.url || (e.text ?? '').split('\n')[0].slice(0, 140) || `Mục #${e.id}`;
}

/** A capture is a URL when the whole box is one http(s) link, otherwise text (API_CONTRACT.md). */
function captureBody(value: string): { url: string } | { text: string } {
  const v = value.trim();
  return /^https?:\/\/\S+$/i.test(v) ? { url: v } : { text: v };
}

/** A note started from an inbox entry: its link and summary (or the captured text), linked to its Item. */
function noteDraftOf(e: ApiInboxEntry): NoteDraft {
  const about = e.summary || e.ogDescription;
  return {
    title: titleOf(e).slice(0, 300),
    markdown: [e.url, about, e.url ? '' : e.text].filter(Boolean).join('\n\n') + '\n\n',
    items: e.item ? [e.item] : [],
  };
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
          <SaveKeys /> để lưu · tag và tóm tắt được thêm sau, trong nền
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
  linkedItem,
  selected,
  onSelect,
  onTriage,
  onOpportunity,
  onItem,
  onNote,
  onDelete,
}: {
  entry: ApiInboxEntry;
  /** Title and type of the linked Item, when the Item list has loaded. */
  linkedItem?: { title: string; type: string };
  selected: boolean;
  onSelect: () => void;
  onTriage: (status: ApiInboxStatus) => void;
  onOpportunity: () => void;
  onItem: () => void;
  onNote: () => void;
  onDelete: () => void;
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
          {entry.item && (
            <Badge
              variant="success"
              render={<Link href={`/thu-vien/ghi-chu/?item=${entry.item}`} title="Ghi chú của item này" />}
            >
              <Library aria-hidden />
              {linkedItem ? `${itemTypeLabel(linkedItem.type)} · ` : 'Item '}
              <span className="max-w-56 truncate">{linkedItem?.title ?? `#${entry.item}`}</span>
            </Badge>
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
          {!entry.item && (
            <Button size="xs" variant="outline" onClick={onItem}>
              <Plus aria-hidden />
              Thành item <Kbd>T</Kbd>
            </Button>
          )}
          <Button size="xs" variant="outline" onClick={onNote}>
            <NotebookPen aria-hidden />
            Ghi chú <Kbd>N</Kbd>
          </Button>
          {entry.url && (
            <Button size="xs" variant="ghost" render={<a href={entry.url} target="_blank" rel="noreferrer" />}>
              Mở <Kbd>I</Kbd>
            </Button>
          )}
          <DeleteButton className="ms-auto" onClick={onDelete}>
            Xóa <Kbd>X</Kbd>
          </DeleteButton>
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
  ['T', 'thành item'],
  ['N', 'ghi chú'],
  ['I', 'mở link'],
  ['X', 'xóa'],
  ['C', 'thu thập'],
];

/** Inbox (DECISIONS 9.2): capture, OG cards, keyboard triage with one key per decision. */
export function InboxPage() {
  const [status, setStatus] = useState<ApiInboxStatus>('inbox');
  const [cursor, setCursor] = useState(0);
  const [pickFor, setPickFor] = useState<ApiInboxEntry | null>(null);
  const [itemFor, setItemFor] = useState<ApiInboxEntry | null>(null);
  const [noteFor, setNoteFor] = useState<ApiInboxEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<ApiInboxEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const inbox = useApi<Page<ApiInboxEntry>>(`inbox:${status}`, () => api.listInbox({ status, limit: PAGE }));
  const shown = inbox.loading ? [] : (inbox.data?.results ?? []);

  // ?status=S&id=N (Cmd+K result): switch to that tab, then select the entry once the tab's list has loaded.
  const [focusId, setFocusId] = useState<number | null>(null);
  useOpenFromUrl(
    'id',
    (id, params) => {
      const tab = inboxStatuses.find((x) => x.value === params.get('status'));
      if (tab) setStatus(tab.value);
      setFocusId(id);
    },
    ['status'],
  );
  if (focusId !== null && !inbox.loading && inbox.dataKey === `inbox:${status}`) {
    const at = shown.findIndex((e) => e.id === focusId);
    setFocusId(null);
    if (at >= 0) setCursor(at);
    else if (!inbox.error) setNotice('Không thấy mục này trong danh sách: có thể ở trang sau hoặc đã bị xóa.');
  }
  const selected = Math.min(cursor, Math.max(0, shown.length - 1));
  const current = shown[selected];
  const { mutate, reload } = inbox;
  // Cards label linked Items from `itemTitle`/`itemType`; the full list is only for the note dialog's picker.
  const index = useItemIndex(noteFor !== null);
  const { put: putItem } = index;
  const dialogOpen = pickFor !== null || itemFor !== null || noteFor !== null || deleteFor !== null;

  const replace = useCallback(
    (entry: ApiInboxEntry) =>
      mutate((d) => d && { ...d, results: d.results.map((e) => (e.id === entry.id ? entry : e)) }),
    [mutate],
  );

  /** "Thành item": the Item was created in the dialog; link the entry to it, status unchanged. */
  const linkItem = useCallback(
    async (entry: ApiInboxEntry, item: ApiItem) => {
      setItemFor(null);
      putItem(item);
      replace({ ...entry, item: item.id, itemTitle: item.title, itemType: item.type });
      try {
        replace(await linkInboxItem(entry.id, item.id));
        setNotice(`Đã thêm "${item.title}" vào thư viện và liên kết mục inbox. Nhấn A để lưu trữ mục.`);
      } catch (err) {
        setNotice(`Đã thêm "${item.title}" nhưng chưa liên kết được: ${describeApiError(toApiError(err)).title}`);
        reload();
      }
    },
    [putItem, replace, reload],
  );

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
      if (dialogOpen || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
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
          t: () => !current.item && setItemFor(current),
          n: () => setNoteFor(current),
          i: () => current.url && window.open(current.url, '_blank', 'noopener'),
          x: () => setDeleteFor(current),
          delete: () => setDeleteFor(current),
        }),
      };
      const run = act[k];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, selected, shown.length, current, triage]);

  const loadMore = async () => {
    const next = inbox.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(inbox);
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

      <ApiStaleAlert result={inbox} />
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
              linkedItem={e.item && e.itemTitle !== null ? { title: e.itemTitle, type: e.itemType ?? '' } : undefined}
              onItem={() => setItemFor(e)}
              onNote={() => setNoteFor(e)}
              onDelete={() => setDeleteFor(e)}
            />
          ))}
          {inbox.data?.next && (
            <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
              Tải thêm
            </Button>
          )}
        </div>
      )}

      <ConfirmDelete
        open={deleteFor !== null}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        title="Xóa mục inbox?"
        description={
          deleteFor
            ? `"${titleOf(deleteFor)}" bị xóa hẳn, kể cả ảnh thu nhỏ. Item và ghi chú đã tạo từ mục này vẫn giữ nguyên. Không hoàn tác được.`
            : undefined
        }
        action={() => (deleteFor ? api.deleteInboxEntry(deleteFor.id) : Promise.resolve())}
        onDeleted={() => {
          if (!deleteFor) return;
          remove(deleteFor.id);
          setNotice(`Đã xóa "${titleOf(deleteFor)}"`);
          void refreshInboxCount();
        }}
      />

      <OpportunityDialog
        open={pickFor !== null}
        onOpenChange={(o) => !o && setPickFor(null)}
        entryTitle={pickFor ? titleOf(pickFor) : ''}
        onPick={(opp, stance) => pickFor && void attach(pickFor, opp, stance)}
      />

      <ItemDialog
        open={itemFor !== null}
        item={null}
        draft={itemFor ? itemDraftFromEntry(itemFor, titleOf(itemFor)) : undefined}
        onOpenChange={(o) => !o && setItemFor(null)}
        onSaved={(item) => itemFor && void linkItem(itemFor, item)}
      />

      <NoteDialog
        open={noteFor !== null}
        note={null}
        draft={noteFor ? noteDraftOf(noteFor) : undefined}
        description={noteFor ? `Từ inbox: ${titleOf(noteFor)}` : undefined}
        items={index.items}
        byId={index.byId}
        itemsStatus={index.loading && index.items.length === 0 ? 'Đang tải danh sách item…' : undefined}
        onOpenChange={(o) => !o && setNoteFor(null)}
        onSaved={(note) => {
          setNoteFor(null);
          setNotice(`Đã tạo ghi chú "${noteTitle(note)}". Nhấn A để lưu trữ mục inbox.`);
        }}
      />
    </div>
  );
}
