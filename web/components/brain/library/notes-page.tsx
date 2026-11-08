'use client';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRoutePathname } from '@/lib/use-app-pathname';
import { NotebookPen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { notesApi, type ApiNote } from '@/lib/api/library';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { formatDate } from '@/lib/labels';
import { noteTitle } from '@/lib/library-labels';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MenuItem, MenuSeparator, MenuShortcut } from '@/components/ui/menu';
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiErrorState, ApiStaleAlert, describeApiError } from '../api-state';
import { ConfirmDelete, DeleteButton } from '../confirm-delete';
import { EmptyPanel, useToolbarState } from '../empty-panel';
import { KeyLegend } from '../key-legend';
import { PAGE_WIDTH } from '../layout';
import { RowMenu } from '../row-menu';
import { NoteDialog, type NoteDraft } from './note-dialog';
import type { ItemLabel } from './item-picker';
import { FilteredEmpty, RowsSkeleton, onRowClick } from './list-rows';
import { useItemIndex } from './use-item-index';

const PAGE = 50;

/** Starting text of the empty page's two template buttons (the outputs DECISIONS 4.2 asks of a book and a film). */
const templates = [
  { label: msg('Ghi chú sách'), markdown: msg('## Highlights\n\n- \n\n## 3 ý chính\n\n1. \n2. \n3. \n') },
  { label: msg('Nhận xét phim'), markdown: msg('## Một câu nhận xét\n\n') },
] as const;

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type ItemTitle = (id: number) => { title: string; type?: string };

/** Meta line of a note: linked Item titles as quiet links (each filters the list by that Item), then the date. */
function NoteMeta({ note, itemTitle, onNavigate }: { note: ApiNote; itemTitle: ItemTitle; onNavigate?: () => void }) {
  const t = useT();
  const edited = note.updatedAt.slice(0, 10) !== note.createdAt.slice(0, 10);
  const date = edited ? t('sửa {date}', { date: formatDate(note.updatedAt, t) }) : formatDate(note.createdAt, t);
  return (
    <>
      {note.items.length === 0
        ? t('Chưa liên kết item')
        : note.items.map((itemId, i) => (
            <Fragment key={itemId}>
              {i > 0 && ', '}
              <Link
                href={`/thu-vien/ghi-chu/?item=${itemId}`}
                title={t('Lọc ghi chú theo item này')}
                className="underline-offset-4 hover:text-foreground hover:underline"
                onClick={onNavigate}
              >
                {itemTitle(itemId).title}
              </Link>
            </Fragment>
          ))}
      {' · '}
      {date}
    </>
  );
}

