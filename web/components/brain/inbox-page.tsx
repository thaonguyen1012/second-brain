'use client';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
import { singleKeyShortcut, useSingleKeyShortcuts } from '@/lib/single-key-shortcuts';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { focusShortcutOpener } from '@/lib/shortcut-opener';
import { tabPanelProps, tabProps } from '@/lib/tab-panel';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiErrorState, ApiStaleAlert, LoadingCards, describeApiError } from './api-state';
import { BrainCard } from './brain-card';
import { ConfirmDelete, focusCandidates, focusTarget } from './confirm-delete';
import { EmptyPanel } from './empty-panel';
import { refreshInboxCount, useInboxCount } from './inbox-count';
import { useInvalidFields } from './invalid-fields';
import { ItemDialog } from './item-dialog';
import { KeyLegend } from './key-legend';
import { tabCountClass } from './library/library-tabs';
import { NoteDialog, type NoteDraft } from './library/note-dialog';
import { useItemIndex } from './library/use-item-index';
import { OpportunityDialog } from './opportunity-dialog';
import { MenuSingleKey, RowMenu, lastRowMenuTrigger } from './row-menu';
import { SaveKeys } from './save-keys';

const PAGE = 100;
/** A Cmd+K deep link pages through at most this many pages of a tab to find its entry. */
const FOCUS_MAX_PAGES = 10;
/** The region the status tabs switch: the entries of the selected status (lib/tab-panel.ts). */
const STATUS_PANEL = 'inbox-entries';

function titleOf(e: ApiInboxEntry, t: T): string {
  return e.ogTitle || e.url || (e.text ?? '').split('\n')[0].slice(0, 140) || t('Mục #{id}', { id: e.id });
}

/** A capture is a URL when the whole box is one http(s) link, otherwise text (API_CONTRACT.md). */
function captureBody(value: string): { url: string } | { text: string } {
  const v = value.trim();
  return /^https?:\/\/\S+$/i.test(v) ? { url: v } : { text: v };
}

/** A note started from an inbox entry: its link and summary (or the captured text), linked to its Item. */
function noteDraftOf(e: ApiInboxEntry, t: T): NoteDraft {
  const about = e.summary || e.ogDescription;
  return {
    title: titleOf(e, t).slice(0, 300),
    markdown: [e.url, about, e.url ? '' : e.text].filter(Boolean).join('\n\n') + '\n\n',
    items: e.item ? [e.item] : [],
  };
}

/**
 * Key hint on a row's visible verbs: hidden on touch screens and at phone width (DESIGN.md D24), and drawn only while
 * single-key shortcuts are on (the card's `keys`).
 */
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
  const t = useT();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = useInvalidFields();

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    invalid.clear();
    try {
      onCaptured(await api.createInboxEntry(captureBody(value)));
      setValue('');
      void refreshInboxCount();
    } catch (err) {
      const e = toApiError(err);
      // a refused capture is about the one field (its link): marked, and the focus goes back to it
      setError(
        e.status === 400
          ? invalid.mark(t('Link không hợp lệ (chỉ nhận http và https).'), 'capture')
          : describeApiError(e, t).title,
      );
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
        {t('Thu thập nhanh')}
      </label>
      <Textarea
        id="capture"
        aria-required
        {...invalid.field('capture')}
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
        placeholder={t('Dán một link hoặc ghi một ý tưởng…')}
        rows={2}
      />
      {invalid.copies}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs text-muted-foreground max-sm:hidden pointer-coarse:hidden">
          <SaveKeys /> {t('để lưu')}
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
          {t('Lưu vào inbox')}
        </Button>
      </div>
    </form>
  );
}

