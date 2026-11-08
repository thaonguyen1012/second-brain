'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, SearchX, Trash2 } from 'lucide-react';
import { notesApi, type ApiNote } from '@/lib/api/library';
import { toApiError, useApi } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { noteDateLabel } from '@/lib/item-notes';
import { noteTitle } from '@/lib/library-labels';
import { MenuItem } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, EmptyState, describeApiError } from '../api-state';
import { ConfirmDelete } from '../confirm-delete';
import { RowMenu } from '../row-menu';
import { noteTemplates } from './done-output';
import { NoteBacklinks } from './item-mentions';
import { RecoveredDraft } from './item-notes';
import { ItemPicker } from './item-picker';
import { NoteEditor } from './note-editor-lazy';
import type { NoteEditorHandle } from './note-editor-types';
import { SaveStatus } from './save-status';
import { useItemIndex } from './use-item-index';
import { useNoteAutosave } from './use-note-autosave';

// /thu-vien/ghi-chu/?id=N: one note as a page (DECISIONS 9.8, PROMPT-item-notes step 4), in place of the edit dialog:
// the title, the Items it is linked to (AFFiNE's properties), the block editor, and later "Được nhắc tới ở". Everything
// saves by itself (use-note-autosave.ts). `?id=new` (with `&item=N` and `&template=<type>`) is a new note, created by
// its first save; the route then shows its id without reopening the page.

function Back() {
  const t = useT();
  return (
    <Link
      href="/thu-vien/ghi-chu/"
      className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('Ghi chú', null, 'nav')}
    </Link>
  );
}

/** Loading at the page's geometry (D27): title, the Item row, a few lines of text. */
function NoteSkeleton() {
  const t = useT();
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label={t('Đang tải')}>
      <Skeleton className="h-9 w-2/3 rounded-md" />
      <Skeleton className="h-6 w-1/3" />
      <div className="flex flex-col gap-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function NoteEditing({
  note,
  newItem,
  template,
  onCreated,
}: {
  /** The saved note, or null for a new one. */
  note: ApiNote | null;
  /** A new note's first Item link (`&item=`). */
  newItem: number | null;
  /** A new note's starting text (`&template=`). */
  template: string;
  onCreated: (note: ApiNote) => void;
}) {
  const t = useT();
  const router = useRouter();
  const base = useId();
  const [title, setTitle] = useState(note?.title ?? '');
  const [markdown, setMarkdown] = useState(note?.markdown ?? template);
  // the editor opens with this text; a restored copy remounts it with that text (`editorKey`)
  const [opening, setOpening] = useState(note?.markdown ?? template);
  const [editorKey, setEditorKey] = useState(0);
  const [items, setItems] = useState<number[]>(note?.items ?? (newItem ? [newItem] : []));
  const [linkError, setLinkError] = useState<string | null>(null);
  const [current, setCurrent] = useState<ApiNote | null>(note);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const index = useItemIndex(true);
  const editor = useRef<NoteEditorHandle | null>(null);

  const autosave = useNoteAutosave({
    note,
    template,
    items: () => items,
    draftKey: `new${newItem ? `-item-${newItem}` : ''}`,
    onSaved: (saved, created) => {
      setCurrent(saved);
      // a `[[ ]]` link to an Item links the note to it (the server says so in `items`)
      setItems(saved.items);
      if (created) onCreated(saved);
    },
    pull: () => editor.current?.markdown() ?? null,
  });

  const labels = useMemo(() => {
    const m = new Map<number, { title: string; type: string }>();
    for (const l of current?.itemLabels ?? []) m.set(l.id, l);
    for (const [id, it] of index.byId) m.set(id, it);
    return m;
  }, [current, index.byId]);

  const changeText = (next: { title?: string; markdown?: string }) => {
    const text = { title: next.title ?? title, markdown: next.markdown ?? markdown };
    if (next.title !== undefined) setTitle(next.title);
    if (next.markdown !== undefined) setMarkdown(next.markdown);
    autosave.change(text);
  };

  /** Item links save at once (a separate PATCH); a new note keeps them for its first save. */
  const changeItems = async (next: number[]) => {
    const before = items;
    setItems(next);
    setLinkError(null);
    const saved = autosave.note;
    if (!saved) return;
    try {
      const answer = await notesApi.update(saved.id, { items: next });
      setCurrent(answer);
      setItems(answer.items);
    } catch (err) {
      setItems(before);
      setLinkError(describeApiError(toApiError(err), t).title);
    }
  };

  const restore = () => {
    const copy = autosave.takeRecovered();
    if (!copy) return;
    setTitle(copy.title);
    setMarkdown(copy.markdown);
    setOpening(copy.markdown);
    setEditorKey((k) => k + 1);
  };

  const shown = current ?? autosave.note;
  const pageTitle = shown ? noteTitle({ ...shown, title, markdown }, t) : title.trim() || t('Ghi chú mới');
  useEffect(() => {
    document.title = `${pageTitle} · Alex's Brain`; // i18n-ignore: the app's name
  }, [pageTitle]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
        <Back />
        <span className="ms-auto flex items-center gap-2">
          <SaveStatus state={autosave.state} error={autosave.error} onRetry={() => void autosave.flush()} />
          {shown && (
            <RowMenu label={t('Thao tác cho ghi chú “{title}”', { title: pageTitle })}>
              <MenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden />
                {t('Xóa')}
              </MenuItem>
            </RowMenu>
          )}
        </span>
      </div>

      {autosave.recovered && (
        <RecoveredDraft copy={autosave.recovered} onRestore={restore} onDrop={autosave.dropRecovered} />
      )}

      {/* The page's heading for screen readers; the field below is the title itself */}
      <h1 className="sr-only">{pageTitle}</h1>
      <input
        id={`${base}-title`}
        value={title}
        maxLength={300}
        onChange={(e) => changeText({ title: e.target.value })}
        aria-label={t('Tiêu đề ghi chú (không bắt buộc)')}
        placeholder={t('Không có tiêu đề')}
        className="w-full rounded-md bg-transparent font-heading text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
      />

      {/* AFFiNE's properties: the Items the note belongs to, and when it was written */}
      <dl className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
        <dt className="text-xs text-muted-foreground">
          <label htmlFor={`${base}-items`}>{t('Item')}</label>
        </dt>
        <dd className="min-w-0">
          <ItemPicker
            id={`${base}-items`}
            items={index.items}
            byId={labels}
            value={items}
            onChange={(next) => void changeItems(next)}
            status={index.loading && index.items.length === 0 ? t('Đang tải danh sách item…') : undefined}
          />
          {linkError && (
            <p className="mt-1 text-xs text-destructive-foreground" role="alert">
              {t('Chưa lưu được liên kết: {reason}', { reason: linkError })}
            </p>
          )}
        </dd>
        {shown && (
          <>
            <dt className="text-xs text-muted-foreground">{t('Ngày')}</dt>
            <dd className="text-muted-foreground tabular-nums">{noteDateLabel(shown, t)}</dd>
          </>
        )}
      </dl>

      <NoteEditor
        key={editorKey}
        id={`${base}-body`}
        variant="page"
        defaultMarkdown={opening}
        onChange={(md) => changeText({ markdown: md })}
        label={t('Nội dung ghi chú')}
        placeholder={t('Gõ / để chèn khối, hoặc viết luôn')}
        focusRequest={(note ? 0 : 1) + editorKey}
        caret={note || editorKey > 0 ? 'end' : 'first-empty'}
        selfNoteId={shown?.id}
        onInput={autosave.touch}
        onReady={(handle) => {
          editor.current = handle;
        }}
        onSubmit={() => void autosave.flush()}
      />

      {shown && <NoteBacklinks noteId={shown.id} />}

      {shown && (
        <ConfirmDelete
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={t('Xóa ghi chú?')}
          description={t('"{title}" bị xóa hẳn. Item liên kết vẫn giữ nguyên. Không hoàn tác được.', {
            title: pageTitle,
          })}
          action={() => notesApi.delete(shown.id)}
          onDeleted={() => router.push('/thu-vien/ghi-chu/')}
        />
      )}
    </div>
  );
}

