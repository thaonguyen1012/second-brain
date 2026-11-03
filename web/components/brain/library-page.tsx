'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Library, NotebookPen, Pencil, Plus, Star } from 'lucide-react';
import { api, type ApiItem, type ApiItemStatus, type ApiItemType, type Page } from '@/lib/api/client';
import type { ApiNote } from '@/lib/api/library';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { formatDate, itemStatusOf, itemStatuses, itemTypeLabel, itemTypes } from '@/lib/labels';
import { noteTitle } from '@/lib/library-labels';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { Button } from '@/components/ui/button';
import { MenuItem, MenuLinkItem } from '@/components/ui/menu';
import { EmptyStateGuide } from '@/components/stageshow/lazy';
import { ApiErrorState, ApiStaleAlert, EmptyState, describeApiError, openError } from './api-state';
import { StatusBadge } from './brain-card';
import { ChoiceSelect } from './choice-select';
import { ItemDialog } from './item-dialog';
import { gapLabel, missingOutput, noteDraftForItem } from './library/done-output';
import { FilteredEmpty, RowsSkeleton, onRowClick } from './library/list-rows';
import { NoteDialog } from './library/note-dialog';
import { useItemIndex } from './library/use-item-index';
import { RowMenu } from './row-menu';

type TypeFilter = ApiItemType | 'all';
type StatusFilter = ApiItemStatus | 'all';

const typeChoices = [{ value: 'all' as const, label: 'Mọi loại' }, ...itemTypes];
const statusChoices = [{ value: 'all' as const, label: 'Mọi trạng thái' }, ...itemStatuses];

/** The one-click next step of the lifecycle (DECISIONS 4.2); "done" still needs a note to count. */
const nextStep: Partial<Record<ApiItemStatus, { to: ApiItemStatus; label: string }>> = {
  planned: { to: 'active', label: 'Bắt đầu' },
  active: { to: 'done', label: 'Xong' },
};

function ItemRow({
  item,
  onEdit,
  onStep,
  onWriteNote,
  onRate,
}: {
  item: ApiItem;
  onEdit: () => void;
  onStep: (to: ApiItemStatus) => void;
  onWriteNote: () => void;
  onRate: () => void;
}) {
  const s = itemStatusOf(item.status);
  const gap = missingOutput(item);
  const step = nextStep[item.status ?? 'planned'];
  const dates = [
    item.startedAt && `bắt đầu ${formatDate(item.startedAt)}`,
    item.finishedAt && `xong ${formatDate(item.finishedAt)}`,
  ].filter(Boolean);
  const meta = [itemTypeLabel(item.type), item.source, ...(dates.length ? dates : [`thêm ${formatDate(item.createdAt)}`])]
    .filter(Boolean)
    .join(' · ');
  const tags = (item.tags ?? []).map((t) => `#${t}`).join(' ');
  return (
    // One row of the shared subgrid (status | title over meta | rating | actions), DESIGN.md §3 "list row beats card"
    <li
      className="col-span-full grid min-h-14 grid-cols-subgrid items-center px-3 py-2 transition-colors hover:bg-accent has-focus-visible:bg-accent"
      onClick={(e) => onRowClick(e, onEdit)}
    >
      <span className="flex">
        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          className="max-w-full truncate rounded-sm text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onEdit}
        >
          {item.title}
        </button>
        <p className="truncate text-xs text-muted-foreground">
          {meta}
          {gap && (
            <>
              {' · '}
              <span className="text-warning-foreground">{gapLabel(gap)}</span>
            </>
          )}
          {tags && ` · ${tags}`}
        </p>
      </div>
      <span className="text-end text-xs tabular-nums text-muted-foreground max-sm:hidden">
        {item.rating ? `${item.rating}/10` : ''}
      </span>
      <div className="flex items-center justify-end gap-1">
        {step && (
          <Button size="xs" variant="outline" onClick={() => onStep(step.to)}>
            {step.label}
          </Button>
        )}
        <RowMenu>
          <MenuItem onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </MenuItem>
          <MenuLinkItem render={<Link href={`/thu-vien/ghi-chu/?item=${item.id}`} />}>
            <NotebookPen aria-hidden />
            Ghi chú
          </MenuLinkItem>
          <MenuItem onClick={onWriteNote}>
            <Plus aria-hidden />
            Viết ghi chú
          </MenuItem>
          {gap?.rating && (
            <MenuItem onClick={onRate}>
              <Star aria-hidden />
              Chấm điểm
            </MenuItem>
          )}
        </RowMenu>
      </div>
    </li>
  );
}

