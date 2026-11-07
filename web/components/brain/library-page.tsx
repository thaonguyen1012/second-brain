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
import type { ApiNote } from '@/lib/api/library';
import { loadAllPages } from '@/lib/api/pages';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { itemStatusOf, itemStatuses, itemTypes } from '@/lib/labels';
import { noteTitle } from '@/lib/library-labels';
import { useProgress } from '@/lib/progress';
import { ITEM_BOARD, laneOf } from '@/lib/status-board';
import { useBoardView } from '@/lib/use-board-view';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ApiErrorState, ApiStaleAlert, describeApiError, openError } from './api-state';
import { ChoiceSelect } from './choice-select';
import { EmptyPanel, useToolbarState } from './empty-panel';
import { ItemDialog } from './item-dialog';
import { PAGE_WIDTH } from './layout';
import { noteDraftForItem } from './library/done-output';
import { handbooks, importHandbooks } from './library/handbook-import';
import { ItemCardBody, ItemMenuItems, ItemRow } from './library/item-parts';
import { FilteredEmpty, RowsSkeleton } from './library/list-rows';
import { NoteDialog } from './library/note-dialog';
import { useItemIndex } from './library/use-item-index';
import { BoardSkeleton, BoardStatus, StatusBoard, useStatusMoves } from './status-board';
import { ViewSwitch } from './view-switch';

type TypeFilter = ApiItemType | 'all';
type StatusFilter = ApiItemStatus | 'all';

const typeChoices = [{ value: 'all' as const, label: 'Mọi loại' }, ...itemTypes];
const statusChoices = [{ value: 'all' as const, label: 'Mọi trạng thái' }, ...itemStatuses];

/** Every Item of one type (all cursor pages, at most 20 of 100), newest first: one list for both views. */
const loadItems = (type: TypeFilter) => () =>
  loadAllPages<ApiItem>(
    () => api.listItems({ limit: 100, ...(type !== 'all' && { type }) }),
    (next) => api.page<ApiItem>(next),
  );

/**
 * Thư viện: Items in two views like Dự án: Danh sách (rows, filterable by type and status) and Bảng (one lane per
 * status; dragging a card or its menu changes the status). Both views show one list of every Item of the chosen type,
 * so a change in one is in the other without a reload. Create and edit through ItemDialog (POST/PATCH /api/items).
 */
