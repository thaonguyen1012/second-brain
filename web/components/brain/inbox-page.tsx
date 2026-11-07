'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Inbox, Lightbulb, Loader2, NotebookPen, Plus, Trash2 } from 'lucide-react';
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
import { destinations, formatDate, hostOf, inboxStatuses, inboxStatusOf } from '@/lib/labels';
import { itemDraftFromEntry, noteTitle } from '@/lib/library-labels';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { MenuItem, MenuSeparator, MenuShortcut } from '@/components/ui/menu';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiErrorState, ApiStaleAlert, LoadingCards, describeApiError } from './api-state';
import { BrainCard } from './brain-card';
import { ConfirmDelete } from './confirm-delete';
import { EmptyPanel } from './empty-panel';
import { refreshInboxCount, useInboxCount } from './inbox-count';
import { ItemDialog } from './item-dialog';
import { KeyLegend } from './key-legend';
import { NoteDialog, type NoteDraft } from './library/note-dialog';
import { useItemIndex } from './library/use-item-index';
import { OpportunityDialog } from './opportunity-dialog';
import { RowMenu } from './row-menu';
import { SaveKeys } from './save-keys';

const PAGE = 100;
/** A Cmd+K deep link pages through at most this many pages of a tab to find its entry. */
const FOCUS_MAX_PAGES = 10;

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

