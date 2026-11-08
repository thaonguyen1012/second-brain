'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, History, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, type ApiItem, type Page } from '@/lib/api/client';
import { notesApi, type ApiNote } from '@/lib/api/library';
import { loadAllPages } from '@/lib/api/pages';
import { useApi } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { noteDateLabel, noteHeading } from '@/lib/item-notes';
import { formatDate } from '@/lib/labels';
import { noteTitle } from '@/lib/library-labels';
import { linkHref } from '@/lib/note-links';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MenuItem, MenuLinkItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiErrorState } from '../api-state';
import { ConfirmDelete } from '../confirm-delete';
import { RowMenu } from '../row-menu';
import { noteTemplateFor } from './done-output';
import { NoteBody } from './note-body';
import { NoteEditor } from './note-editor-lazy';
import type { NoteEditorHandle } from './note-editor-types';
import { SaveStatus } from './save-status';
import { useNoteAutosave, type NoteBackup } from './use-note-autosave';

// Every note of one Item on its page (DECISIONS 9.8 point 2): newest first, joined like one page (no card per note),
// each shown as rendered markdown and written in place with the block editor (NoteEditor); a new note starts from the
// type's template on top. Saving works like AFFiNE (use-note-autosave.ts): after a pause, with "Đã lưu" beside the
// note, and at once when the editor or the Sheet closes or the page goes; no "Lưu" or "Hủy".

/** Every note linked to the Item (all cursor pages, at most 20 of 100), newest first. */
const loadNotes = (item: number) => () =>
  loadAllPages<ApiNote>(
    () => notesApi.list({ item, limit: 100 }),
    (next) => api.page<ApiNote>(next),
  );

