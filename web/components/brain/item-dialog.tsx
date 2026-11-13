'use client';
import { useId, useMemo, useState, type ComponentProps } from 'react';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { api, type ApiItem, type ApiItemRequest, type ApiItemStatus, type ApiItemType } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { fieldErrors, itemStatusesFor, itemTypes } from '@/lib/labels';
import { toolStageIcons } from '@/lib/tool-icons';
import { TOOL_STAGES, splitStageTags, toolStagesOf, type ToolStage } from '@/lib/tools';
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
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { describeApiError } from './api-state';
import { ChoiceSelect } from './choice-select';
import { ConfirmDelete } from './confirm-delete';
import { useInvalidFields } from './invalid-fields';
import { effectiveImageChange, handbookPath, isLocalImage, willFetchOnSave } from '@/lib/item-picture';
import { DoneOutputHint, missingOutput } from './library/done-output';
import { ItemImageField, KEEP_IMAGE, applyImageChange, imageErrorText, type ImageChange } from './library/item-image-field';

interface Form {
  title: string;
  summary: string;
  type: ApiItemType;
  status: ApiItemStatus;
  /** A tool's stages (the stage picker); the stage tags of any other type stay in `tags`. */
  stages: ToolStage[];
  /** The other tags, comma separated. */
  tags: string;
  source: string;
  rating: string;
}

/** A refused save's summary names each field as its label does, never by the API's key ("source:"). */
const fieldNames: Record<string, Msg> = {
  title: msg('Tiêu đề'),
  summary: msg('Tóm tắt'),
  type: msg('Loại'),
  status: msg('Trạng thái'),
  tags: msg('Tag'),
  source: msg('Nguồn'),
  rating: msg('Điểm 1–10'),
};

const typedTags = (text: string) =>
  text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

/** Form values of the edited Item, else of `draft` (a new Item prefilled by the caller), else empty. */
const fromItem = (item: ApiItem | null, draft?: Partial<ApiItemRequest>): Form => {
  const i: Partial<ApiItemRequest> = item ?? draft ?? {};
  const type = i.type ?? 'book';
  const tags = i.tags ?? [];
  const { stages, rest } = type === 'tool' ? splitStageTags(tags) : { stages: [], rest: tags };
  return {
    title: i.title ?? '',
    summary: i.summary ?? '',
    type,
    status: i.status ?? 'planned',
    stages,
    tags: rest.join(', '),
    source: i.source ?? '',
    rating: i.rating ? String(i.rating) : '',
  };
};

/**
 * The form after a type change: becoming a tool moves stage tags typed in the text into the picker, and leaving it puts
 * the picked stages back into the text, so a tag is never dropped unseen.
 */
