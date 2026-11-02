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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError, openError } from './api-state';
import { BrainCard, StatusBadge } from './brain-card';
import { ChoiceSelect } from './choice-select';
import { ItemDialog } from './item-dialog';
import { DoneOutputHint, missingOutput, noteDraftForItem } from './library/done-output';
import { NoteDialog } from './library/note-dialog';
import { useItemIndex } from './library/use-item-index';

type TypeFilter = ApiItemType | 'all';
type StatusFilter = ApiItemStatus | 'all';

const typeChoices = [{ value: 'all' as const, label: 'Mọi loại' }, ...itemTypes];
const statusChoices = [{ value: 'all' as const, label: 'Mọi trạng thái' }, ...itemStatuses];

/** The one-click next step of the lifecycle (DECISIONS 4.2); "done" still needs a note to count. */
const nextStep: Partial<Record<ApiItemStatus, { to: ApiItemStatus; label: string }>> = {
  planned: { to: 'active', label: 'Bắt đầu' },
  active: { to: 'done', label: 'Xong' },
};

function ItemCard({
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
  return (
    <BrainCard
      badges={
        <>
          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          <Badge variant="secondary">{itemTypeLabel(item.type)}</Badge>
          {item.rating ? (
            <Badge variant="outline">
              <Star aria-hidden />
              {item.rating}/10
            </Badge>
          ) : null}
        </>
      }
      title={item.title}
      meta={[item.source, ...dates].filter(Boolean).join(' · ') || `thêm ${formatDate(item.createdAt)}`}
      actions={
        <>
          {step && (
            <Button size="xs" onClick={() => onStep(step.to)}>
              {step.label}
            </Button>
          )}
          <Button size="xs" variant="outline" onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </Button>
          <Button size="xs" variant="ghost" render={<Link href={`/thu-vien/ghi-chu/?item=${item.id}`} />}>
            <NotebookPen aria-hidden />
            Ghi chú
          </Button>
        </>
      }
    >
      {gap && <DoneOutputHint type={item.type} gap={gap} onWriteNote={onWriteNote} onRate={onRate} />}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((t) => (
            <Badge key={t} variant="outline">
              #{t}
            </Badge>
          ))}
        </div>
      )}
    </BrainCard>
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

  return (
    <div className="flex flex-col gap-5 px-4 pb-12 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceSelect label="Loại" value={type} onChange={setType} choices={typeChoices} className="w-auto" />
        <ChoiceSelect
          label="Trạng thái"
          value={status}
          onChange={setStatus}
          choices={statusChoices}
          className="w-auto"
        />
        <Button
          className="ms-auto"
          onClick={() => {
            setEditing(null);
            setFocusRating(false);
            setDialogOpen(true);
          }}
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
      {items.error && !items.data ? (
        <ApiErrorState error={items.error} onRetry={items.reload} />
      ) : items.loading && list.length === 0 ? (
        <LoadingCards />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Library aria-hidden />}
          title="Chưa có item nào"
          description={
            type === 'all' && status === 'all'
              ? 'Thêm sách, phim, khóa học, bài viết hoặc dự án. Mục từ inbox cũng có thể thành item.'
              : 'Không có item nào khớp bộ lọc.'
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((item) => (
            <ItemCard
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
        </div>
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