export function LibraryPage() {
  // Before useOpenFromUrl: a remembered board waits until ?item= is gone, so the two URL updates never collide.
  const [view, setView] = useBoardView(ITEM_BOARD.viewKey, 'item');
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<ApiItem | null>(null);
  const [draft, setDraft] = useState<Partial<ApiItemRequest> | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusRating, setFocusRating] = useState(false);
  const [noteFor, setNoteFor] = useState<ApiItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The full Item list is only for the note dialog's item picker.
  const index = useItemIndex(noteFor !== null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Lesson progress picks each course's status; the button waits for it (`loaded`), or every book would be "Dự định"
  const { done, loaded } = useProgress();
  // "Thêm 15 khóa học từ Sổ tay": sent/total while it runs; the ref stops a second click before the re-render
  const [importing, setImporting] = useState<{ sent: number; total: number } | null>(null);
  const importLock = useRef(false);

  const key = `items:all:${type}`;
  const items = useApi<Page<ApiItem>>(key, loadItems(type));
  const moves = useStatusMoves(items, ITEM_BOARD, (id, to) => api.updateItem(id, { status: to }));
  // The rows of another type never show under this one; a reload of the same type (a return to the tab) keeps the
  // rows and the board on screen instead of blanking them.
  const ready = items.dataKey === key && items.data !== undefined;
  const all = useMemo(() => (items.dataKey === key ? (items.data?.results ?? []) : []), [items.dataKey, items.data, key]);
  const list = useMemo(() => (status === 'all' ? all : all.filter((i) => laneOf(i) === status)), [all, status]);

  const openEdit = (item: ApiItem, rating = false) => {
    setEditing(item);
    setFocusRating(rating);
    setDialogOpen(true);
  };
  /** A new Item, prefilled with the chosen type (and a lane's status). */
  const openNew = (initial?: Partial<ApiItemRequest>) => {
    setEditing(null);
    setDraft({ ...(type !== 'all' && { type }), ...initial });
    setFocusRating(false);
    setDialogOpen(true);
  };

  // ?item=N (Cmd+K result): open that Item's dialog (one GET /api/items/{id}, not the whole library).
  useOpenFromUrl('item', (id) => {
    api.getItem(id).then(
      (item) => openEdit(item),
      (err: unknown) => setNotice(openError(err, `Không tìm thấy item #${id}, có thể đã bị xóa.`)),
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

  /** A new note linked to Items: their noteCount goes up here too, so the "chưa có đầu ra" hint goes away. */
  const noteCreated = (note: ApiNote) => {
    const bump = (i: ApiItem) => (note.items.includes(i.id) ? { ...i, noteCount: i.noteCount + 1 } : i);
    items.mutate((d) => d && { ...d, results: d.results.map(bump) });
    setEditing((e) => e && bump(e));
  };

  const step = async (item: ApiItem, to: ApiItemStatus) => {
    try {
      upsert(await api.updateItem(item.id, { status: to }), false);
      setNotice(`"${item.title}" → ${itemStatusOf(to).label}`);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    }
  };

  const loadMore = async () => {
    if (!items.data?.next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(items);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
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
          `Đã thêm ${res.created.length} khóa học từ Sổ tay` +
            (active > 0 ? ` (${active} ${itemStatusOf('active').label.toLowerCase()})` : ''),
        res.skipped > 0 && `${res.skipped} khóa đã có trong thư viện`,
        res.error && `dừng lại vì lỗi: ${describeApiError(res.error).title}`,
      ].filter(Boolean);
      setNotice(parts.length ? `${parts.join('; ')}.` : null);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
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
      {/* 390 px: the view switch and "Thêm item" keep the first row, the filters share the second (DESIGN.md §6) */}
      {toolbar !== 'hide' && (
        <div className={cn('flex flex-wrap items-center gap-2', toolbar === 'wait' && 'invisible')}>
          <ViewSwitch view={view} onChange={setView} />
          <div
            className={cn(
              'order-last grid w-full gap-2 sm:order-none sm:flex sm:w-auto sm:items-center',
              view === 'list' && 'grid-cols-2',
            )}
          >
            <ChoiceSelect label="Loại" value={type} onChange={setType} choices={typeChoices} className="min-w-0 sm:w-auto" />
            {view === 'list' && (
              <ChoiceSelect
                label="Trạng thái"
                value={status}
                onChange={setStatus}
                choices={statusChoices}
                className="min-w-0 sm:w-auto"
              />
            )}
          </div>
          <Button className="ms-auto shrink-0" onClick={() => openNew()}>
            <Plus aria-hidden />
            Thêm item
          </Button>
        </div>
      )}

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      <BoardStatus moves={moves} />

      <ApiStaleAlert result={items} />
      {failed && items.error ? (
        <ApiErrorState error={items.error} onRetry={items.reload} />
      ) : !ready ? (
        view === 'board' ? (
          <BoardSkeleton />
        ) : (
          <RowsSkeleton />
        )
      ) : shown.length === 0 && filtered ? (
        <FilteredEmpty
          onClear={() => {
            setType('all');
            setStatus('all');
          }}
        >
          Không có mục nào khớp bộ lọc.
        </FilteredEmpty>
      ) : all.length === 0 ? (
        <EmptyPanel
          glyph={BookPlus}
          title="Chưa có item nào"
          text="Thêm sách, phim, khóa học, bài viết hoặc dự án; mục từ inbox cũng có thể thành item."
          action={
            <Button onClick={() => openNew()}>
              <Plus aria-hidden />
              Thêm item
            </Button>
          }
          quick={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void addHandbooks()}
              disabled={importing !== null || loaded === false}
            >
              {importing ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Plus aria-hidden />}
              {importing
                ? `Đang thêm ${importing.sent}/${importing.total} khóa học…`
                : `Thêm ${handbooks.length} khóa học từ Sổ tay`}
            </Button>
          }
          guide={items.error ? undefined : 'library'}
        />
      ) : view === 'board' ? (
        <StatusBoard
          kind={ITEM_BOARD}
          records={all}
          moves={moves}
          onOpen={(item) => openEdit(item)}
          onAdd={(lane) => openNew({ status: lane })}
          renderBody={(item) => (
            <ItemCardBody
              item={item}
              showType={type === 'all'}
              onWriteNote={() => setNoteFor(item)}
              onRate={() => openEdit(item, true)}
            />
          )}
          renderMenu={(item) => (
            <ItemMenuItems
              item={item}
              onEdit={() => openEdit(item)}
              onWriteNote={() => setNoteFor(item)}
              onRate={() => openEdit(item, true)}
            />
          )}
        />
      ) : (
        // One container, rows on a shared subgrid so status, rating and actions line up (DESIGN.md §3 Columns)
        <ul
          aria-label="Item"
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 divide-y overflow-hidden rounded-xl border bg-card sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
        >
          {list.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onRate={() => openEdit(item, true)}
              onStep={(to) => void step(item, to)}
              onWriteNote={() => setNoteFor(item)}
            />
          ))}
        </ul>
      )}
      {/* Only past the 20-page cap of loadItems */}
      {ready && items.data?.next && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          Tải thêm
        </Button>
      )}

      <ItemDialog
        open={dialogOpen}
        item={editing}
        draft={draft}
        focusRating={focusRating}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setFocusRating(false);
        }}
        onSaved={(saved, created) => {
          upsert(saved, created);
          // a new Item, or one whose status changed, lands on top of its lane like a moved card
          if (created || editing?.status !== saved.status) moves.bump(saved.id);
          setDialogOpen(false);
          setNotice(created ? `Đã thêm "${saved.title}"` : `Đã lưu "${saved.title}"`);
        }}
        onDeleted={(deleted) => {
          removeItem(deleted.id);
          setDialogOpen(false);
          setEditing(null);
          setNotice(`Đã xóa "${deleted.title}"`);
        }}
        onWriteNote={(item) => {
          setDialogOpen(false);
          setNoteFor(item);
        }}
      />

      <NoteDialog
        open={noteFor !== null}
        note={null}
        draft={noteFor ? noteDraftForItem(noteFor) : undefined}
        description={noteFor ? `Đầu ra cho: ${noteFor.title}` : undefined}
        items={index.items}
        byId={noteFor && !index.byId.has(noteFor.id) ? new Map([...index.byId, [noteFor.id, noteFor]]) : index.byId}
        itemsStatus={index.loading && index.items.length === 0 ? 'Đang tải danh sách item…' : undefined}
        onOpenChange={(o) => !o && setNoteFor(null)}
        onSaved={(note) => {
          setNoteFor(null);
          noteCreated(note);
          setNotice(`Đã tạo ghi chú "${noteTitle(note)}"`);
        }}
      />
    </div>
  );
}
