'use client';
import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { api, type ApiItem, type ApiItemRequest, type ApiItemStatus, type ApiItemType } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { fieldErrors, itemStatuses, itemTypes } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { describeApiError } from './api-state';
import { ChoiceSelect } from './choice-select';
import { ConfirmDelete } from './confirm-delete';
import { DoneOutputHint, missingOutput } from './library/done-output';

interface Form {
  title: string;
  type: ApiItemType;
  status: ApiItemStatus;
  tags: string;
  source: string;
  rating: string;
}

/** Form values of the edited Item, else of `draft` (a new Item prefilled by the caller), else empty. */
const fromItem = (item: ApiItem | null, draft?: Partial<ApiItemRequest>): Form => {
  const i: Partial<ApiItemRequest> = item ?? draft ?? {};
  return {
    title: i.title ?? '',
    type: i.type ?? 'book',
    status: i.status ?? 'planned',
    tags: (i.tags ?? []).join(', '),
    source: i.source ?? '',
    rating: i.rating ? String(i.rating) : '',
  };
};

function ItemForm({
  item,
  draft,
  onSaved,
  onDeleted,
  onWriteNote,
  focusRating = false,
}: {
  item: ApiItem | null;
  draft?: Partial<ApiItemRequest>;
  onSaved: (item: ApiItem, created: boolean) => void;
  onDeleted?: (item: ApiItem) => void;
  onWriteNote?: (item: ApiItem) => void;
  focusRating?: boolean;
}) {
  const [form, setForm] = useState<Form>(() => fromItem(item, draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  // "Done needs an output" follows the form as typed (status, type, rating) and the saved note count.
  const gap = item
    ? missingOutput({
        status: form.status,
        type: form.type,
        rating: Number(form.rating) || null,
        noteCount: item.noteCount,
      })
    : null;

  /** Saves the form; the saved Item, or null when validation or the request failed (error shown). */
  const submit = async (): Promise<ApiItem | null> => {
    if (!form.title.trim()) {
      setError('Cần có tiêu đề.');
      return null;
    }
    const rating = form.rating.trim() ? Number(form.rating) : null;
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 10)) {
      setError('Điểm là số nguyên từ 1 đến 10, hoặc để trống.');
      return null;
    }
    const body = {
      title: form.title.trim(),
      type: form.type,
      status: form.status,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      source: form.source.trim(),
      rating,
    };
    setBusy(true);
    setError(null);
    try {
      const saved = item ? await api.updateItem(item.id, body) : await api.createItem(body);
      onSaved(saved, !item);
      return saved;
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body)) || describeApiError(e).title);
      setBusy(false);
      return null;
    }
  };

  /** "Viết ghi chú": unsaved edits (e.g. status just set to done) are saved first, then the note opens. */
  const writeNote = async () => {
    if (!item || !onWriteNote || busy) return;
    const dirty = JSON.stringify(form) !== JSON.stringify(fromItem(item));
    const saved = dirty ? await submit() : item;
    if (saved) onWriteNote(saved);
  };

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogPanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-title">Tiêu đề</Label>
          <Input
            id="item-title"
            value={form.title} onChange={(e) => set('title', e.target.value)}
            autoFocus={!focusRating}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-type">Loại</Label>
            <ChoiceSelect
              id="item-type"
              label="Loại"
              value={form.type}
              onChange={(v) => set('type', v)}
              choices={itemTypes}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-status">Trạng thái</Label>
            <ChoiceSelect
              id="item-status"
              label="Trạng thái"
              value={form.status}
              onChange={(v) => set('status', v)}
              choices={itemStatuses}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-source">Nguồn (tác giả, nền tảng, link)</Label>
          <Input id="item-source" value={form.source} onChange={(e) => set('source', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-tags">Tag (cách nhau bằng dấu phẩy)</Label>
            <Input id="item-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-rating">Điểm 1–10</Label>
            <Input
              id="item-rating"
              inputMode="numeric"
              value={form.rating}
              onChange={(e) => set('rating', e.target.value)}
              autoFocus={focusRating}
            />
          </div>
        </div>
        {item && gap && (
          <DoneOutputHint
            type={form.type}
            gap={gap}
            onWriteNote={onWriteNote && (() => void writeNote())}
            onRate={() => document.getElementById('item-rating')?.focus()}
          />
        )}
        {error && (
          <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
      </DialogPanel>
      <DialogFooter>
        {item && onDeleted && (
          <ConfirmDelete
            title="Xóa item?"
            description={
              item.type === 'project'
                ? `"${item.title}" bị xóa hẳn. Dự án còn giờ làm thì phải xóa các giờ đó trước. Ghi chú liên kết vẫn giữ, chỉ mất liên kết. Không hoàn tác được.`
                : `"${item.title}" bị xóa hẳn. Ghi chú liên kết vẫn giữ, chỉ mất liên kết; bằng chứng cho cơ hội giữ lại tiêu đề. Không hoàn tác được.`
            }
            action={() => api.deleteItem(item.id)}
            onDeleted={() => onDeleted(item)}
            trigger={
              <Button variant="destructive-outline" type="button" className="sm:me-auto" disabled={busy}>
                <Trash2 aria-hidden />
                Xóa
              </Button>
            }
          />
        )}
        <DialogClose render={<Button variant="ghost" type="button" />}>Hủy</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {item ? 'Lưu' : 'Thêm vào thư viện'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create (item = null, optional prefilled `draft`) or edit an Item: POST/PATCH/DELETE /api/items. */
export function ItemDialog({
  open,
  item,
  draft,
  onOpenChange,
  onSaved,
  onDeleted,
  onWriteNote,
  focusRating,
}: {
  open: boolean;
  item: ApiItem | null;
  draft?: Partial<ApiItemRequest>;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: ApiItem, created: boolean) => void;
  /** Shows "Xóa" (with confirmation) when editing; called after DELETE /api/items/{id}. */
  onDeleted?: (item: ApiItem) => void;
  /**
   * "Viết ghi chú" of the done-needs-an-output hint: close this dialog and open a new note linked to the Item
   * (after saving unsaved edits, which also calls onSaved).
   */
  onWriteNote?: (item: ApiItem) => void;
  /** Start in the rating field ("Chấm điểm" of the done-needs-an-output hint) instead of the title. */
  focusRating?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': 'Đóng' }}>
        <DialogHeader>
          <DialogTitle>{item ? 'Sửa item' : 'Thêm item'}</DialogTitle>
        </DialogHeader>
        {/* keyed so the form resets for each item */}
        {open && (
          <ItemForm
            key={item?.id ?? 'new'}
            item={item}
            draft={draft}
            onSaved={onSaved}
            onDeleted={onDeleted}
            onWriteNote={onWriteNote}
            focusRating={focusRating}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}
