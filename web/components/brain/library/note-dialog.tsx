'use client';
import { useRef, useState, type ComponentProps } from 'react';
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
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
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

const fieldNames: Record<string, Msg> = { title: msg('Tiêu đề'), markdown: msg('Nội dung'), items: msg('Item') };

const fieldErrors = (body: unknown, t: T) => sharedFieldErrors(body, t, fieldNames);

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
  const t = useT();
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
      setError(t('Ghi chú cần có nội dung.'));
      return;
    }
    if (form.markdown.length > MAX_MARKDOWN) {
      setError(t('Nội dung dài quá {max} ký tự.', { max: t.num(MAX_MARKDOWN) }));
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
      setError((e.status === 400 && fieldErrors(e.body, t)) || describeApiError(e, t).title);
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
          <Label htmlFor="note-title">{t('Tiêu đề (không bắt buộc)')}</Label>
          <Input
            id="note-title"
            value={form.title}
            maxLength={300}
            onChange={(e) => set('title', e.target.value)}
            placeholder={t('Để trống thì lấy dòng đầu của nội dung')}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-markdown">{t('Nội dung (markdown)')}</Label>
          <Textarea
            id="note-markdown"
            value={form.markdown}
            onChange={(e) => set('markdown', e.target.value)}
            placeholder={t('# Ba ý chính\n\n- …')}
            style={{ minHeight: '14rem' }}
            spellCheck
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            {t('Ghi chú là riêng tư, không gửi cho AI. Hiển thị dạng văn bản thô, giữ nguyên xuống dòng.')}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-items">{t('Liên kết tới item')}</Label>
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
        <span className="me-auto text-xs text-muted-foreground max-sm:hidden pointer-coarse:hidden">
          <SaveKeys /> {t('để lưu')}
        </span>
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {note ? t('Lưu') : t('Tạo ghi chú')}
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
  finalFocus,
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
  /** Where the focus goes when the dialog closes (default: the control that opened it, if it still exists). */
  finalFocus?: ComponentProps<typeof DialogPopup>['finalFocus'];
}) {
  const t = useT();
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
      <DialogPopup className="sm:max-w-2xl" closeProps={{ 'aria-label': t('Đóng') }} finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>{note ? t('Sửa ghi chú') : t('Ghi chú mới')}</DialogTitle>
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
              <AlertDialogTitle>{t('Bỏ các thay đổi chưa lưu?')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('Nội dung vừa gõ trong ghi chú này sẽ mất.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="ghost" type="button" />}>
                {t('Tiếp tục sửa')}
              </AlertDialogClose>
              <Button variant="destructive" type="button" onClick={discard}>
                {t('Bỏ thay đổi')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </DialogPopup>
    </Dialog>
  );
}
