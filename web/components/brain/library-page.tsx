'use client';
import { useMemo, useRef, useState } from 'react';
import { BookPlus, Loader2, Plus } from 'lucide-react';
import {
  api,
  type ApiItem,
  type ApiItemRequest,
  type ApiItemStatus,
  type ApiItemType,
  type Page,
} from '@/lib/api/client';
import { loadAllPages } from '@/lib/api/pages';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { itemStatusOf, itemStatuses, itemTypes } from '@/lib/labels';
import { itemPicture } from '@/lib/handbook-picture';
import { useProgress } from '@/lib/progress';
import { ITEM_BOARD, laneOf } from '@/lib/status-board';
import { useBoardView } from '@/lib/use-board-view';
import { useRememberedFlag } from '@/lib/use-remembered-flag';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { tabPanelProps } from '@/lib/tab-panel';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { msg } from '@/lib/i18n/translate';
import { Button } from '@/components/ui/button';
import { ApiErrorState, ApiStaleAlert, describeApiError, openError } from './api-state';
import { ChoiceSelect } from './choice-select';
import { EmptyPanel, useToolbarState } from './empty-panel';
import { ItemDialog } from './item-dialog';
import { PAGE_WIDTH } from './layout';
import { handbooks, importHandbooks } from './library/handbook-import';
import { boardMedia } from './library/item-image';
import { ItemCardBody, ItemMenuItems, ItemRow, itemListGrid } from './library/item-parts';
import { ItemSheet } from './library/item-sheet';
import { FilteredEmpty, RowsSkeleton } from './library/list-rows';
import { BoardSkeleton, BoardStatus, StatusBoard, recordFocusTarget, useStatusMoves } from './status-board';
import { ViewSwitch } from './view-switch';

type TypeFilter = ApiItemType | 'all';
type StatusFilter = ApiItemStatus | 'all';

const typeChoices = [{ value: 'all' as const, label: msg('Mọi loại') }, ...itemTypes];
const statusChoices = [{ value: 'all' as const, label: msg('Mọi trạng thái') }, ...itemStatuses];

/** The region the view switch changes (lib/tab-panel.ts). */
const VIEW_PANEL = 'items-view';

/** Every Item of one type (all cursor pages, at most 20 of 100), newest first: one list for both views. */
const loadItems = (type: TypeFilter) => () =>
  loadAllPages<ApiItem>(
    () => api.listItems({ limit: 100, ...(type !== 'all' && { type }) }),
    (next) => api.page<ApiItem>(next),
  );

/**
 * Thư viện: Items in two views like Dự án: Danh sách (rows, filterable by type and status) and Bảng (one lane per
 * status; dragging a card or its menu changes the status). Both views show one list of every Item of the chosen type,
 * so a change in one is in the other without a reload. A row or a card's title opens the Item page in a Sheet beside
 * the list (DECISIONS 9.8: properties, every note written and edited in place); create, and edit from the menu,
 * through ItemDialog (POST/PATCH /api/items).
 */