/** Loading notes at their geometry (D27): a date line and a few lines of text, twice. */
function NotesSkeleton() {
  const t = useT();
  return (
    <div className="flex flex-col divide-y" role="status" aria-busy="true" aria-label={t('Đang tải ghi chú')}>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 py-4 first:pt-0" aria-hidden>
          <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-full motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-4/5 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

/** A copy of unsaved text from an earlier visit (this browser): put it back, or drop it. */
export function RecoveredDraft({
  copy,
  onRestore,
  onDrop,
}: {
  copy: NoteBackup;
  onRestore: () => void;
  onDrop: () => void;
}) {
  const t = useT();
  return (
    <Alert>
      <History aria-hidden />
      <AlertTitle>{t('Có bản nháp chưa lưu trong trình duyệt này')}</AlertTitle>
      <AlertDescription>
        {t('Viết lúc {date}. Khôi phục sẽ thay nội dung đang có.', { date: formatDate(copy.at, t) })}
      </AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={onRestore}>
          {t('Khôi phục')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDrop}>
          {t('Bỏ bản nháp')}
        </Button>
      </AlertAction>
    </Alert>
  );
}

/**
 * One note written in place: its title (optional) and the block editor, saving by themselves, with "Xong" (or Escape,
 * or Cmd/Ctrl+Enter) to go back to reading. `note` null is a new note on `item`, created by its first save with
 * something written in it (an untouched template is not saved).
 */
function NoteInPlace({
  idBase,
  editorId,
  item,
  note,
  template,
  focusRequest,
  onSaved,
  onDone,
}: {
  idBase: string;
  /** The editable's id (`${idBase}-body` unless given). */
  editorId?: string;
  item: ApiItem;
  note: ApiNote | null;
  template: string;
  /** > 0 puts the cursor in the text once the editor is ready; a new value does it again. */
  focusRequest: number;
  onSaved: (note: ApiNote, created: boolean) => void;
  /** Back to reading; what is left unsaved is sent first. */
  onDone: () => void;
}) {
  const t = useT();
  // a new note is named after its Item (noteHeading hides that name under the Item's own title)
  const [title, setTitle] = useState(note?.title ?? item.title.slice(0, 300));
  const [markdown, setMarkdown] = useState(note?.markdown ?? template);
  // the editor opens with this text; a restored copy remounts it with that copy (`editorKey`)
  const [opening, setOpening] = useState(markdown);
  const [editorKey, setEditorKey] = useState(0);
  const editor = useRef<NoteEditorHandle | null>(null);
  const autosave = useNoteAutosave({
    note,
    template,
    items: () => [item.id],
    draftKey: `new-item-${item.id}`,
    onSaved,
    pull: () => editor.current?.markdown() ?? null,
  });

  const change = (next: { title?: string; markdown?: string }) => {
    const text = { title: next.title ?? title, markdown: next.markdown ?? markdown };
    if (next.title !== undefined) setTitle(next.title);
    if (next.markdown !== undefined) setMarkdown(next.markdown);
    autosave.change(text);
  };
  const done = () => {
    void autosave.flush();
    onDone();
  };
  const restore = () => {
    const copy = autosave.takeRecovered();
    if (!copy) return;
    setTitle(copy.title);
    setMarkdown(copy.markdown);
    setOpening(copy.markdown);
    setEditorKey((k) => k + 1);
  };

  return (
    // data-note-editing: an Escape inside ends this edit; the Sheet around the page leaves it alone (item-sheet.tsx)
    <div className="flex flex-col gap-2" data-note-editing="">
      {autosave.recovered && (
        <RecoveredDraft copy={autosave.recovered} onRestore={restore} onDrop={autosave.dropRecovered} />
      )}
      <Input
        id={`${idBase}-title`}
        value={title}
        maxLength={300}
        onChange={(e) => change({ title: e.target.value })}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            // the edit ends here: the Sheet around the page must not close too (see the editor's Escape)
            e.stopPropagation();
            done();
          }
        }}
        aria-label={t('Tiêu đề ghi chú (không bắt buộc)')}
        placeholder={t('Tiêu đề (không bắt buộc)')}
      />
      <NoteEditor
        key={editorKey}
        id={editorId ?? `${idBase}-body`}
        variant="inline"
        defaultMarkdown={opening}
        onChange={(md) => change({ markdown: md })}
        label={t('Nội dung ghi chú')}
        placeholder={t('Gõ / để chèn khối, hoặc viết luôn')}
        focusRequest={focusRequest + editorKey}
        caret={note || editorKey > 0 ? 'end' : 'first-empty'}
        selfNoteId={autosave.note?.id}
        onInput={autosave.touch}
        onReady={(handle) => {
          editor.current = handle;
        }}
        onEscape={done}
        onSubmit={done}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SaveStatus
          className="me-auto"
          state={autosave.state}
          error={autosave.error}
          onRetry={() => void autosave.flush()}
        />
        <Button type="button" variant="outline" size="sm" onClick={done}>
          <Check aria-hidden />
          {t('Xong')}
        </Button>
      </div>
    </div>
  );
}