/** Thư viện: Items with type and status filters, create and edit (POST/PATCH /api/items). */
export function LibraryPage() {
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<ApiItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusRating, setFocusRating] = useState(false);
  const [noteFor, setNoteFor] = useState<ApiItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The full Item list is only for the note dialog's item picker.
  const index = useItemIndex(noteFor !== null);
  const [loadingMore, setLoadingMore] = useState(false);

  const items = useApi<Page<ApiItem>>(`items:${type}:${status}`, () =>
    api.listItems({
      limit: 100,
      ...(type !== 'all' && { type }),
      ...(status !== 'all' && { status }),
    }),
  );
  const list = items.loading ? [] : (items.data?.results ?? []);

  // ?item=N (Cmd+K result): open that Item's dialog (one GET /api/items/{id}, not the whole library).
  useOpenFromUrl('item', (id) => {
    api.getItem(id).then(
      (item) => {
        setEditing(item);
        setFocusRating(false);
        setDialogOpen(true);
      },
      (err: unknown) => setNotice(openError(err, `Không tìm thấy item #${id}, có thể đã bị xóa.`)),
    );
  });
  const matches = (i: ApiItem) => (type === 'all' || i.type === type) && (status === 'all' || i.status === status);

  const upsert = (saved: ApiItem, created: boolean) =>
    items.mutate((d) => {
      if (!d) return d;
      const rest = d.results.filter((i) => i.id !== saved.id);
      if (!matches(saved)) return { ...d, results: rest };
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
    const next = items.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(items);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setFocusRating(false);
    setDialogOpen(true);
  };
  const unfiltered = type === 'all' && status === 'all';
  const failed = !!items.error && !items.data;
  const firstLoad = items.loading && list.length === 0;
  // An empty, unfiltered library: the empty state's "Thêm item" is the one primary (DESIGN.md §7, D2)
  const emptyLibrary = !failed && !firstLoad && list.length === 0 && unfiltered;

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 sm:px-8">
      {/* 390 px: the two filters share row 1, "Thêm item" takes row 2 at full width (DESIGN.md §6 Toolbar, D11) */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <ChoiceSelect label="Loại" value={type} onChange={setType} choices={typeChoices} className="min-w-0 sm:w-auto" />
        <ChoiceSelect
          label="Trạng thái"
          value={status}
          onChange={setStatus}
          choices={statusChoices}
          className="min-w-0 sm:w-auto"
        />
        <Button
          variant={emptyLibrary ? 'outline' : 'default'}
          className="col-span-2 max-sm:w-full sm:ms-auto"
          onClick={openNew}
        >
          <Plus aria-hidden />
          Thêm item
        </Button>
      </div>

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={items} />
      {failed && items.error ? (
        <ApiErrorState error={items.error} onRetry={items.reload} />
      ) : firstLoad ? (
        <RowsSkeleton />
      ) : list.length === 0 && !unfiltered ? (
        <FilteredEmpty
          onClear={() => {
            setType('all');
            setStatus('all');
          }}
        >
          Không có mục nào khớp bộ lọc.
        </FilteredEmpty>
      ) : list.length === 0 ? (
        <>
          <EmptyState
            icon={<Library aria-hidden />}
            title="Chưa có item nào"
            description="Thêm sách, phim, khóa học, bài viết hoặc dự án. Mục từ inbox cũng có thể thành item."
          >
            <Button onClick={openNew}>
              <Plus aria-hidden />
              Thêm item
            </Button>
          </EmptyState>
          {items.data && !items.error && <EmptyStateGuide guide="library" />}
        </>
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
              onEdit={() => {
                setEditing(item);
                setFocusRating(false);
                setDialogOpen(true);
              }}
              onRate={() => {
                setEditing(item);
                setFocusRating(true);
                setDialogOpen(true);
              }}
              onStep={(to) => void step(item, to)}
              onWriteNote={() => setNoteFor(item)}
            />
          ))}
        </ul>
      )}
      {items.data?.next && !items.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          Tải thêm
        </Button>
      )}

      <ItemDialog
        open={dialogOpen}
        item={editing}
        focusRating={focusRating}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setFocusRating(false);
        }}
        onSaved={(saved, created) => {
          upsert(saved, created);
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
