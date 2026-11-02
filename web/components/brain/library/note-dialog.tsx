'use client';
import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ApiItem } from '@/lib/api/client';
import { notesApi, type ApiNote } from '@/lib/api/library';
import { toApiError } from '@/lib/api/use-api';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { describeApiError } from '../api-state';
import { ItemPicker, type ItemLabel } from './item-picker';
import { fieldErrors as sharedFieldErrors } from '@/lib/labels';
import { SaveKeys } from '../save-keys';

/** Backend limit for `markdown` (API_CONTRACT.md). */
const MAX_MARKDOWN = 200_000;

export interface NoteDraft {
  title?: string;
  markdown?: string;
  items?: number[];
}

interface Form {
  title: string;
  markdown: string;
  items: number[];
}

const fieldNames: Record<string, string> = { title: 'Tiêu đề', markdown: 'Nội dung', items: 'Item' };

const fieldErrors = (body: unknown) => sharedFieldErrors(body, fieldNames);

const sameForm = (a: Form, b: Form) =>
  a.title === b.title && a.markdown === b.markdown && a.items.join(',') === b.items.join(',');

function NoteForm({
  note,
  draft,
  items,
  byId,
  itemsStatus,
  onDirty,
  onSaved,
}: {
  note: ApiNote | null;
  draft?: NoteDraft;
  items: ApiItem[];
  byId: ReadonlyMap<number, ItemLabel>;
  itemsStatus?: string;
  onDirty: (dirty: boolean) => void;
  onSaved: (note: ApiNote, created: boolean) => void;
}) {
  const [initial] = useState<Form>(() => ({
    title: note?.title ?? draft?.title ?? '',
    markdown: note?.markdown ?? draft?.markdown ?? '',
    items: note?.items ?? draft?.items ?? [],
  }));
  const [form, setForm] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    const next = { ...form, [k]: v };
    setForm(next);
    onDirty(!sameForm(next, initial));
  };

  const submit = async () => {
    if (busy) return;
    if (!form.markdown.trim()) {
      setError('Ghi chú cần có nội dung.');
      return;
    }
    if (form.markdown.length > MAX_MARKDOWN) {
      setError(`Nội dung dài quá ${MAX_MARKDOWN.toLocaleString('vi-VN')} ký tự.`);
      return;
    }
    const body = { title: form.title.trim(), markdown: form.markdown, items: form.items };
    setBusy(true);
    setError(null);
    try {
      const saved = note ? await notesApi.update(note.id, body) : await notesApi.create(body);
      onDirty(false);
      onSaved(saved, !note);
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
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <DialogPanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-title">Tiêu đề (không bắt buộc)</Label>
          <Input
            id="note-title"
            value={form.title}
            maxLength={300}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Để trống thì lấy dòng đầu của nội dung"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-markdown">Nội dung (markdown)</Label>
          <Textarea
            id="note-markdown"
            value={form.markdown}
            onChange={(e) => set('markdown', e.target.value)}
            placeholder={'# Ba ý chính\n\n- …'}
            style={{ minHeight: '14rem' }}
            spellCheck
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Ghi chú là riêng tư, không gửi cho AI. Hiển thị dạng văn bản thô, giữ nguyên xuống dòng.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-items">Liên kết tới item</Label>
          <ItemPicker
            id="note-items"
            items={items}
            byId={byId}
            value={form.items}
            onChange={(v) => set('items', v)}
            status={itemsStatus}
          />
        </div>
        {error && (
          <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
      </DialogPanel>
      <DialogFooter>
        <span className="me-auto hidden text-xs text-muted-foreground sm:inline">
          <SaveKeys /> để lưu
        </span>
        <DialogClose render={<Button variant="ghost" type="button" />}>Hủy</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {note ? 'Lưu' : 'Tạo ghi chú'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Create (note = null, optional `draft`) or edit a note: POST/PATCH /api/notes. Closing with unsaved changes asks
 * first, so Esc never loses a long note.
 */
export function NoteDialog({
  open,
  note,
  draft,
  items,
  byId,
  itemsStatus,
  description,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  note: ApiNote | null;
  draft?: NoteDraft;
  items: ApiItem[];
  byId: ReadonlyMap<number, ItemLabel>;
  itemsStatus?: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (note: ApiNote, created: boolean) => void;
}) {
  const dirty = useRef(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const change = (next: boolean) => {
    if (!next && dirty.current) {
      setAskDiscard(true);
      return;
    }
    if (!next) dirty.current = false;
    onOpenChange(next);
  };
  const discard = () => {
    setAskDiscard(false);
    dirty.current = false;
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogPopup className="sm:max-w-2xl" closeProps={{ 'aria-label': 'Đóng' }}>
        <DialogHeader>
          <DialogTitle>{note ? 'Sửa ghi chú' : 'Ghi chú mới'}</DialogTitle>
          {description && <DialogDescription className="line-clamp-2">{description}</DialogDescription>}
        </DialogHeader>
        {/* keyed so the form resets for each note */}
        {open && (
          <NoteForm
            key={note?.id ?? 'new'}
            note={note}
            draft={draft}
            items={items}
            byId={byId}
            itemsStatus={itemsStatus}
            onDirty={(d) => {
              dirty.current = d;
            }}
            onSaved={(saved, created) => {
              dirty.current = false;
              onSaved(saved, created);
            }}
          />
        )}
        {/* Nested in the popup, so Base UI treats it as a child dialog (focus returns to the note). */}
        <AlertDialog open={askDiscard} onOpenChange={setAskDiscard}>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Bỏ các thay đổi chưa lưu?</AlertDialogTitle>
              <AlertDialogDescription>Nội dung vừa gõ trong ghi chú này sẽ mất.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="ghost" type="button" />}>Tiếp tục sửa</AlertDialogClose>
              <Button variant="destructive" type="button" onClick={discard}>
                Bỏ thay đổi
              </Button>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </DialogPopup>
    </Dialog>
  );
}
