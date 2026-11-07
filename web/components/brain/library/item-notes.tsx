'use client';
import { useEffect, useId, useRef, useState, type Ref } from 'react';
import Link from 'next/link';
import { Loader2, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, type ApiItem, type Page } from '@/lib/api/client';
import { notesApi, type ApiNote } from '@/lib/api/library';
import { loadAllPages } from '@/lib/api/pages';
import { toApiError, useApi } from '@/lib/api/use-api';
import { MAX_MARKDOWN, changedFromTemplate, noteDateLabel, noteHeading } from '@/lib/item-notes';
import { fieldErrors } from '@/lib/labels';
import { noteTitle } from '@/lib/library-labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MenuItem, MenuLinkItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiErrorState, describeApiError } from '../api-state';
import { ConfirmDelete } from '../confirm-delete';
import { RowMenu } from '../row-menu';
import { SaveKeys } from '../save-keys';
import { DiscardChanges } from './discard-changes';
import { noteTemplateFor } from './done-output';
import { NoteBody } from './note-body';
import { NoteTextEditor } from './note-text-editor';

// Every note of one Item on its page (DECISIONS 9.8 point 2): newest first, joined like one page (no card per note),
// each shown as rendered markdown and edited in place; a composer on top starts from the type's template. Saving works
// like NoteDialog (an explicit "Lưu", Cmd/Ctrl+Enter); unsaved text is reported up (onDirtyChange) so the Sheet and the
// page ask before it goes. The block editor (after the owner picks it) replaces NoteTextEditor only.

const FIELD_NAMES: Record<string, string> = { title: 'Tiêu đề', markdown: 'Nội dung', items: 'Item' };

interface Draft {
  title: string;
  markdown: string;
}

interface EditState extends Draft {
  busy: boolean;
  error: string | null;
}

/** Every note linked to the Item (all cursor pages, at most 20 of 100), newest first. */
const loadNotes = (item: number) => () =>
  loadAllPages<ApiNote>(
    () => notesApi.list({ item, limit: 100 }),
    (next) => api.page<ApiNote>(next),
  );

/** Why a draft cannot be saved yet, before any request; null when it can. */
function draftProblem(draft: Draft, template: string): string | null {
  if (!draft.markdown.trim()) return 'Ghi chú cần có nội dung.';
  if (template && !changedFromTemplate(draft.markdown, template)) return 'Viết vài dòng vào mẫu trước khi lưu.';
  if (draft.markdown.length > MAX_MARKDOWN) return `Nội dung dài quá ${MAX_MARKDOWN.toLocaleString('vi-VN')} ký tự.`;
  return null;
}

function saveError(err: unknown): string {
  const e = toApiError(err);
  return (e.status === 400 && fieldErrors(e.body, FIELD_NAMES)) || describeApiError(e).title;
}