/** One note, loaded by id (a number) or new (`new`, with `item` and `template` from the URL). */
export function NotePageView({
  id,
  newItem,
  templateType,
  onCreated,
}: {
  id: number | 'new';
  newItem: number | null;
  templateType: string | null;
  onCreated: (note: ApiNote) => void;
}) {
  const t = useT();
  const res = useApi<ApiNote>(id === 'new' ? null : `note:${id}`, () => notesApi.get(id as number));
  const template = templateType && templateType in noteTemplates ? t(noteTemplates[templateType as keyof typeof noteTemplates]) : '';

  let body;
  if (id === 'new') body = <NoteEditing note={null} newItem={newItem} template={template} onCreated={onCreated} />;
  else if (res.error && !res.data)
    body =
      res.error.status === 404 && res.error.reachable ? (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title={t('Không tìm thấy ghi chú này')}
          description={t('Có thể ghi chú đã bị xóa hoặc link đã cũ.')}
        />
      ) : (
        <ApiErrorState error={res.error} onRetry={res.reload} />
      );
  else if (!res.data) body = <NoteSkeleton />;
  // keyed by the loaded note: a reload of the same note (tab focus) never resets what is being typed
  else body = <NoteEditing key={res.data.id} note={res.data} newItem={null} template="" onCreated={onCreated} />;

  return (
    // Same gutters and top padding as PageHeader; a reading width (DESIGN.md §3)
    <div className="flex w-full flex-col px-4 pt-10 pb-12 sm:px-8 md:pt-12">
      <div className="flex w-full max-w-3xl flex-col gap-4">
        {id !== 'new' && !res.data && <Back />}
        {body}
      </div>
    </div>
  );
}