export function ItemNotes({
  item,
  composeRequest,
  composerId,
  onCountChange,
}: {
  item: ApiItem;
  /** > 0 opens the composer and puts the cursor in it; each new value does it again ("Viết ghi chú" of the hint). */
  composeRequest: number;
  /** The composer's editable id (the Item dialog sends the focus there after "Viết ghi chú"). */
  composerId?: string;
  /** The note counts of `items` changed by `delta` (a note written here, or deleted with all its links). */
  onCountChange: (items: readonly number[], delta: number) => void;
}) {
  const t = useT();
  const base = useId();
  const headingId = `${base}-heading`;
  const composeButtonId = `${base}-compose`;
  const editButtonId = (id: number) => `${base}-note-${id}-edit`;
  const template = noteTemplateFor(item.type, t);

  const notes = useApi<Page<ApiNote>>(`item-notes:${item.id}`, loadNotes(item.id));
  const list = notes.data?.results ?? [];
  const loaded = notes.data !== undefined;

  // null until the user (or a request) opens or closes it; meanwhile an Item without notes shows it with the template,
  // without taking the focus
  const [composerOpen, setComposerOpen] = useState<boolean | null>(composeRequest > 0 ? true : null);
  const [composerFocus, setComposerFocus] = useState(composeRequest > 0 ? 1 : 0);
  // each opening of the composer is a new note (a new instance of NoteInPlace)
  const [composerKey, setComposerKey] = useState(0);
  const composerInstance = useRef(0);
  // the note the open composer created and goes on editing: not listed twice meanwhile
  const [composed, setComposed] = useState<number | null>(null);
  const [editing, setEditing] = useState<ReadonlySet<number>>(() => new Set());
  const [deleting, setDeleting] = useState<ApiNote | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // Closing an editor removes the focused control ("Xong", the editor): the focus waits on the section's heading
  // meanwhile, so the Sheet around the page does not take it back to its own start, then goes to `id` (the button that
  // came back) once React has drawn it. An editor that opens takes the focus itself when it is ready.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingFocus.current;
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
  });
  const focusAfter = (id: string | null) => {
    if (document.activeElement && document.activeElement !== document.body)
      document.getElementById(headingId)?.focus({ preventScroll: true });
    pendingFocus.current = id;
  };

  const showComposer = composerOpen ?? (loaded && list.length === 0);

  const openComposer = () => {
    setComposerOpen(true);
    setComposerFocus((n) => n + 1);
  };

  // "Viết ghi chú" asked again (the done hint, the Item dialog): open the composer, cursor in it
  const handledRequest = useRef(composeRequest);
  useEffect(() => {
    if (composeRequest === handledRequest.current) return;
    handledRequest.current = composeRequest;
    setComposerOpen(true);
    setComposerFocus((n) => n + 1);
  }, [composeRequest]);

  const say = (text: string) => setAnnouncement((prev) => (prev === text ? `${text} ` : text));

  /** A save of a note shown here: the list follows; a new note is listed and counted ("Đã lưu" says the rest). */
  const saved = (note: ApiNote, created: boolean, instance?: number) => {
    notes.mutate(
      (d) =>
        d && {
          ...d,
          results: created
            ? [note, ...d.results.filter((n) => n.id !== note.id)]
            : d.results.map((n) => (n.id === note.id ? note : n)),
        },
    );
    if (!created) return;
    // the composer goes on editing it (and stays open, also when it opened by itself on an Item without notes),
    // unless it was closed while the note was being created
    if (instance === composerInstance.current) {
      setComposed(note.id);
      setComposerOpen(true);
    }
    onCountChange([item.id], 1);
  };

  const closeComposer = () => {
    focusAfter(composeButtonId);
    composerInstance.current += 1;
    setComposerKey(composerInstance.current);
    setComposerOpen(false);
    setComposed(null);
  };

  const setNoteEditing = (id: number, on: boolean) => {
    if (!on) focusAfter(editButtonId(id));
    setEditing((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const shown = list.filter((n) => n.id !== composed);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center gap-2">
        {/* tabIndex -1: only a place for the focus to wait while an editor closes (focusAfter) */}
        <h2 id={headingId} tabIndex={-1} className="font-heading text-lg font-semibold tracking-tight outline-none">
          {t('Ghi chú', null, 'nav')}
        </h2>
        {loaded && <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>}
        {!showComposer && (
          <Button id={composeButtonId} variant="outline" size="sm" className="ms-auto" onClick={openComposer}>
            <Plus aria-hidden />
            {t('Viết ghi chú')}
          </Button>
        )}
      </div>

      {showComposer && (
        <NoteInPlace
          key={composerKey}
          idBase={`${base}-new`}
          editorId={composerId}
          item={item}
          note={null}
          template={template}
          focusRequest={composerFocus}
          onSaved={(note, created) => saved(note, created, composerKey)}
          onDone={closeComposer}
        />
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>

      {notes.error && !loaded ? (
        <ApiErrorState error={notes.error} onRetry={notes.reload} />
      ) : !loaded ? (
        <NotesSkeleton />
      ) : shown.length === 0 ? (
        !showComposer && <p className="text-sm text-muted-foreground">{t('Chưa có ghi chú nào.')}</p>
      ) : (
        <ul aria-label={t('Ghi chú của item')} className="flex flex-col divide-y">
          {shown.map((note) => {
            const isEditing = editing.has(note.id);
            const heading = noteHeading(note.title, item.title);
            const others = note.itemLabels.filter((l) => l.id !== item.id);
            const name = noteTitle(note, t);
            return (
              <li key={note.id} className="flex flex-col gap-2 py-5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {heading && !isEditing && (
                      <h3 className="font-heading text-[15px] leading-5 font-semibold break-words">{heading}</h3>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {noteDateLabel(note, t)}
                      {others.length > 0 &&
                        t.rich(' · cũng gắn với {items}', {
                          items: others.map((o, i) => (
                            <span key={o.id}>
                              {i > 0 && ', '}
                              <Link
                                href={linkHref('item', o.id)}
                                className="underline-offset-4 hover:text-foreground hover:underline"
                              >
                                {o.title}
                              </Link>
                            </span>
                          )),
                        })}
                    </p>
                  </div>
                  {!isEditing && (
                    <div className="-me-1.5 -mt-1 flex shrink-0 items-center">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              id={editButtonId(note.id)}
                              size="icon-sm"
                              variant="ghost"
                              aria-label={t('Sửa ghi chú “{title}”', { title: name })}
                              onClick={() => setNoteEditing(note.id, true)}
                            />
                          }
                        >
                          <Pencil aria-hidden />
                        </TooltipTrigger>
                        <TooltipPopup>{t('Sửa')}</TooltipPopup>
                      </Tooltip>
                      <RowMenu label={t('Thao tác cho ghi chú “{title}”', { title: name })}>
                        <MenuLinkItem render={<Link href={linkHref('note', note.id)} />}>
                          <NotebookPen aria-hidden />
                          {t('Mở ở trang Ghi chú')}
                        </MenuLinkItem>
                        <MenuSeparator />
                        <MenuItem variant="destructive" onClick={() => setDeleting(note)}>
                          <Trash2 aria-hidden />
                          {t('Xóa')}
                        </MenuItem>
                      </RowMenu>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <NoteInPlace
                    idBase={`${base}-edit-${note.id}`}
                    item={item}
                    note={note}
                    template=""
                    focusRequest={1}
                    onSaved={(n) => saved(n, false)}
                    onDone={() => setNoteEditing(note.id, false)}
                  />
                ) : (
                  <NoteBody markdown={note.markdown} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('Xóa ghi chú?')}
        description={
          deleting
            ? t('"{title}" bị xóa hẳn, cả ở các item khác nó gắn với. Không hoàn tác được.', {
                title: noteTitle(deleting, t),
              })
            : undefined
        }
        action={() => (deleting ? notesApi.delete(deleting.id) : Promise.resolve())}
        onDeleted={() => {
          if (!deleting) return;
          const gone = deleting.id;
          const at = shown.findIndex((n) => n.id === gone);
          const neighbour = shown[at + 1] ?? shown[at - 1];
          notes.mutate((d) => d && { ...d, results: d.results.filter((n) => n.id !== gone) });
          setEditing((s) => {
            const next = new Set(s);
            next.delete(gone);
            return next;
          });
          onCountChange(deleting.items, -1);
          say(t('Đã xóa ghi chú "{title}"', { title: noteTitle(deleting, t) }));
          // the deleted note's menu is gone: the next note's (or the composer's) button takes the focus
          focusAfter(neighbour ? editButtonId(neighbour.id) : composeButtonId);
        }}
      />
    </section>
  );
}