function NoteRow({
  note,
  itemTitle,
  selected,
  onSelect,
  onOpen,
  onEdit,
  onDelete,
}: {
  note: ApiNote;
  itemTitle: ItemTitle;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const id = `note-${note.id}`;
  useEffect(() => {
    if (selected) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [selected, id]);

  return (
    // The keyboard cursor: neutral fill + aria-current (aria-selected is not allowed on a plain list item)
    <li
      id={id}
      aria-current={selected ? 'true' : undefined}
      data-selected={selected || undefined}
      className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-accent has-focus-visible:bg-accent data-selected:bg-accent"
      onClick={(e) => {
        onSelect();
        onRowClick(e, onOpen);
      }}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          className="max-w-full truncate rounded-sm text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          {noteTitle(note, t)}
        </button>
        <p className="truncate text-xs text-muted-foreground">
          <NoteMeta note={note} itemTitle={itemTitle} />
        </p>
      </div>
      <RowMenu>
        <MenuItem onClick={onEdit}>
          <Pencil aria-hidden />
          {t('Sửa')}
          <MenuShortcut>E</MenuShortcut>
        </MenuItem>
        <MenuSeparator />
        <MenuItem variant="destructive" onClick={onDelete}>
          <Trash2 aria-hidden />
          {t('Xóa')}
          <MenuShortcut>Del</MenuShortcut>
        </MenuItem>
      </RowMenu>
    </li>
  );
}

const keyHelp: [string, Msg][] = [
  ['J / K', msg('xuống / lên')],
  ['Enter', msg('đọc ghi chú')],
  ['E', msg('sửa')],
  ['Del', msg('xóa')],
  ['N', msg('ghi chú mới')],
  ['/', msg('tìm')],
  ['?', msg('bảng phím tắt này')],
];

/** Ghi chú: markdown notes linked to Items, search (?q) and filter by Item (?item), create and edit. */
export function NotesPage() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = useRoutePathname();
  const itemFilter = Number(params.get('item')) || null;

  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);
  const [cursor, setCursor] = useState(0);
  const [editing, setEditing] = useState<ApiNote | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // A new note's starting markdown (the empty page's templates); null = blank
  const [template, setTemplate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ApiNote | null>(null);
  // The note read in the Sheet; kept while the Sheet animates out
  const [reading, setReading] = useState<ApiNote | null>(null);
  const [readOpen, setReadOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // The full Item list is only for the picker in the dialog; the cards use the labels sent with each note.
  const index = useItemIndex(dialogOpen);
  const notes = useApi<Page<ApiNote>>(`notes:${q}:${itemFilter ?? ''}`, () =>
    notesApi.list({ limit: PAGE, ...(q && { q }), ...(itemFilter && { item: itemFilter }) }),
  );
  const shown = notes.loading ? [] : (notes.data?.results ?? []);
  const selected = Math.min(cursor, Math.max(0, shown.length - 1));
  const current = shown[selected];

  const labels = useMemo(() => {
    const m = new Map<number, ItemLabel>();
    for (const n of notes.data?.results ?? []) for (const l of n.itemLabels) m.set(l.id, l);
    for (const [id, it] of index.byId) m.set(id, it);
    return m;
  }, [notes.data, index.byId]);
  const itemTitle = useCallback(
    (id: number) => {
      const it = labels.get(id);
      return it ? { title: it.title, type: it.type } : { title: `Item #${id}` };
    },
    [labels],
  );
  const filterItem = itemFilter ? itemTitle(itemFilter) : null;

  const openEditor = useCallback((note: ApiNote | null, markdown: string | null = null) => {
    setEditing(note);
    setTemplate(markdown);
    setDialogOpen(true);
  }, []);
  /** Reading one note beside the list (DESIGN.md §6 Overlays: Sheet). */
  const openReader = useCallback((note: ApiNote) => {
    setReading(note);
    setReadOpen(true);
  }, []);
  // ?id=N (Cmd+K result): open that note in the reading Sheet, wherever it sits in the list.
  useOpenFromUrl('id', (id) =>
    notesApi.get(id).then(openReader, (err: unknown) => {
      const e = toApiError(err);
      setNotice(
        e.status === 404 && e.reachable
          ? t('Không tìm thấy ghi chú #{id}, có thể đã bị xóa.', { id })
          : describeApiError(e, t).title,
      );
    }),
  );
  /** Same rule as the backend filters (case-insensitive substring; item link). */
  const matches = (n: ApiNote) =>
    (!itemFilter || n.items.includes(itemFilter)) &&
    (!q || `${n.title}\n${n.markdown}`.toLowerCase().includes(q.toLowerCase()));

  const upsert = (saved: ApiNote, created: boolean) =>
    notes.mutate((d) => {
      if (!d) return d;
      const rest = d.results.filter((n) => n.id !== saved.id);
      if (!matches(saved)) return { ...d, results: rest };
      return {
        ...d,
        results: created ? [saved, ...rest] : d.results.map((n) => (n.id === saved.id ? saved : n)),
      };
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen || deleting || readOpen || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      // The key legend dialog, the reading Sheet and a row's overflow menu handle their own keys
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const act: Record<string, () => void> = {
        j: () => setCursor(Math.min(selected + 1, shown.length - 1)),
        arrowdown: () => setCursor(Math.min(selected + 1, shown.length - 1)),
        k: () => setCursor(Math.max(selected - 1, 0)),
        arrowup: () => setCursor(Math.max(selected - 1, 0)),
        n: () => openEditor(null),
        '/': () => searchRef.current?.focus(),
        ...(current && {
          e: () => openEditor(current),
          enter: () => openReader(current),
          // Del / Backspace delete, as on the week page (X there means "bỏ" an objective)
          delete: () => setDeleting(current),
          backspace: () => setDeleting(current),
        }),
      };
      const run = act[e.key.toLowerCase()];
      if (!run) return;
      // Enter on a focused button or link keeps its own meaning
      if (e.key === 'Enter' && (e.target as HTMLElement | null)?.closest('a,button')) return;
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, deleting, readOpen, selected, shown.length, current, openEditor, openReader]);

  const loadMore = async () => {
    const next = notes.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(notes);
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const itemsStatus = index.error
    ? t('Không tải được danh sách item: {error}', { error: describeApiError(index.error, t).title })
    : index.loading && index.items.length === 0
      ? t('Đang tải danh sách item…')
      : undefined;
  // The raw query counts too, so the search field never vanishes while its debounce runs
  const filtered = !!q || !!query.trim() || !!itemFilter;
  const failed = !!notes.error && !notes.data;
  const firstLoad = notes.loading && shown.length === 0;
  // The toolbar waits for a first note, a query or an Item filter (DESIGN.md §9a): with no notes the empty panel's
  // "Viết ghi chú" is the one primary (D2). The shared rule (empty-panel.tsx) reads the sidebar count meanwhile.
  const toolbar = useToolbarState({ rows: shown.length, filtered, loading: notes.loading, failed, count: 'notes' });
  const clearFilters = () => {
    setQuery('');
    setCursor(0);
    router.replace(pathname);
  };
  const newDraft: NoteDraft = { items: itemFilter ? [itemFilter] : [], ...(template && { markdown: template }) };

  return (
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6 px-4 pb-12 sm:px-8')}>
      {/* One toolbar row: search left, "Ghi chú mới" keeps the end of row 1 at 390 px (icon only there) */}
      {toolbar !== 'hide' && (
        <div className={cn('flex flex-wrap items-center gap-2', toolbar === 'wait' && 'invisible')}>
          <div className="relative min-w-0 flex-1 sm:w-80 sm:flex-none">
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              data-local-search
              type="search"
              aria-label={t('Tìm trong ghi chú')}
              placeholder={t('Tìm trong tiêu đề và nội dung…')}
              className="[&_input]:ps-8"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  if (query) setQuery('');
                  else e.currentTarget.blur();
                }
              }}
            />
          </div>
          {filterItem && (
            <div className="flex min-w-0 max-sm:order-last max-sm:basis-full">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-0"
                      aria-label={t('Item: {title}, bỏ lọc', { title: filterItem.title })}
                      onClick={() => router.replace(pathname)}
                    />
                  }
                >
                  Item: <span className="max-w-60 truncate">{filterItem.title}</span>
                  <X aria-hidden />
                </TooltipTrigger>
                <TooltipPopup>{t('Bỏ lọc theo item')}</TooltipPopup>
              </Tooltip>
            </div>
          )}
          <div className="ms-auto flex items-center gap-2">
            {shown.length > 0 && (
              <KeyLegend
                keys={keyHelp.map(([k, label]): [string, string] => [k, t(label)])}
                title={t('Phím tắt của Ghi chú')}
              />
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon"
                    className="sm:hidden"
                    aria-label={t('Ghi chú mới')}
                    onClick={() => openEditor(null)}
                  />
                }
              >
                <Plus aria-hidden />
              </TooltipTrigger>
              <TooltipPopup>{t('Ghi chú mới')}</TooltipPopup>
            </Tooltip>
            <Button className="max-sm:hidden" onClick={() => openEditor(null)}>
              <Plus aria-hidden />
              {t('Ghi chú mới')}
            </Button>
          </div>
        </div>
      )}

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={notes} />
      {failed && notes.error ? (
        <ApiErrorState error={notes.error} onRetry={notes.reload} />
      ) : firstLoad ? (
        <RowsSkeleton />
      ) : shown.length === 0 && filtered ? (
        <FilteredEmpty onClear={clearFilters}>{t('Không có ghi chú nào khớp bộ lọc.')}</FilteredEmpty>
      ) : shown.length === 0 ? (
        <EmptyPanel
          glyph={NotebookPen}
          title={t('Chưa có ghi chú nào')}
          text={t('Ghi lại điều đáng nhớ và gắn vào item.')}
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus aria-hidden />
              {t('Viết ghi chú')}
            </Button>
          }
          quick={templates.map((tpl) => (
            <Button
              key={tpl.label.msgid}
              variant="outline"
              size="sm"
              onClick={() => openEditor(null, t(tpl.markdown))}
            >
              <Plus aria-hidden />
              {t(tpl.label)}
            </Button>
          ))}
          guide={notes.error ? undefined : 'library'}
        />
      ) : (
        <ul aria-label={t('Ghi chú', null, 'nav')} className="divide-y overflow-hidden rounded-xl border bg-card">
          {shown.map((n, i) => (
            <NoteRow
              key={n.id}
              note={n}
              itemTitle={itemTitle}
              selected={i === selected}
              onSelect={() => setCursor(i)}
              onOpen={() => openReader(n)}
              onEdit={() => openEditor(n)}
              onDelete={() => setDeleting(n)}
            />
          ))}
        </ul>
      )}
      {notes.data?.next && !notes.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          {t('Tải thêm')}
        </Button>
      )}

      <Sheet open={readOpen} onOpenChange={setReadOpen}>
        <SheetPopup className="max-w-2xl" closeProps={{ 'aria-label': t('Đóng') }}>
          {reading && (
            <>
              <SheetHeader>
                <SheetTitle className="pe-8 leading-tight">{noteTitle(reading, t)}</SheetTitle>
                <SheetDescription render={<div />} className="text-xs">
                  <NoteMeta note={reading} itemTitle={itemTitle} onNavigate={() => setReadOpen(false)} />
                </SheetDescription>
              </SheetHeader>
              <SheetPanel>
                {/* Plain text on purpose: markdown is shown as typed, never parsed into HTML. */}
                <p className="max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed">{reading.markdown}</p>
              </SheetPanel>
              <SheetFooter>
                <DeleteButton
                  size="sm"
                  className="sm:me-auto"
                  onClick={() => {
                    setReadOpen(false);
                    setDeleting(reading);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReadOpen(false);
                    openEditor(reading);
                  }}
                >
                  <Pencil aria-hidden />
                  {t('Sửa')}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetPopup>
      </Sheet>

      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('Xóa ghi chú?')}
        description={
          deleting
            ? t('"{title}" bị xóa hẳn. Item liên kết vẫn giữ nguyên. Không hoàn tác được.', {
                title: noteTitle(deleting, t),
              })
            : undefined
        }
        action={() => (deleting ? notesApi.delete(deleting.id) : Promise.resolve())}
        onDeleted={() => {
          if (!deleting) return;
          const gone = deleting.id;
          notes.mutate((d) => d && { ...d, results: d.results.filter((n) => n.id !== gone) });
          setNotice(t('Đã xóa "{title}"', { title: noteTitle(deleting, t) }));
        }}
      />

      <NoteDialog
        open={dialogOpen}
        note={editing}
        draft={editing ? undefined : newDraft}
        items={index.items}
        byId={labels}
        itemsStatus={itemsStatus}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          upsert(saved, created);
          setReading((r) => (r && r.id === saved.id ? saved : r));
          setDialogOpen(false);
          setNotice(
            created
              ? t('Đã tạo "{title}"', { title: noteTitle(saved, t) })
              : t('Đã lưu "{title}"', { title: noteTitle(saved, t) }),
          );
          if (created) setCursor(0);
        }}
      />
    </div>
  );
}