function withType(form: Form, type: ApiItemType): Form {
  if ((form.type === 'tool') === (type === 'tool')) return { ...form, type };
  const typed = typedTags(form.tags);
  if (type === 'tool') {
    const { stages, rest } = splitStageTags(typed);
    return { ...form, type, stages: toolStagesOf([...form.stages, ...stages]), tags: rest.join(', ') };
  }
  return { ...form, type, stages: [], tags: [...form.stages, ...typed].join(', ') };
}

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
  onSaved: (item: ApiItem, created: boolean, imageError?: string) => void;
  onDeleted?: (item: ApiItem) => void;
  onWriteNote?: (item: ApiItem) => void;
  focusRating?: boolean;
}) {
  const t = useT();
  const stagesId = useId();
  const [form, setForm] = useState<Form>(() => fromItem(item, draft));
  const typeOptions = useMemo(() => itemTypes.map((c) => ({ value: c.value, label: t(c.label) })), [t]);
  // a tool's statuses read as its use (Muốn thử, Đang dùng, Đã thành thạo, Bỏ)
  const statusOptions = useMemo(
    () => itemStatusesFor(form.type).map((c) => ({ value: c.value, label: t(c.label) })),
    [t, form.type],
  );
  const tool = form.type === 'tool';
  const [image, setImage] = useState<ImageChange>(KEEP_IMAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = useInvalidFields();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleStage = (stage: ToolStage) =>
    setForm((f) => ({
      ...f,
      stages: f.stages.includes(stage) ? f.stages.filter((s) => s !== stage) : toolStagesOf([...f.stages, stage]),
    }));
  // A handbook course shows its Sổ tay cover (lib/handbook-picture.ts): the field shows only while it still has a
  // picture of its own, to remove it. effectiveImageChange drops a change the field no longer shows.
  const handbook = form.type === 'course' && handbookPath(form.source) !== null;
  const hasOwnImage = isLocalImage(item?.imageUrl);
  const imageCtx = { type: form.type, source: form.source, handbook, hasOwnImage };
  const change = effectiveImageChange(image, imageCtx) as ImageChange;
  const fetchOnSave = willFetchOnSave({
    creating: !item,
    type: form.type,
    source: form.source,
    savedSource: item?.source ?? '',
    hasOwnImage,
  });
  // "Done needs an output" follows the form as typed (status, type, rating) and the saved note count.
  const gap = item
    ? missingOutput({
        status: form.status,
        type: form.type,
        rating: Number(form.rating) || null,
        noteCount: item.noteCount,
      })
    : null;

  /**
   * Saves the form, then the picture change; the saved Item and, when only the picture failed, why; or null when
   * validation or the record's request failed (error shown, the dialog stays).
   */
  const submit = async (): Promise<{ saved: ApiItem; imageError?: string } | null> => {
    if (!form.title.trim()) {
      setError(invalid.mark(t('Cần có tiêu đề.'), 'title'));
      return null;
    }
    const rating = form.rating.trim() ? Number(form.rating) : null;
    if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 10)) {
      setError(invalid.mark(t('Điểm là số nguyên từ 1 đến 10, hoặc để trống.'), 'rating'));
      return null;
    }
    const body = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      type: form.type,
      status: form.status,
      // a tool's stages first, in the page's order, then the other tags
      tags: [...(form.type === 'tool' ? form.stages : []), ...typedTags(form.tags)],
      source: form.source.trim(),
      rating,
    };
    setBusy(true);
    setError(null);
    invalid.clear();
    try {
      const saved = item ? await api.updateItem(item.id, body) : await api.createItem(body);
      // The picture goes after the record (a new Item needs its id). If only the picture fails, the record is saved
      // all the same: the dialog closes and the page says what happened to the picture.
      let final = saved;
      let imageError: string | undefined;
      try {
        const picture = await applyImageChange(saved.id, change);
        if (picture) final = { ...saved, ...picture };
      } catch (err) {
        imageError = imageErrorText(toApiError(err), t);
      }
      onSaved(final, !item, imageError);
      return { saved: final, imageError };
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body, t, fieldNames)) || describeApiError(e, t).title);
      invalid.fromError(e, t);
      setBusy(false);
      return null;
    }
  };

  /**
   * "Viết ghi chú": unsaved edits (e.g. status just set to done, a picked picture) are saved first, then the note
   * opens. When the picture failed, the note does not open, so the page's notice about it stays readable.
   */
  const writeNote = async () => {
    if (!item || !onWriteNote || busy) return;
    const dirty = change.kind !== 'keep' || JSON.stringify(form) !== JSON.stringify(fromItem(item));
    const result = dirty ? await submit() : { saved: item };
    if (result && !('imageError' in result && result.imageError)) onWriteNote(result.saved);
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
          <Label htmlFor="item-title">{t('Tiêu đề')}</Label>
          <Input
            id="item-title"
            aria-required
            {...invalid.field('title')}
            value={form.title} onChange={(e) => set('title', e.target.value)}
            autoFocus={!focusRating}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-summary">{tool ? t('Dùng để làm gì') : t('Tóm tắt một dòng')}</Label>
          <Input
            id="item-summary"
            {...invalid.field('summary')}
            value={form.summary}
            maxLength={300}
            onChange={(e) => set('summary', e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-type">{t('Loại')}</Label>
            <ChoiceSelect
              id="item-type"
              {...invalid.field('type')}
              label={t('Loại')}
              value={form.type}
              onChange={(v) => setForm((f) => withType(f, v))}
              choices={typeOptions}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-status">{t('Trạng thái')}</Label>
            <ChoiceSelect
              id="item-status"
              {...invalid.field('status')}
              label={t('Trạng thái')}
              value={form.status}
              onChange={(v) => set('status', v)}
              choices={statusOptions}
            />
          </div>
        </div>
        {tool && (
          // The stages a tool is used at: its tags, picked from the Công cụ page's list (lib/tools.ts)
          <div className="flex flex-col gap-1.5">
            <Label render={<span id={stagesId} />}>{t('Công đoạn')}</Label>
            <div role="group" aria-labelledby={stagesId} className="flex flex-wrap gap-1.5">
              {TOOL_STAGES.map((s) => {
                const on = form.stages.includes(s.slug);
                const Icon = toolStageIcons[s.slug];
                return (
                  <Button
                    key={s.slug}
                    type="button"
                    size="xs"
                    variant={on ? 'secondary' : 'outline'}
                    aria-pressed={on}
                    onClick={() => toggleStage(s.slug)}
                  >
                    {/* a picked stage shows a check, not only a fill */}
                    {on ? <Check aria-hidden /> : <Icon aria-hidden />}
                    {t(s.label)}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-source">{t('Nguồn (tác giả, nền tảng, link)')}</Label>
          <Input
            id="item-source"
            {...invalid.field('source')}
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
          />
        </div>
        {(!handbook || hasOwnImage) && (
          <ItemImageField
            type={form.type}
            source={form.source}
            imageUrl={item?.imageUrl}
            pending={item?.imagePending}
            fetchOnSave={fetchOnSave}
            change={change}
            onChange={setImage}
            disabled={busy}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-tags">
              {tool ? t('Tag khác (cách nhau bằng dấu phẩy)') : t('Tag (cách nhau bằng dấu phẩy)')}
            </Label>
            <Input
              id="item-tags"
              {...invalid.field('tags')}
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-rating">{t('Điểm 1–10')}</Label>
            <Input
              id="item-rating"
              {...invalid.field('rating')}
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
        {invalid.copies}
      </DialogPanel>
      <DialogFooter>
        {item && onDeleted && (
          <ConfirmDelete
            title={t('Xóa item?')}
            description={
              item.type === 'project'
                ? t(
                    '"{title}" bị xóa hẳn. Dự án còn giờ làm thì phải xóa các giờ đó trước. Ghi chú liên kết vẫn giữ, chỉ mất liên kết. Không hoàn tác được.',
                    { title: item.title },
                  )
                : t(
                    '"{title}" bị xóa hẳn. Ghi chú liên kết vẫn giữ, chỉ mất liên kết; bằng chứng cho cơ hội giữ lại tiêu đề. Không hoàn tác được.',
                    { title: item.title },
                  )
            }
            action={() => api.deleteItem(item.id)}
            onDeleted={() => onDeleted(item)}
            trigger={
              <Button variant="destructive-outline" type="button" className="sm:me-auto" disabled={busy}>
                <Trash2 aria-hidden />
                {t('Xóa')}
              </Button>
            }
          />
        )}
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {item ? t('Lưu') : t('Thêm vào thư viện')}
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
  finalFocus,
}: {
  open: boolean;
  item: ApiItem | null;
  draft?: Partial<ApiItemRequest>;
  onOpenChange: (open: boolean) => void;
  /** After a save; `imageError` says why the picture change failed when the record itself was saved. */
  onSaved: (item: ApiItem, created: boolean, imageError?: string) => void;
  /** Where the focus goes when the dialog closes (default: the control that opened it, if it still exists). */
  finalFocus?: ComponentProps<typeof DialogPopup>['finalFocus'];
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
  const t = useT();
  const tool = (item?.type ?? draft?.type) === 'tool';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }} finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>
            {item ? (tool ? t('Sửa công cụ') : t('Sửa item')) : tool ? t('Thêm công cụ') : t('Thêm item')}
          </DialogTitle>
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