function EntryCard({
  entry,
  linkedItem,
  selected,
  marked,
  keys,
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
  /** The keyboard cursor is on this card: it scrolls into view (a Cmd+K link to it too). */
  selected: boolean;
  /**
   * The card shows the cursor's mark (border, aria-current): the cursor while single-key shortcuts are on, since J/K
   * move it; while off, only the entry a Cmd+K link opened, until the list is used (InboxPage's `linkedId`).
   */
  marked: boolean;
  /** Single-key shortcuts are on: the verbs show their keys (and say them in their names). */
  keys: boolean;
  onSelect: () => void;
  onTriage: (status: ApiInboxStatus) => void;
  onOpportunity: () => void;
  onItem: () => void;
  onNote: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const site = entry.ogSiteName || hostOf(entry.url);
  // An LLM summary says so in words (DESIGN.md §4 "AI output", D18); og:description and captured text do not
  const autoSummary = !!entry.summary;
  const body = entry.summary || entry.ogDescription || (entry.ogTitle || entry.url ? '' : entry.text);
  // The suggestion helps triage: once the entry left the inbox the decision is made and the label goes
  const dest = entry.suggestedDestination;
  const suggestion = entry.status === 'inbox' && dest ? (destinations[dest] ? t(destinations[dest]) : dest) : null;
  const metaParts: React.ReactNode[] = [site, formatDate(entry.createdAt, t)].filter(Boolean);
  if (suggestion) metaParts.push(t('Gợi ý tự động: {destination}', { destination: suggestion }));
  if (entry.item)
    metaParts.push(
      <Link
        key="item"
        href={`/thu-vien/item/?id=${entry.item}`}
        title={t('Trang item: thuộc tính và mọi ghi chú')}
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
      selected={marked}
      onClick={onSelect}
      thumbnail={entry.thumbnailUrl}
      badges={
        // The status is the selected tab, so no status badge; only states the tab does not say (BADGE-1)
        !entry.processed && !entry.error ? (
          <Badge variant="secondary">
            <Loader2 className="animate-spin" aria-hidden />
            {t('Đang xử lý')}
          </Badge>
        ) : entry.error ? (
          <Badge variant="error">{t('Lỗi xử lý')}</Badge>
        ) : undefined
      }
      title={
        entry.url ? (
          <a href={entry.url} target="_blank" rel="noreferrer" className="hover:text-primary">
            {titleOf(entry, t)}
          </a>
        ) : (
          titleOf(entry, t)
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
        // Every card shows these verbs: each name says whose. It starts with all the button shows, its words and,
        // while single-key shortcuts are on, its key hint (WCAG 2.5.3: the visible label stays in the name), then
        // names the entry.
        <>
          {entry.status === 'inbox' && (
            <Button
              size="xs"
              variant="outline"
              aria-label={
                keys
                  ? t('Đọc sau, {key}: "{title}"', { key: 'L', title: titleOf(entry, t) })
                  : t('Đọc sau "{title}"', { title: titleOf(entry, t) })
              }
              onClick={() => onTriage('later')}
            >
              {t('Đọc sau')} {keys && <RowKey>L</RowKey>}
            </Button>
          )}
          {entry.status !== 'archived' && (
            <Button
              size="xs"
              variant="outline"
              aria-label={
                keys
                  ? t('Lưu trữ, {key}: "{title}"', { key: 'A', title: titleOf(entry, t) })
                  : t('Lưu trữ "{title}"', { title: titleOf(entry, t) })
              }
              onClick={() => onTriage('archived')}
            >
              {t('Lưu trữ', null, 'verb')} {keys && <RowKey>A</RowKey>}
            </Button>
          )}
          {entry.status !== 'inbox' && (
            <Button
              size="xs"
              variant="outline"
              aria-label={
                keys
                  ? t('Về inbox, {key}: "{title}"', { key: 'U', title: titleOf(entry, t) })
                  : t('Về inbox "{title}"', { title: titleOf(entry, t) })
              }
              onClick={() => onTriage('inbox')}
            >
              {t('Về inbox')} {keys && <RowKey>U</RowKey>}
            </Button>
          )}
          {entry.url ? (
            <Button
              size="xs"
              variant="ghost"
              aria-label={
                keys
                  ? t('Mở, {key}: "{title}"', { key: 'I', title: titleOf(entry, t) })
                  : t('Mở "{title}"', { title: titleOf(entry, t) })
              }
              render={<a href={entry.url} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink aria-hidden />
              {t('Mở')} {keys && <RowKey>I</RowKey>}
            </Button>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              aria-label={
                keys
                  ? t('Ghi chú, {key}: "{title}"', { key: 'N', title: titleOf(entry, t) })
                  : t('Ghi chú về "{title}"', { title: titleOf(entry, t) })
              }
              onClick={onNote}
            >
              <NotebookPen aria-hidden />
              {t('Ghi chú')} {keys && <RowKey>N</RowKey>}
            </Button>
          )}
          <span className="ms-auto">
            <RowMenu label={t('Thao tác cho "{title}"', { title: titleOf(entry, t) })}>
              <MenuItem onClick={onOpportunity}>
                <Lightbulb aria-hidden />
                {t('Bằng chứng cho cơ hội')}
                <MenuSingleKey>O</MenuSingleKey>
              </MenuItem>
              {!entry.item && (
                <MenuItem onClick={onItem}>
                  <Plus aria-hidden />
                  {t('Thành item')}
                  <MenuSingleKey>T</MenuSingleKey>
                </MenuItem>
              )}
              {entry.url && (
                <MenuItem onClick={onNote}>
                  <NotebookPen aria-hidden />
                  {t('Ghi chú')}
                  <MenuSingleKey>N</MenuSingleKey>
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem variant="destructive" onClick={onDelete}>
                <Trash2 aria-hidden />
                {t('Xóa')}
                <MenuSingleKey>Del</MenuSingleKey>
              </MenuItem>
            </RowMenu>
          </span>
        </>
      }
    >
      {body && (
        <p className="line-clamp-3 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-line">
          {autoSummary && <span className="font-medium">{t('Tóm tắt tự động:')} </span>}
          {body}
        </p>
      )}
      {entry.suggestedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.suggestedTags.map((tag) => (
            <Badge key={tag} variant="outline">
              #{tag}
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground">{t('tự động')}</span>
        </div>
      )}
    </BrainCard>
  );
}

const keyHelp: [string, Msg][] = [
  ['J / K', msg('xuống / lên')],
  ['L', msg('đọc sau')],
  ['A', msg('lưu trữ')],
  ['U', msg('về inbox')],
  ['O', msg('bằng chứng cho cơ hội')],
  ['T', msg('thành item')],
  ['N', msg('ghi chú')],
  ['I', msg('mở link')],
  ['Del', msg('xóa')],
  ['C', msg('thu thập')],
  ['?', msg('bảng phím tắt này')],
];

/** Inbox (DECISIONS 9.2): capture, OG cards, keyboard triage with one key per decision. */
export function InboxPage() {
  const t = useT();
  const [status, setStatus] = useState<ApiInboxStatus>('inbox');
  const [cursor, setCursor] = useState(0);
  // The entry a Cmd+K link opened (?id=): while single-key shortcuts are off the cursor shows no mark (no key moves
  // it), so this entry keeps the mark instead, or nothing would say which card the link meant. Any move of the cursor
  // (a click on a card, a tab, a capture, J/K) ends it.
  const [linkedId, setLinkedId] = useState<number | null>(null);
  const moveCursor = useCallback((i: number) => {
    setCursor(i);
    setLinkedId(null);
  }, []);
  const [pickFor, setPickFor] = useState<ApiInboxEntry | null>(null);
  // The opportunity picker archives the entry it was opened for: what held the focus as it opened (a row menu's item:
  // that menu's trigger), and, after a pick, the card's neighbours (attach), for the focus once it has closed
  const pickOrigin = useRef<HTMLElement | null>(null);
  const afterPick = useRef<HTMLElement[] | null>(null);
  useLayoutEffect(() => {
    if (pickFor === null) return;
    const active = document.activeElement;
    pickOrigin.current =
      !(active instanceof HTMLElement) || active === document.body
        ? null
        : active.closest('[role="menu"]')
          ? lastRowMenuTrigger()
          : active;
  }, [pickFor]);
  // Base UI gives the focus back to what opened the picker; when a pick took that away with its card, the card's
  // neighbour takes it (after React's commit), as after a delete
  const pickFinalFocus = () => {
    const near = afterPick.current;
    afterPick.current = null;
    if (!near || pickOrigin.current?.isConnected) return true;
    queueMicrotask(() => {
      const active = document.activeElement;
      const placed =
        active instanceof HTMLElement &&
        active !== document.body &&
        active.isConnected &&
        !active.closest('[role="dialog"]');
      if (!placed) focusTarget(near)?.focus();
    });
    return false;
  };
  const [itemFor, setItemFor] = useState<ApiInboxEntry | null>(null);
  const [noteFor, setNoteFor] = useState<ApiInboxEntry | null>(null);
  const [deleteFor, setDeleteFor] = useState<ApiInboxEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const captureRef = useRef<HTMLTextAreaElement>(null);
  const inboxKey = `inbox:${status}`;
  const inbox = useApi<Page<ApiInboxEntry>>(inboxKey, () => api.listInbox({ status, limit: PAGE }));
  // A reload of the same tab (a return to the browser tab) keeps the cards on screen, and the focus in them, as Thư
  // viện does: a skeleton would unmount every card and drop the focus to <body> (WCAG 2.4.3). Another tab starts from
  // the skeleton, never with this one's cards.
  const shown = inbox.dataKey === inboxKey ? (inbox.data?.results ?? []) : [];
  const inboxCount = useInboxCount();
  // Whether the cards show their keys (and the notices name A): one subscription for the whole list
  const keys = useSingleKeyShortcuts();

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
      setLinkedId(null);
    },
    ['status'],
  );
  const nextUrl = inbox.data?.next ?? null;
  const seeking = focusId !== null && !inbox.loading && inbox.dataKey === inboxKey;
  const focusAt = seeking ? shown.findIndex((e) => e.id === focusId) : -1;
  const pageForFocus = seeking && focusAt < 0 && !inbox.error && nextUrl !== null && focusPages < FOCUS_MAX_PAGES;
  if (seeking && !pageForFocus) {
    setFocusId(null);
    if (focusAt >= 0) {
      setCursor(focusAt);
      setLinkedId(focusId);
    } else if (!inbox.error)
      setNotice(
        nextUrl
          ? t('Không thấy mục này trong {max} mục mới nhất của tab: bấm "Tải thêm" để xem tiếp.', {
              max: t.count(FOCUS_MAX_PAGES * PAGE),
            })
          : t('Không thấy mục này: có thể đã bị xóa hoặc đổi trạng thái.'),
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
        setNotice(describeApiError(toApiError(err), t).title);
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

  /**
   * "Thành item": the Item was created in the dialog; link the entry to it, status unchanged. `imageError` says why the
   * picture chosen in the dialog was not saved (the Item was), so the notice never reads as a full success.
   */
  const linkItem = useCallback(
    async (entry: ApiInboxEntry, item: ApiItem, imageError?: string) => {
      setItemFor(null);
      putItem(item);
      replace({ ...entry, item: item.id, itemTitle: item.title, itemType: item.type });
      const picture = imageError ? ` ${t('Chưa lưu được ảnh: {error}.', { error: imageError })}` : '';
      try {
        replace(await linkInboxItem(entry.id, item.id));
        setNotice(
          keys
            ? t('Đã thêm "{title}" vào thư viện và liên kết mục inbox.{picture} Nhấn A để lưu trữ mục.', {
                title: item.title,
                picture,
              })
            : t('Đã thêm "{title}" vào thư viện và liên kết mục inbox.{picture}', { title: item.title, picture }),
        );
      } catch (err) {
        setNotice(
          t('Đã thêm "{title}" nhưng chưa liên kết được: {reason}.{picture}', {
            title: item.title,
            reason: describeApiError(toApiError(err), t).title,
            picture,
          }),
        );
        reload();
      }
    },
    [putItem, replace, reload, t, keys],
  );

  /**
   * Takes an entry's card out of the list. A focus inside it (its own "Đọc sau", "Lưu trữ" or "Về inbox", a key
   * pressed on one of its controls) goes to the next card's first control, else the previous one's, else the page's
   * heading, never to <body> (WCAG 2.4.3; DESIGN.md §6 "Focus after a delete", the same neighbours).
   */
  const remove = useCallback(
    (id: number) => {
      const card = document.getElementById(`inbox-entry-${id}`);
      const near = card?.contains(document.activeElement) ? focusCandidates(card) : null;
      const drop = () => mutate((d) => d && { ...d, results: d.results.filter((e) => e.id !== id) });
      if (!near) return drop();
      flushSync(drop);
      focusTarget(near)?.focus();
    },
    [mutate],
  );

  const triage = useCallback(
    async (entry: ApiInboxEntry, next: ApiInboxStatus) => {
      if (entry.status === next) return;
      remove(entry.id);
      setHandled(true);
      try {
        await api.triageInboxEntry(entry.id, { status: next });
        setNotice(`"${titleOf(entry, t)}" → ${t(inboxStatusOf(next).label)}`);
      } catch (err) {
        setNotice(describeApiError(toApiError(err), t).title);
        reload();
      }
      void refreshInboxCount();
    },
    [reload, remove, t],
  );

  const attach = useCallback(
    async (entry: ApiInboxEntry, opp: ApiOpportunity, stance: ApiStance) => {
      // The card leaves as the picker closes, and the control that opened the picker may go with it: its neighbours,
      // read while it is still there, for the picker's finalFocus
      afterPick.current = focusCandidates(document.getElementById(`inbox-entry-${entry.id}`));
      setPickFor(null);
      remove(entry.id);
      setHandled(true);
      try {
        const res = await api.attachInboxEvidence(opp.id, { inboxEntry: entry.id, stance, archive: true });
        setNotice(
          res.created
            ? t('Đã thêm làm bằng chứng cho "{title}", mục đã lưu trữ', { title: opp.title })
            : t('Đã có sẵn làm bằng chứng cho "{title}", mục đã lưu trữ', { title: opp.title }),
        );
      } catch (err) {
        setNotice(describeApiError(toApiError(err), t).title);
        reload();
      }
      void refreshInboxCount();
    },
    [reload, remove, t],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen || !singleKeyShortcut(e)) return;
      // The key legend dialog and a row's overflow menu handle their own keys
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      const k = e.key.toLowerCase();
      // J/K move no focus: a key that opens a dialog for the cursor's entry while nothing holds the focus first gives
      // it to the entry's control for that key, else to its menu, so the dialog gives it back there (WCAG 2.4.3)
      const opening = (entry: ApiInboxEntry, open: (entry: ApiInboxEntry) => void) => () => {
        const row = document.getElementById(`inbox-entry-${entry.id}`);
        if (row) focusShortcutOpener(k, row, row.querySelector<HTMLElement>('[aria-haspopup="menu"]'));
        open(entry);
      };
      const act: Record<string, () => void> = {
        j: () => moveCursor(Math.min(selected + 1, shown.length - 1)),
        arrowdown: () => moveCursor(Math.min(selected + 1, shown.length - 1)),
        k: () => moveCursor(Math.max(selected - 1, 0)),
        arrowup: () => moveCursor(Math.max(selected - 1, 0)),
        c: () => captureRef.current?.focus(),
        ...(current && {
          l: () => void triage(current, 'later'),
          a: () => void triage(current, 'archived'),
          u: () => void triage(current, 'inbox'),
          o: opening(current, setPickFor),
          t: () => !current.item && opening(current, setItemFor)(),
          n: opening(current, setNoteFor),
          i: () => current.url && window.open(current.url, '_blank', 'noopener'),
          // Del / Backspace delete, as on the week page (X there means "bỏ" an objective)
          delete: opening(current, setDeleteFor),
          backspace: opening(current, setDeleteFor),
        }),
      };
      const run = act[k];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, selected, shown.length, current, triage, moveCursor]);

  const loadMore = async () => {
    const next = inbox.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(inbox);
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
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
          moveCursor(0);
          setNotice(t('Đã lưu vào inbox'));
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as ApiInboxStatus);
            moveCursor(0);
          }}
        >
          <TabsList aria-label={t('Trạng thái')}>
            {inboxStatuses.map((s) => (
              <TabsTab key={s.value} value={s.value} {...tabProps(STATUS_PANEL, s.value)}>
                {t(s.label)}
                {/* The backlog as plain muted text, like the Thư viện tabs (the top bar's badge says the same) */}
                {s.value === 'inbox' && inboxCount !== null && (
                  <span className={tabCountClass(status === 'inbox')}>{inboxCount}</span>
                )}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
        {/* First run: no entry for a key to act on yet */}
        {!firstRun && (
          <div className="ms-auto">
            <KeyLegend
              keys={keyHelp.map(([k, label]): [string, string] => [k, t(label)])}
              title={t('Phím tắt của Inbox')}
            />
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground empty:sr-only" role="status">
        {notice}
      </p>

      {/* The status tabs' panel (lib/tab-panel.ts); the page's own gap inside */}
      <div {...tabPanelProps(STATUS_PANEL, status)} className="flex flex-col gap-6">
        <ApiStaleAlert result={inbox} />
        {inbox.error && !inbox.data ? (
          <ApiErrorState error={inbox.error} onRetry={inbox.reload} />
        ) : inbox.loading && shown.length === 0 ? (
          <LoadingCards />
        ) : firstRun ? (
          <EmptyPanel
            glyph={Inbox}
            title={t('Chưa có mục nào trong Inbox')}
            text={t(
              'Dán một link hoặc ghi một ý tưởng vào ô ở trên; mỗi mục sẽ hiện ở đây thành một thẻ để xử lý bằng phím.',
            )}
          />
        ) : shown.length === 0 ? (
          // Cleared, or a tab with nothing in it: one line, no action (DESIGN.md §9a). Blank while the counts answer.
          status !== 'inbox' ? (
            <p className="text-sm text-muted-foreground">
              {t('Không có mục nào ở “{status}”.', { status: t(inboxStatusOf(status).label) })}
            </p>
          ) : handled || (elsewhere.data !== undefined && !elsewhere.loading) || elsewhere.error ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t('Đã xử lý hết.')}</span> {t('Mục mới sẽ hiện ở đây.')}
            </p>
          ) : null
        ) : (
          <div className="flex flex-col gap-3">
            {/* The cards' titles are h3: the tab's name heads them, so the outline does not jump from the h1 */}
            <h2 className="sr-only">{t(inboxStatusOf(status).label)}</h2>
            {shown.map((e, i) => (
              <EntryCard
                key={e.id}
                entry={e}
                selected={i === selected}
                marked={keys ? i === selected : e.id === linkedId}
                keys={keys}
                onSelect={() => moveCursor(i)}
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
                {t('Tải thêm')}
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmDelete
        open={deleteFor !== null}
        onOpenChange={(o) => !o && setDeleteFor(null)}
        title={t('Xóa mục inbox?')}
        description={
          deleteFor
            ? t(
                '"{title}" bị xóa hẳn, kể cả ảnh thu nhỏ. Item và ghi chú đã tạo từ mục này vẫn giữ nguyên. Không hoàn tác được.',
                { title: titleOf(deleteFor, t) },
              )
            : undefined
        }
        action={() => (deleteFor ? api.deleteInboxEntry(deleteFor.id) : Promise.resolve())}
        onDeleted={() => {
          if (!deleteFor) return;
          remove(deleteFor.id);
          setHandled(true);
          setNotice(t('Đã xóa "{title}"', { title: titleOf(deleteFor, t) }));
          void refreshInboxCount();
        }}
      />

      <OpportunityDialog
        open={pickFor !== null}
        finalFocus={pickFinalFocus}
        onOpenChange={(o) => !o && setPickFor(null)}
        entryTitle={pickFor ? titleOf(pickFor, t) : ''}
        onPick={(opp, stance) => pickFor && void attach(pickFor, opp, stance)}
      />

      <ItemDialog
        open={itemFor !== null}
        item={null}
        draft={itemFor ? itemDraftFromEntry(itemFor, titleOf(itemFor, t)) : undefined}
        onOpenChange={(o) => !o && setItemFor(null)}
        onSaved={(item, _created, imageError) => itemFor && void linkItem(itemFor, item, imageError)}
      />

      <NoteDialog
        open={noteFor !== null}
        note={null}
        draft={noteFor ? noteDraftOf(noteFor, t) : undefined}
        description={noteFor ? t('Từ inbox: {title}', { title: titleOf(noteFor, t) }) : undefined}
        items={index.items}
        byId={index.byId}
        itemsStatus={index.loading && index.items.length === 0 ? t('Đang tải danh sách item…') : undefined}
        onOpenChange={(o) => !o && setNoteFor(null)}
        onSaved={(note) => {
          setNoteFor(null);
          setNotice(
            keys
              ? t('Đã tạo ghi chú "{title}". Nhấn A để lưu trữ mục inbox.', { title: noteTitle(note, t) })
              : t('Đã tạo ghi chú "{title}".', { title: noteTitle(note, t) }),
          );
        }}
      />
    </div>
  );
}