export function LibraryPage() {
  const t = useT();
  // Before useOpenFromUrl: a remembered board waits until ?item= is gone, so the two URL updates never collide.
  const [view, setView] = useBoardView(ITEM_BOARD.viewKey, 'item');
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<ApiItem | null>(null);
  const [draft, setDraft] = useState<Partial<ApiItemRequest> | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusRating, setFocusRating] = useState(false);
  // The Item shown in the Sheet (kept while it animates out); `compose`: opened from "Viết ghi chú"
  const [sheet, setSheet] = useState<{ item: ApiItem; compose: boolean } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Lesson progress picks each course's status; the button waits for it (`loaded`), or every book would be "Dự định"
  const { done, loaded } = useProgress();
  // "Thêm N khóa học từ Sổ tay": sent/total while it runs; the ref stops a second click before the re-render
  const [importing, setImporting] = useState<{ sent: number; total: number } | null>(null);
  const importLock = useRef(false);
  // The Item whose dialog or Sheet is open or was just saved: its card or row takes the focus back when it closes, even
  // when the control that opened it is gone ("Viết ghi chú" once the note exists, a card moved to another lane).
  const returnTo = useRef<number | null>(null);
  const finalFocus = () => recordFocusTarget(returnTo.current) ?? null;

  const key = `items:all:${type}`;
  const items = useApi<Page<ApiItem>>(key, loadItems(type));
  const moves = useStatusMoves(items, ITEM_BOARD, (id, to) => api.updateItem(id, { status: to }));
  // The rows of another type never show under this one; a reload of the same type (a return to the tab) keeps the
  // rows and the board on screen instead of blanking them.
  const ready = items.dataKey === key && items.data !== undefined;
  const all = useMemo(() => (items.dataKey === key ? (items.data?.results ?? []) : []), [items.dataKey, items.data, key]);
  const list = useMemo(() => (status === 'all' ? all : all.filter((i) => laneOf(i) === status)), [all, status]);
  // the List's picture track only when a shown row has a picture, like Dự án's hours legend (anyMinutes)
  const withPicture = useMemo(() => list.some((i) => itemPicture(i) !== null), [list]);
  // the loading skeleton takes the picture geometry the library had last time (D27), so nothing jumps on arrival
  const anyPicture = useMemo(() => (ready ? all.some((i) => itemPicture(i) !== null) : null), [ready, all]);
  const skeletonPictures = useRememberedFlag('alex-brain:library-pictures', anyPicture);
  // The filter choices in the page's language (the Select keeps the same lists between renders)
  const typeOptions = useMemo(() => typeChoices.map((c) => ({ value: c.value, label: t(c.label) })), [t]);
  const statusOptions = useMemo(() => statusChoices.map((c) => ({ value: c.value, label: t(c.label) })), [t]);

  const openEdit = (item: ApiItem, rating = false) => {
    returnTo.current = item.id;
    setEditing(item);
    setFocusRating(rating);
    setDialogOpen(true);
  };
  /** The Item page beside the list; `compose` opens it on a new note (prefilled with the type's template). */
  const openSheet = (item: ApiItem, compose = false) => {
    returnTo.current = item.id;
    setSheet({ item, compose });
    setSheetOpen(true);
  };
  const writeNote = (item: ApiItem) => openSheet(item, true);
  /** A new Item, prefilled with the chosen type (and a lane's status). */
  const openNew = (initial?: Partial<ApiItemRequest>) => {
    returnTo.current = null;
    setEditing(null);
    setDraft({ ...(type !== 'all' && { type }), ...initial });
    setFocusRating(false);
    setDialogOpen(true);
  };

  // ?item=N (Cmd+K result): open that Item's page in the Sheet (one GET /api/items/{id}, not the whole library).
  useOpenFromUrl('item', (id) => {
    api.getItem(id).then(
      (item) => openSheet(item),
      (err: unknown) =>
        setNotice(openError(err, t('Không tìm thấy item #{id}, có thể đã bị xóa.', { id }), t)),
    );
  });

  /** The shared list holds one type (or all); the status filter of the List view applies when it renders. */
  const ofType = (i: ApiItem) => type === 'all' || i.type === type;

  const upsert = (saved: ApiItem, created: boolean) =>
    items.mutate((d) => {
      if (!d) return d;
      const rest = d.results.filter((i) => i.id !== saved.id);
      if (!ofType(saved)) return { ...d, results: rest };
      return {
        ...d,
        results: created ? [saved, ...rest] : d.results.map((i) => (i.id === saved.id ? saved : i)),
      };
    });

  const removeItem = (id: number) =>
    items.mutate((d) => d && { ...d, results: d.results.filter((i) => i.id !== id) });

  /** A change made in the Sheet (status, properties, a note written or deleted): the list and the board follow. */
  const sheetChanged = (saved: ApiItem) => {
    if (sheet && sheet.item.status !== saved.status) moves.bump(saved.id);
    setSheet((s) => s && { ...s, item: saved });
    upsert(saved, false);
  };

  const step = async (item: ApiItem, to: ApiItemStatus) => {
    try {
      upsert(await api.updateItem(item.id, { status: to }), false);
      setNotice(`"${item.title}" → ${t(itemStatusOf(to, item.type).label)}`);
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
    }
  };

  const loadMore = async () => {
    if (!items.data?.next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(items);
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const addHandbooks = async () => {
    if (importLock.current || loaded === false) return;
    importLock.current = true;
    setImporting({ sent: 0, total: handbooks.length });
    try {
      const res = await importHandbooks(done, (sent, total) => setImporting({ sent, total }));
      // Handbooks already in the library mean the shown list was out of date: read it again
      if (res.skipped > 0) items.reload();
      else if (res.created.length > 0)
        items.mutate((d) => d && { ...d, results: [...res.created.filter(ofType), ...d.results] });
      const active = res.created.filter((i) => i.status === 'active').length;
      const parts = [
        res.created.length > 0 &&
          (active > 0
            ? t('Đã thêm {n} khóa học từ Sổ tay ({active} {status})', {
                n: res.created.length,
                active,
                status: t(itemStatusOf('active').label).toLowerCase(),
              })
            : t('Đã thêm {n} khóa học từ Sổ tay', { n: res.created.length })),
        res.skipped > 0 && t('{n} khóa đã có trong thư viện', { n: res.skipped }),
        res.error && t('dừng lại vì lỗi: {error}', { error: describeApiError(res.error, t).title }),
      ].filter(Boolean);
      setNotice(parts.length ? `${parts.join('; ')}.` : null);
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
    } finally {
      importLock.current = false;
      setImporting(null);
    }
  };

  // The status filter belongs to the List only (the board's lanes are the statuses); the type filter to both.
  const filtered = type !== 'all' || (view === 'list' && status !== 'all');
  const shown = view === 'list' ? list : all;
  const failed = !!items.error && !ready;
  // The toolbar waits for a first record or a filter (DESIGN.md §9a): an empty library shows only the empty panel,
  // whose "Thêm item" is the one primary (D2). The shared rule (empty-panel.tsx) reads the sidebar count meanwhile.
  const toolbar = useToolbarState({
    rows: all.length,
    filtered,
    loading: !ready,
    failed,
    count: 'items',
  });

  return (
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6 px-4 pb-12 sm:px-8')}>
      {/* Narrower than one row (36rem of toolbar: at 390 px, and beside the sidebar at 768-840 px): the view switch
          and "Thêm item" keep the first row, the filters share the second, never an orphaned button (DESIGN.md §6). */}
      {toolbar !== 'hide' && (
        <div className={cn('@container', toolbar === 'wait' && 'invisible')}>
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitch view={view} onChange={setView} panel={VIEW_PANEL} />
            <div
              className={cn(
                'order-last grid w-full gap-2 @xl:order-none @xl:flex @xl:w-auto @xl:items-center',
                view === 'list' && 'grid-cols-2',
              )}
            >
              <ChoiceSelect
                label={t('Loại')}
                value={type}
                onChange={setType}
                choices={typeOptions}
                className="min-w-0 @xl:w-auto"
              />
              {view === 'list' && (
                <ChoiceSelect
                  label={t('Trạng thái')}
                  value={status}
                  onChange={setStatus}
                  choices={statusOptions}
                  className="min-w-0 @xl:w-auto"
                />
              )}
            </div>
            <Button className="ms-auto shrink-0" onClick={() => openNew()}>
              <Plus aria-hidden />
              {t('Thêm item')}
            </Button>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground empty:sr-only" role="status">
        {notice}
      </p>
      <BoardStatus moves={moves} />

      {/* The view switch's panel while the toolbar shows (lib/tab-panel.ts); the page's own gap inside */}
      <div {...(toolbar !== 'hide' && tabPanelProps(VIEW_PANEL, view))} className="flex flex-col gap-6">
        <ApiStaleAlert result={items} />
        {failed && items.error ? (
          <ApiErrorState error={items.error} onRetry={items.reload} />
        ) : !ready ? (
          view === 'board' ? (
            <BoardSkeleton media={skeletonPictures} />
          ) : (
            <RowsSkeleton picture={skeletonPictures} />
          )
        ) : shown.length === 0 && filtered ? (
          <FilteredEmpty
            onClear={() => {
              setType('all');
              setStatus('all');
            }}
          >
            {t('Không có mục nào khớp bộ lọc.')}
          </FilteredEmpty>
        ) : all.length === 0 ? (
          <EmptyPanel
            glyph={BookPlus}
            title={t('Chưa có item nào')}
            text={t('Thêm sách, phim, khóa học, bài viết hoặc dự án; mục từ inbox cũng có thể thành item.')}
            action={
              <Button onClick={() => openNew()}>
                <Plus aria-hidden />
                {t('Thêm item')}
              </Button>
            }
            quick={
              // Built from the owner's own content: offered only once a handbook is imported
              handbooks.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void addHandbooks()}
                  disabled={importing !== null || loaded === false}
                >
                  {importing ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus aria-hidden />}
                  {importing
                    ? t('Đang thêm {sent}/{n} khóa học…', { sent: importing.sent, n: importing.total })
                    : t('Thêm {n} khóa học từ Sổ tay', { n: handbooks.length })}
                </Button>
              )
            }
            guide={items.error ? undefined : 'library'}
          />
        ) : view === 'board' ? (
          <StatusBoard
            kind={ITEM_BOARD}
            records={all}
            moves={moves}
            onOpen={(item) => openSheet(item)}
            onAdd={(lane) => openNew({ status: lane })}
            renderBody={(item) => (
              <ItemCardBody
                item={item}
                showType={type === 'all'}
                onWriteNote={() => writeNote(item)}
                onRate={() => openEdit(item, true)}
              />
            )}
            renderMenu={(item) => (
              <ItemMenuItems
                item={item}
                onEdit={() => openEdit(item)}
                onWriteNote={() => writeNote(item)}
                onRate={() => openEdit(item, true)}
              />
            )}
            renderMedia={(item) => boardMedia(itemPicture(item), t)}
          />
        ) : (
          // One container, rows on a shared subgrid so status, rating and actions line up (DESIGN.md §3 Columns)
          <ul
            aria-label={t('Item', null, 'nav')}
            className={cn('grid gap-x-3 divide-y overflow-hidden rounded-xl border bg-card', itemListGrid(withPicture))}
          >
            {list.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                withPicture={withPicture}
                onOpen={() => openSheet(item)}
                onEdit={() => openEdit(item)}
                onRate={() => openEdit(item, true)}
                onStep={(to) => void step(item, to)}
                onWriteNote={() => writeNote(item)}
              />
            ))}
          </ul>
        )}
        {/* Only past the 20-page cap of loadItems */}
        {ready && items.data?.next && (
          <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
            {t('Tải thêm')}
          </Button>
        )}
      </div>

      <ItemDialog
        open={dialogOpen}
        item={editing}
        draft={draft}
        focusRating={focusRating}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setFocusRating(false);
        }}
        onSaved={(saved, created, imageError) => {
          returnTo.current = saved.id;
          upsert(saved, created);
          // a new Item, or one whose status changed, lands on top of its lane like a moved card
          if (created || editing?.status !== saved.status) moves.bump(saved.id);
          setDialogOpen(false);
          const vars = { title: saved.title, error: imageError ?? '' };
          setNotice(
            imageError
              ? created
                ? t('Đã thêm "{title}", nhưng chưa lưu được ảnh: {error}.', vars)
                : t('Đã lưu "{title}", nhưng chưa lưu được ảnh: {error}.', vars)
              : created
                ? t('Đã thêm "{title}"', vars)
                : t('Đã lưu "{title}"', vars),
          );
        }}
        onDeleted={(deleted) => {
          removeItem(deleted.id);
          setDialogOpen(false);
          setEditing(null);
          setNotice(t('Đã xóa "{title}"', { title: deleted.title }));
        }}
        onWriteNote={(item) => {
          setDialogOpen(false);
          writeNote(item);
        }}
        finalFocus={finalFocus}
      />

      <ItemSheet
        item={sheet?.item ?? null}
        open={sheetOpen}
        compose={sheet?.compose ?? false}
        onOpenChange={setSheetOpen}
        finalFocus={finalFocus}
        onItemChange={sheetChanged}
        onOtherCounts={(ids, delta) =>
          items.mutate(
            (d) =>
              d && {
                ...d,
                results: d.results.map((i) =>
                  ids.includes(i.id) ? { ...i, noteCount: Math.max(0, i.noteCount + delta) } : i,
                ),
              },
          )
        }
        onDeleted={(deleted) => {
          removeItem(deleted.id);
          setSheetOpen(false);
          returnTo.current = null;
          setNotice(t('Đã xóa "{title}"', { title: deleted.title }));
        }}
      />
    </div>
  );
}