/** Key hint on a row's visible verbs: hidden on touch screens and at phone width (DESIGN.md D24). */
function RowKey({ children }: { children: string }) {
  return <Kbd className="max-sm:hidden pointer-coarse:hidden">{children}</Kbd>;
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
      className="flex flex-col gap-2 rounded-xl border bg-card p-3"
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
        <span className="text-xs text-muted-foreground max-sm:hidden pointer-coarse:hidden">
          <SaveKeys /> để lưu
        </span>
        {error && (
          <span className="text-xs text-destructive-foreground" role="alert">
            {error}
          </span>
        )}
        {/* Outline while there is nothing to save, so a disabled filled button never reads as broken (D2 holds) */}
        <Button
          type="submit"
          size="sm"
          variant={value.trim() ? 'default' : 'outline'}
          className="ms-auto max-sm:w-full"
          disabled={busy || !value.trim()}
        >
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
  const site = entry.ogSiteName || hostOf(entry.url);
  // An LLM summary says so in words (DESIGN.md §4 "AI output", D18); og:description and captured text do not
  const autoSummary = !!entry.summary;
  const body = entry.summary || entry.ogDescription || (entry.ogTitle || entry.url ? '' : entry.text);
  // The suggestion helps triage: once the entry left the inbox the decision is made and the label goes
  const suggestion =
    entry.status === 'inbox' && entry.suggestedDestination
      ? (destinations[entry.suggestedDestination] ?? entry.suggestedDestination)
      : null;
  const metaParts: React.ReactNode[] = [site, formatDate(entry.createdAt)].filter(Boolean);
  if (suggestion) metaParts.push(`Gợi ý tự động: ${suggestion}`);
  if (entry.item)
    metaParts.push(
      <Link
        key="item"
        href={`/thu-vien/ghi-chu/?item=${entry.item}`}
        title="Ghi chú của item này"
        className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Item: {linkedItem?.title ?? `#${entry.item}`}
      </Link>,
    );
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
        // The status is the selected tab, so no status badge; only states the tab does not say (BADGE-1)
        !entry.processed && !entry.error ? (
          <Badge variant="secondary">
            <Loader2 className="animate-spin" aria-hidden />
            Đang xử lý
          </Badge>
        ) : entry.error ? (
          <Badge variant="error">Lỗi xử lý</Badge>
        ) : undefined
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
      meta={
        metaParts.length > 0 &&
        metaParts.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && ' · '}
            {part}
          </Fragment>
        ))
      }
      actions={
        <>
          {entry.status === 'inbox' && (
            <Button size="xs" variant="outline" onClick={() => onTriage('later')}>
              Đọc sau <RowKey>L</RowKey>
            </Button>
          )}
          {entry.status !== 'archived' && (
            <Button size="xs" variant="outline" onClick={() => onTriage('archived')}>
              Lưu trữ <RowKey>A</RowKey>
            </Button>
          )}
          {entry.status !== 'inbox' && (
            <Button size="xs" variant="outline" onClick={() => onTriage('inbox')}>
              Về inbox <RowKey>U</RowKey>
            </Button>
          )}
          {entry.url ? (
            <Button size="xs" variant="ghost" render={<a href={entry.url} target="_blank" rel="noreferrer" />}>
              <ExternalLink aria-hidden />
              Mở <RowKey>I</RowKey>
            </Button>
          ) : (
            <Button size="xs" variant="ghost" onClick={onNote}>
              <NotebookPen aria-hidden />
              Ghi chú <RowKey>N</RowKey>
            </Button>
          )}
          <span className="ms-auto">
            <RowMenu>
              <MenuItem onClick={onOpportunity}>
                <Lightbulb aria-hidden />
                Bằng chứng cho cơ hội
                <MenuShortcut>O</MenuShortcut>
              </MenuItem>
              {!entry.item && (
                <MenuItem onClick={onItem}>
                  <Plus aria-hidden />
                  Thành item
                  <MenuShortcut>T</MenuShortcut>
                </MenuItem>
              )}
              {entry.url && (
                <MenuItem onClick={onNote}>
                  <NotebookPen aria-hidden />
                  Ghi chú
                  <MenuShortcut>N</MenuShortcut>
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem variant="destructive" onClick={onDelete}>
                <Trash2 aria-hidden />
                Xóa
                <MenuShortcut>Del</MenuShortcut>
              </MenuItem>
            </RowMenu>
          </span>
        </>
      }
    >
      {body && (
        <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-line">
          {autoSummary && <span className="font-medium">Tóm tắt tự động: </span>}
          {body}
        </p>
      )}
      {entry.suggestedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.suggestedTags.map((t) => (
            <Badge key={t} variant="outline">
              #{t}
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground">tự động</span>
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
  ['Del', 'xóa'],
  ['C', 'thu thập'],
  ['?', 'bảng phím tắt này'],
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
  const inboxCount = useInboxCount();

  // An empty Inbox tab is either the first run (nothing ever captured: the empty panel) or cleared (one line,
  // DESIGN.md §9a). Two COUNTs tell them apart, asked only while the tab is empty; an entry handled on this visit
  // already means cleared.
  const [handled, setHandled] = useState(false);
  const inboxEmpty = status === 'inbox' && !inbox.loading && !!inbox.data && !inbox.error && shown.length === 0;
  const elsewhere = useApi(inboxEmpty && !handled ? 'inbox:elsewhere' : null, async () => {
    const [later, archived] = await Promise.all([
      api.countInbox({ status: 'later' }),
      api.countInbox({ status: 'archived' }),
    ]);
    return later.count + archived.count;
  });
  const firstRun = inboxEmpty && !handled && elsewhere.data === 0 && !elsewhere.loading;

  // ?status=S&id=N (Cmd+K result): switch to that tab, then select the entry once the tab's list has loaded.
  // Cmd+K finds old archived entries too, so the list pages forward ("Tải thêm") until the entry shows up.
  const [focusId, setFocusId] = useState<number | null>(null);
  const [focusPages, setFocusPages] = useState(0);
  useOpenFromUrl(
    'id',
    (id, params) => {
      const tab = inboxStatuses.find((x) => x.value === params.get('status'));
      if (tab) setStatus(tab.value);
      setFocusId(id);
      setFocusPages(0);
    },
    ['status'],
  );
  const nextUrl = inbox.data?.next ?? null;
  const seeking = focusId !== null && !inbox.loading && inbox.dataKey === `inbox:${status}`;
  const focusAt = seeking ? shown.findIndex((e) => e.id === focusId) : -1;
  const pageForFocus = seeking && focusAt < 0 && !inbox.error && nextUrl !== null && focusPages < FOCUS_MAX_PAGES;
  if (seeking && !pageForFocus) {
    setFocusId(null);
    if (focusAt >= 0) setCursor(focusAt);
    else if (!inbox.error)
      setNotice(
        nextUrl
          ? `Không thấy mục này trong ${FOCUS_MAX_PAGES * PAGE} mục mới nhất của tab: bấm "Tải thêm" để xem tiếp.`
          : 'Không thấy mục này: có thể đã bị xóa hoặc đổi trạng thái.',
      );
  }
  useEffect(() => {
    if (!pageForFocus) return;
    let alive = true;
    appendNextPage(inbox).then(
      () => alive && setFocusPages((n) => n + 1),
      (err: unknown) => {
        if (!alive) return;
        setFocusId(null);
        setNotice(describeApiError(toApiError(err)).title);
      },
    );
    return () => {
      alive = false;
    };
    // `inbox` changes identity every render; the page to load is identified by nextUrl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageForFocus, nextUrl]);
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
      setHandled(true);
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
      setHandled(true);
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
      // The key legend dialog and a row's overflow menu handle their own keys
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
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
          // Del / Backspace delete, as on the week page (X there means "bỏ" an objective)
          delete: () => setDeleteFor(current),
          backspace: () => setDeleteFor(current),
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
    <div className="flex min-w-0 flex-col gap-6">
      <CaptureBox
        inputRef={captureRef}
        onCaptured={(e) => {
          if (status === 'inbox') inbox.mutate((d) => d && { ...d, results: [e, ...d.results] });
          setCursor(0);
          setNotice('Đã lưu vào inbox');
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as ApiInboxStatus);
            setCursor(0);
          }}
        >
          <TabsList aria-label="Trạng thái">
            {inboxStatuses.map((s) => (
              <TabsTab key={s.value} value={s.value}>
                {s.label}
                {/* The backlog as plain muted text, like the Thư viện tabs (the top bar's badge says the same) */}
                {s.value === 'inbox' && inboxCount !== null && (
                  <span className="ms-1.5 text-xs font-normal text-muted-foreground tabular-nums">{inboxCount}</span>
                )}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
        {/* First run: no entry for a key to act on yet */}
        {!firstRun && (
          <div className="ms-auto">
            <KeyLegend keys={keyHelp} title="Phím tắt của Inbox" />
          </div>
        )}
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
      ) : firstRun ? (
        <EmptyPanel
          area="neutral"
          glyph={Inbox}
          title="Inbox trống"
          text="Dán một link hoặc ghi một ý tưởng vào ô ở trên; mỗi mục sẽ hiện ở đây thành một thẻ để xử lý bằng phím."
        />
      ) : shown.length === 0 ? (
        // Cleared, or a tab with nothing in it: one line, no action (DESIGN.md §9a). Blank while the counts answer.
        status !== 'inbox' ? (
          <p className="text-sm text-muted-foreground">Không có mục nào ở &ldquo;{inboxStatusOf(status).label}&rdquo;.</p>
        ) : handled || (elsewhere.data !== undefined && !elsewhere.loading) || elsewhere.error ? (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Đã xử lý hết.</span> Mục mới sẽ hiện ở đây.
          </p>
        ) : null
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
          setHandled(true);
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