/** Title (optional) and markdown of one note, with Hủy and Lưu: the composer and the in-place edit share it. */
function InlineNoteForm({
  idBase,
  draft,
  onDraft,
  busy,
  error,
  saveLabel,
  onSave,
  onCancel,
  textareaRef,
}: {
  idBase: string;
  draft: Draft;
  onDraft: (draft: Draft) => void;
  busy: boolean;
  error: string | null;
  saveLabel: string;
  onSave: () => void;
  onCancel: () => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      // the title field's keys (the textarea handles its own)
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSave();
        } else if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <Input
        id={`${idBase}-title`}
        value={draft.title}
        maxLength={300}
        onChange={(e) => onDraft({ ...draft, title: e.target.value })}
        aria-label="Tiêu đề ghi chú (không bắt buộc)"
        placeholder="Tiêu đề (không bắt buộc)"
      />
      <NoteTextEditor
        id={`${idBase}-body`}
        value={draft.markdown}
        onChange={(markdown) => onDraft({ ...draft, markdown })}
        label="Nội dung ghi chú"
        placeholder="Viết bằng markdown: ## tiêu đề, - danh sách, - [ ] việc cần làm"
        onSave={onSave}
        onCancel={onCancel}
        textareaRef={textareaRef}
      />
      {error && (
        <p className="text-sm whitespace-pre-line text-destructive-foreground" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <span className="me-auto text-xs text-muted-foreground max-sm:hidden pointer-coarse:hidden">
          <SaveKeys /> để lưu
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}

/** Loading notes at their geometry (D27): a date line and a few lines of text, twice. */
function NotesSkeleton() {
  return (
    <div className="flex flex-col divide-y" role="status" aria-busy="true" aria-label="Đang tải ghi chú">
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


export function ItemNotes({
  item,
  composeRequest,
  composerRef,
  onCountChange,
  onDirtyChange,
}: {
  item: ApiItem;
  /** > 0 opens the composer and focuses it; each new value does it again ("Viết ghi chú" of the done hint). */
  composeRequest: number;
  /** The composer's textarea (the Sheet opened from "Viết ghi chú" focuses it first). */
  composerRef?: Ref<HTMLTextAreaElement>;
  /** The Item's note count changed by `delta` (a note written or deleted here). */
  onCountChange: (delta: number) => void;
  /** Whether some note text here is not saved yet. */
  onDirtyChange: (dirty: boolean) => void;
}) {
  const base = useId();
  const headingId = `${base}-heading`;
  const composeButtonId = `${base}-compose`;
  const editButtonId = (id: number) => `${base}-note-${id}-edit`;
  const template = noteTemplateFor(item.type);
  const freshDraft = (): Draft => ({ title: item.title.slice(0, 300), markdown: template });

  const notes = useApi<Page<ApiNote>>(`item-notes:${item.id}`, loadNotes(item.id));
  const list = notes.data?.results ?? [];
  const loaded = notes.data !== undefined;

  // null until the user (or a request) opens or closes it; then an Item without notes opens it with the template
  const [composerOpen, setComposerOpen] = useState<boolean | null>(composeRequest > 0 ? true : null);
  const [draft, setDraft] = useState<Draft>(freshDraft);
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [edits, setEdits] = useState<ReadonlyMap<number, EditState>>(() => new Map());
  const [deleting, setDeleting] = useState<ApiNote | null>(null);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const composerId = `${base}-new-body`;

  const showComposer = composerOpen ?? (loaded && list.length === 0);
  const composerDirty = showComposer && (draft.title !== freshDraft().title || changedFromTemplate(draft.markdown, template));
  const editDirty = (note: ApiNote, edit: EditState) => edit.title !== note.title || edit.markdown !== note.markdown;
  const dirty = composerDirty || list.some((n) => {
    const e = edits.get(n.id);
    return !!e && editDirty(n, e);
  });

  const reportDirty = useRef(onDirtyChange);
  useEffect(() => {
    reportDirty.current = onDirtyChange;
  });
  useEffect(() => reportDirty.current(dirty), [dirty]);
  // gone with the page: nothing left unsaved here
  useEffect(() => () => reportDirty.current(false), []);

  // "Viết ghi chú" asked again (the done hint): open the composer and put the cursor in it
  const handledRequest = useRef(composeRequest);
  useEffect(() => {
    if (composeRequest === handledRequest.current) return;
    handledRequest.current = composeRequest;
    setComposerOpen(true);
    // the composer may be open already (no re-render then): focus it on the next frame
    window.requestAnimationFrame(() => document.getElementById(composerId)?.focus());
  }, [composeRequest, composerId]);

  const say = (text: string) => setAnnouncement((prev) => (prev === text ? `${text} ` : text));

  // A form that closes takes the focused field with it: the focus waits on the section's heading (so the Sheet around
  // the page does not take it back to its start), then goes to the button that comes back (`Viết ghi chú`, a note's
  // pencil) once React has drawn it.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingFocus.current;
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
  });
  const focusAfter = (id: string) => {
    if (document.activeElement && document.activeElement !== document.body)
      document.getElementById(headingId)?.focus({ preventScroll: true });
    pendingFocus.current = id;
  };

  /** Runs `action` at once, or after "Bỏ thay đổi" when it would drop typed text. */
  const unlessDirty = (isDirty: boolean, action: () => void) => (isDirty ? setDiscard(() => action) : action());

  const closeComposer = () => {
    focusAfter(composeButtonId);
    setComposerOpen(false);
    setDraft(freshDraft());
    setComposeError(null);
  };

  const create = async () => {
    if (composeBusy) return;
    const problem = draftProblem(draft, template);
    if (problem) return setComposeError(problem);
    setComposeBusy(true);
    setComposeError(null);
    try {
      const saved = await notesApi.create({ title: draft.title.trim(), markdown: draft.markdown, items: [item.id] });
      notes.mutate((d) => d && { ...d, results: [saved, ...d.results.filter((n) => n.id !== saved.id)] });
      onCountChange(1);
      focusAfter(composeButtonId);
      setComposerOpen(false);
      setDraft(freshDraft());
      say(`Đã lưu ghi chú "${noteTitle(saved)}"`);
    } catch (err) {
      setComposeError(saveError(err));
    } finally {
      setComposeBusy(false);
    }
  };

  const setEdit = (id: number, next: EditState | null) =>
    setEdits((m) => {
      const copy = new Map(m);
      if (next) copy.set(id, next);
      else copy.delete(id);
      return copy;
    });

  const startEdit = (note: ApiNote) => {
    setEdit(note.id, { title: note.title, markdown: note.markdown, busy: false, error: null });
    // the cursor at the end of the text, ready to add to it
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`${base}-edit-${note.id}-body`);
      if (el instanceof HTMLTextAreaElement) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  };

  const stopEdit = (id: number) => {
    focusAfter(editButtonId(id));
    setEdit(id, null);
  };

  const saveEdit = async (note: ApiNote) => {
    const edit = edits.get(note.id);
    if (!edit || edit.busy) return;
    const problem = draftProblem(edit, '');
    if (problem) return setEdit(note.id, { ...edit, error: problem });
    if (!editDirty(note, edit)) return stopEdit(note.id);
    setEdit(note.id, { ...edit, busy: true, error: null });
    try {
      // links to other Items stay as they are: only title and text are sent
      const saved = await notesApi.update(note.id, { title: edit.title.trim(), markdown: edit.markdown });
      notes.mutate((d) => d && { ...d, results: d.results.map((n) => (n.id === saved.id ? saved : n)) });
      say(`Đã lưu ghi chú "${noteTitle(saved)}"`);
      stopEdit(note.id);
    } catch (err) {
      setEdit(note.id, { ...edit, busy: false, error: saveError(err) });
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center gap-2">
        {/* tabIndex -1: only a place for the focus to wait while a form closes (focusAfter) */}
        <h2 id={headingId} tabIndex={-1} className="font-heading text-lg font-semibold tracking-tight outline-none">
          Ghi chú
        </h2>
        {loaded && <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>}
        {!showComposer && (
          <Button id={composeButtonId} variant="outline" size="sm" className="ms-auto" onClick={() => setComposerOpen(true)}>
            <Plus aria-hidden />
            Viết ghi chú
          </Button>
        )}
      </div>

      {showComposer && (
        <InlineNoteForm
          idBase={`${base}-new`}
          draft={draft}
          onDraft={setDraft}
          busy={composeBusy}
          error={composeError}
          saveLabel="Lưu ghi chú"
          onSave={() => void create()}
          onCancel={() => unlessDirty(composerDirty, closeComposer)}
          textareaRef={composerRef}
        />
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>

      {notes.error && !loaded ? (
        <ApiErrorState error={notes.error} onRetry={notes.reload} />
      ) : !loaded ? (
        <NotesSkeleton />
      ) : list.length === 0 ? (
        !showComposer && <p className="text-sm text-muted-foreground">Chưa có ghi chú nào.</p>
      ) : (
        <ul aria-label="Ghi chú của item" className="flex flex-col divide-y">
          {list.map((note) => {
            const edit = edits.get(note.id);
            const heading = noteHeading(note.title, item.title);
            const others = note.itemLabels.filter((l) => l.id !== item.id);
            const name = noteTitle(note);
            return (
              <li key={note.id} className="flex flex-col gap-2 py-5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {heading && !edit && (
                      <h3 className="font-heading text-[15px] leading-5 font-semibold break-words">{heading}</h3>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {noteDateLabel(note)}
                      {others.length > 0 && (
                        <>
                          {' · cũng gắn với '}
                          {others.map((o, i) => (
                            <span key={o.id}>
                              {i > 0 && ', '}
                              <Link
                                href={`/thu-vien/item/?id=${o.id}`}
                                className="underline-offset-4 hover:text-foreground hover:underline"
                              >
                                {o.title}
                              </Link>
                            </span>
                          ))}
                        </>
                      )}
                    </p>
                  </div>
                  {!edit && (
                    <div className="-me-1.5 -mt-1 flex shrink-0 items-center">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              id={editButtonId(note.id)}
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Sửa ghi chú “${name}”`}
                              onClick={() => startEdit(note)}
                            />
                          }
                        >
                          <Pencil aria-hidden />
                        </TooltipTrigger>
                        <TooltipPopup>Sửa</TooltipPopup>
                      </Tooltip>
                      <RowMenu label={`Thao tác cho ghi chú “${name}”`}>
                        <MenuLinkItem render={<Link href={`/thu-vien/ghi-chu/?id=${note.id}`} />}>
                          <NotebookPen aria-hidden />
                          Mở ở trang Ghi chú
                        </MenuLinkItem>
                        <MenuSeparator />
                        <MenuItem variant="destructive" onClick={() => setDeleting(note)}>
                          <Trash2 aria-hidden />
                          Xóa
                        </MenuItem>
                      </RowMenu>
                    </div>
                  )}
                </div>
                {edit ? (
                  <InlineNoteForm
                    idBase={`${base}-edit-${note.id}`}
                    draft={edit}
                    onDraft={(d) => setEdit(note.id, { ...edit, ...d })}
                    busy={edit.busy}
                    error={edit.error}
                    saveLabel="Lưu"
                    onSave={() => void saveEdit(note)}
                    onCancel={() => unlessDirty(editDirty(note, edit), () => stopEdit(note.id))}
                  />
                ) : (
                  <NoteBody markdown={note.markdown} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <DiscardChanges
        open={discard !== null}
        onKeep={() => setDiscard(null)}
        onDiscard={() => {
          const action = discard;
          setDiscard(null);
          action?.();
        }}
      />
      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa ghi chú?"
        description={
          deleting
            ? `"${noteTitle(deleting)}" bị xóa hẳn, cả ở các item khác nó gắn với. Không hoàn tác được.`
            : undefined
        }
        action={() => (deleting ? notesApi.delete(deleting.id) : Promise.resolve())}
        onDeleted={() => {
          if (!deleting) return;
          const gone = deleting.id;
          const at = list.findIndex((n) => n.id === gone);
          const neighbour = list[at + 1] ?? list[at - 1];
          notes.mutate((d) => d && { ...d, results: d.results.filter((n) => n.id !== gone) });
          setEdit(gone, null);
          onCountChange(-1);
          say(`Đã xóa ghi chú "${noteTitle(deleting)}"`);
          // the deleted note's menu is gone: the next note's (or the composer's) button takes the focus
          focusAfter(neighbour ? editButtonId(neighbour.id) : composeButtonId);
        }}
      />
    </section>
  );
}
