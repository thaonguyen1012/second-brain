'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
}: {
  item: ApiItem | null;
  draft?: Partial<ApiItemRequest>;
  onSaved: (item: ApiItem, created: boolean) => void;
}) {
  const [form, setForm] = useState<Form>(() => fromItem(item, draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) {
      setError('Cần có tiêu đề.');
      return;
    }
    const rating = form.rating.trim() ? Number(form.rating) : null;
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 10)) {
      setError('Điểm là số nguyên từ 1 đến 10, hoặc để trống.');
      return;
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
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body)) || describeApiError(e).title);
      setBusy(false);
    }
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
          <Input id="item-title" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
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
            />
          </div>
        </div>
        {error && (
          <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>Hủy</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {item ? 'Lưu' : 'Thêm vào thư viện'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create (item = null, optional prefilled `draft`) or edit an Item: POST/PATCH /api/items. */
export function ItemDialog({
  open,
  item,
  draft,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  item: ApiItem | null;
  draft?: Partial<ApiItemRequest>;
  onOpenChange: (open: boolean) => void;
  onSaved: (item: ApiItem, created: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': 'Đóng' }}>
        <DialogHeader>
          <DialogTitle>{item ? 'Sửa item' : 'Thêm item'}</DialogTitle>
        </DialogHeader>
        {/* keyed so the form resets for each item */}
        {open && <ItemForm key={item?.id ?? 'new'} item={item} draft={draft} onSaved={onSaved} />}
      </DialogPopup>
    </Dialog>
  );
}
