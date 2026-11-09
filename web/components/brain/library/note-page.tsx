'use client';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, SearchX, Trash2 } from 'lucide-react';
import { notesApi, type ApiNote } from '@/lib/api/library';
import { useApi } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { noteDateLabel } from '@/lib/item-notes';
import { noteTitle } from '@/lib/library-labels';
import { MenuItem } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, EmptyState } from '../api-state';
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
import { saveErrorText, useNoteAutosave } from './use-note-autosave';

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
  afterConflict,
  linkErrorAtStart = null,
  onCreated,
  onConflict,
}: {
  /** The saved note, or null for a new one. */
  note: ApiNote | null;
  /** This page now shows a version saved elsewhere that replaced the one being edited (it says so). */
  afterConflict: boolean;
  /** Why an Item picked as that version arrived could not be put on it (the page says so). */
  linkErrorAtStart?: string | null;
  /** A new note's first Item link (`&item=`). */
  newItem: number | null;
  /** A new note's starting text (`&template=`). */
  template: string;
  onCreated: (note: ApiNote) => void;
  /** Show this newer version instead (saved elsewhere; this page's unsaved text comes back as the copy). */
  onConflict: (note: ApiNote, linkError?: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const base = useId();
  const [items, setItems] = useState<number[]>(note?.items ?? (newItem ? [newItem] : []));
  // the Items as last picked, for a create on its way (an Item picked meanwhile is saved right after it)
  const picked = useRef(items);
  const picking = useRef(0);
  const [linkError, setLinkError] = useState<string | null>(linkErrorAtStart);
  // An Item the user unlinked that the note's text still links: it stays, and the page says why
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const titleField = useRef<HTMLTextAreaElement>(null);
  const [current, setCurrent] = useState<ApiNote | null>(note);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const index = useItemIndex(true);
  const editor = useRef<NoteEditorHandle | null>(null);

  const autosave = useNoteAutosave({
    note,
    template,
    items: () => picked.current,
    draftKey: `new${newItem ? `-item-${newItem}` : ''}`,
    onSaved: (saved, created) => {
      setCurrent(saved);
      if (created) onCreated(saved);
      // a `[[ ]]` link to an Item links the note to it (the server says so in `items`), unless a pick is on its way
      if (picking.current === 0) {
        setItems(saved.items);
        picked.current = saved.items;
      }
    },
    onConflict,
    fresh: note,
    pull: () => editor.current?.markdown() ?? null,
  });
  const [title, setTitle] = useState(autosave.opening.title);
  const [markdown, setMarkdown] = useState(autosave.opening.markdown);
  // the editor opens with this text; a restored copy remounts it with that text (`editorKey`)
  const [opening, setOpening] = useState(autosave.opening.markdown);
  const [editorKey, setEditorKey] = useState(0);

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

  /**
   * Item links save at once, after any save of this note on its way (one request at a time): a pick made while the
   * note is being created is saved right after it; before any create, the create sends them.
   */
  async function changeItems(next: number[]) {
    const before = picked.current;
    setItems(next);
    picked.current = next;
    setLinkError(null);
    setLinkNotice(null);
    picking.current += 1;
    try {
      const answer = await autosave.saveItems(next);
      if (answer) {
        setCurrent(answer);
        if (picking.current === 1) {
          setItems(answer.items);
          picked.current = answer.items;
        }
        const kept = before.filter((id) => !next.includes(id) && answer.items.includes(id));
        if (kept.length > 0)
          setLinkNotice(
            t('{items} vẫn gắn với ghi chú vì nội dung có liên kết tới nó; bỏ liên kết trong nội dung trước.', {
              items: kept.map((id) => labels.get(id)?.title ?? `Item #${id}`).join(', '),
            }),
          );
      }
    } catch (err) {
      setItems(before);
      picked.current = before;
      setLinkError(saveErrorText(err, t));
    } finally {
      picking.current -= 1;
    }
  }

  const restore = () => {
    const copy = autosave.takeRecovered();
    if (!copy) return;
    setTitle(copy.title);
    setMarkdown(copy.markdown);
    setOpening(copy.markdown);
    setEditorKey((k) => k + 1);
  };

  // The title wraps like a heading: the field grows with its lines
  useLayoutEffect(() => {
    const el = titleField.current;
    if (!el) return;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [title]);

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
          <SaveStatus
            state={autosave.state}
            error={autosave.error}
            onRetry={autosave.invalid ? undefined : () => void autosave.flush()}
          />
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

      {autosave.recovered ? (
        <RecoveredDraft
          copy={autosave.recovered}
          offer={autosave.recoveredOffer ?? 'unsaved'}
          afterConflict={afterConflict}
          onRestore={restore}
          onDrop={autosave.dropRecovered}
        />
      ) : (
        afterConflict && (
          <p className="text-xs text-muted-foreground" role="status">
            {t('Ghi chú vừa được lưu ở nơi khác: đang hiện bản đó.')}
          </p>
        )
      )}

      {/* The page's heading for screen readers; the field below is the title itself */}
      <h1 className="sr-only">{pageTitle}</h1>
      {/* one line of text that wraps (a long title is read whole); Enter goes on to the text */}
      <textarea
        ref={titleField}
        id={`${base}-title`}
        rows={1}
        value={title}
        maxLength={300}
        onChange={(e) => changeText({ title: e.target.value.replace(/\s*\n\s*/g, ' ') })}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
          e.preventDefault();
          if (!e.metaKey && !e.ctrlKey) document.getElementById(`${base}-body`)?.focus();
          else void autosave.flush();
        }}
        aria-label={t('Tiêu đề ghi chú (không bắt buộc)')}
        placeholder={t('Không có tiêu đề')}
        className="w-full resize-none overflow-hidden rounded-md bg-transparent font-heading text-3xl font-semibold tracking-tight break-words outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
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
            <p className="mt-1 text-xs text-error-foreground" role="alert">
              {t('Chưa lưu được liên kết: {reason}', { reason: linkError })}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground empty:hidden" role="status">
            {linkNotice}
          </p>
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
        // a new note, a restored copy, and the version that replaced the one being typed in take the cursor
        focusRequest={(note && !afterConflict ? 0 : 1) + editorKey}
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
  // A newer version of the note (saved in another tab or on another device): the editor starts again from it, and
  // what this page had not saved comes back as the copy to restore (an Item picked meanwhile is on it, or said not)
  const [version, setVersion] = useState<{ note: ApiNote; n: number; linkError?: string } | null>(null);
  const onConflict = (newer: ApiNote, linkError?: string) => {
    if (id !== 'new') res.mutate(() => newer);
    setVersion((v) => ({ note: newer, n: (v?.n ?? 0) + 1, linkError }));
  };
  const afterConflict = version !== null;
  // A create answers this page only while it is the page that sent it: a late answer reaches no new-note page opened
  // since (it would take this note's id) and navigates nowhere once this page is gone
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);
  const created = (note: ApiNote) => {
    if (shown.current) onCreated(note);
  };

  let body;
  if (id === 'new')
    body = (
      <NoteEditing
        key={version?.n ?? 0}
        note={version?.note ?? null}
        newItem={newItem}
        template={template}
        afterConflict={afterConflict}
        linkErrorAtStart={version?.linkError}
        onCreated={created}
        onConflict={onConflict}
      />
    );
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
  // keyed by the loaded note and its version: a reload of the same version (tab focus) never resets what is typed
  else
    body = (
      <NoteEditing
        key={`${res.data.id}:${version?.n ?? 0}`}
        note={res.data}
        newItem={null}
        template=""
        afterConflict={afterConflict}
        linkErrorAtStart={version?.linkError}
        onCreated={created}
        onConflict={onConflict}
      />
    );

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
