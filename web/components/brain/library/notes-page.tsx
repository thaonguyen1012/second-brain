'use client';
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRoutePathname } from '@/lib/use-app-pathname';
import { NotebookPen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api, type ApiItem, type Page } from '@/lib/api/client';
import { notesApi, type ApiNote } from '@/lib/api/library';
import { loadAllPages } from '@/lib/api/pages';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { itemPicture } from '@/lib/handbook-picture';
import { groupNotesByItem, noteDateLabel, noteHeading, type NoteGroup } from '@/lib/item-notes';
import { itemTypeLabel } from '@/lib/labels';
import { noteTitle } from '@/lib/library-labels';
import { useListView } from '@/lib/use-board-view';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MenuItem, MenuSeparator, MenuShortcut } from '@/components/ui/menu';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiErrorState, ApiStaleAlert, describeApiError } from '../api-state';
import { ConfirmDelete } from '../confirm-delete';
import { EmptyPanel, useToolbarState } from '../empty-panel';
import { KeyLegend } from '../key-legend';
import { PAGE_WIDTH } from '../layout';
import { RowMenu } from '../row-menu';
import { RowPicture } from './item-image';
import { NewNoteCopyHints } from './save-status';
import type { ItemLabel } from './item-picker';
import { FilteredEmpty, RowsSkeleton, onRowClick } from './list-rows';
import { useItemIndex } from './use-item-index';

const PAGE = 50;

/** Starting text of the empty page's two template buttons (the outputs DECISIONS 4.2 asks of a book and a film). */
const templates = [
  { label: msg('Ghi chú sách'), type: 'book' },
  { label: msg('Nhận xét phim'), type: 'film' },
] as const;

type NotesView = 'list' | 'items';

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

/** A row's title: the note's own, except one that only repeats its group's Item (then its first line). */
function rowTitle(note: ApiNote, groupTitle: string | null, t: T): string {
  if (groupTitle === null || noteHeading(note.title, groupTitle) !== null) return noteTitle(note, t);
  return noteTitle({ ...note, title: '' }, t);
}

/**
 * Meta line of a note: linked Item titles as quiet links (each filters the list by that Item), then the date. Under a
 * group of "Theo item" (`group`: its Item, or null for "Ghi chú rời") the group's own Item is not repeated.
 */
function NoteMeta({
  note,
  itemTitle,
  onNavigate,
  group,
}: {
  note: ApiNote;
  itemTitle: ItemTitle;
  onNavigate?: () => void;
  group?: number | null;
}) {
  const t = useT();
  const date = noteDateLabel(note, t);
  const items = note.items.filter((id) => id !== group);
  if (group !== undefined && items.length === 0) return <>{date}</>;
  return (
    <>
      {items.length === 0
        ? t('Chưa liên kết item')
        : items.map((itemId, i) => (
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
  group,
  selected = false,
  onSelect,
  onOpen,
  onEdit,
  onDelete,
}: {
  note: ApiNote;
  itemTitle: ItemTitle;
  /** The "Theo item" group the row sits in (its Item, or null for "Ghi chú rời"). */
  group?: number | null;
  /** The keyboard cursor of the list view (the grouped view has none: a note may show in two groups). */
  selected?: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const id = onSelect ? `note-${note.id}` : undefined;
  const title = rowTitle(note, group === undefined || group === null ? null : itemTitle(group).title, t);
  useEffect(() => {
    if (selected && id) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [selected, id]);

  return (
    // The keyboard cursor: neutral fill + aria-current (aria-selected is not allowed on a plain list item)
    <li
      id={id}
      aria-current={selected ? 'true' : undefined}
      data-selected={selected || undefined}
      className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-accent has-focus-visible:bg-accent data-selected:bg-accent"
      onClick={(e) => {
        onSelect?.();
        onRowClick(e, onOpen);
      }}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          className="max-w-full truncate rounded-sm text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          {title}
        </button>
        <p className="truncate text-xs text-muted-foreground">
          <NoteMeta note={note} itemTitle={itemTitle} group={group} />
        </p>
      </div>
      <RowMenu label={t('Thao tác cho ghi chú “{title}”', { title })}>
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

/**
 * One group of the "Theo item" view (DECISIONS 9.8 point 5): the Item's picture and title head the group (a link to
 * the Item page), its notes follow as the usual rows; `item: null` is "Ghi chú rời". One container per group (D12),
 * the picture flush at the start of the heading row like a Thư viện row.
 */
function NoteGroupSection({
  group,
  item,
  label,
  withPicture,
  itemTitle,
  onOpen,
  onEdit,
  onDelete,
}: {
  group: NoteGroup<ApiNote>;
  /** The whole Item (its picture), once the Item list has loaded. */
  item: ApiItem | undefined;
  /** Its title and type from the notes' labels meanwhile. */
  label: { title: string; type?: string };
  withPicture: boolean;
  itemTitle: ItemTitle;
  onOpen: (note: ApiNote) => void;
  onEdit: (note: ApiNote) => void;
  onDelete: (note: ApiNote) => void;
}) {
  const t = useT();
  const headingId = useId();
  const loose = group.item === null;
  const type = item?.type ?? label.type;
  const meta = [!loose && type && t(itemTypeLabel(type)), t('{n} ghi chú', { n: group.notes.length })]
    .filter(Boolean)
    .join(' · ');
  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border bg-card">
      <div className={cn('flex min-h-14 items-center gap-3 py-2', withPicture ? 'pe-3' : 'px-3')}>
        {withPicture && <RowPicture picture={item ? itemPicture(item) : null} />}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="truncate text-sm font-semibold">
            {loose ? (
              t('Ghi chú rời')
            ) : (
              <Link
                href={`/thu-vien/item/?id=${group.item}`}
                className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label.title}
              </Link>
            )}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        </div>
      </div>
      <ul aria-labelledby={headingId} className="divide-y border-t">
        {group.notes.map((n) => (
          <NoteRow
            key={n.id}
            note={n}
            itemTitle={itemTitle}
            group={group.item}
            onOpen={() => onOpen(n)}
            onEdit={() => onEdit(n)}
            onDelete={() => onDelete(n)}
          />
        ))}
      </ul>
    </section>
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

/**
 * Ghi chú: markdown notes linked to Items, search (?q) and filter by Item (?item), create and edit. Two views: the
 * list (newest first, "Tải thêm") and "Theo item" (`?view=items`, DECISIONS 9.8 point 5): every matching note grouped
 * under its Items.
 */
export function NotesPage() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = useRoutePathname();
  const itemFilter = Number(params.get('item')) || null;
  // A remembered "Theo item" waits until ?id= is gone (useBoardView's rule): the note page is on this route too.
  const [view, setView] = useListView<'items'>('alex-brain:notes-view', 'items', 'id');

  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);
  const [cursor, setCursor] = useState(0);
  const [deleting, setDeleting] = useState<ApiNote | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // The full Item list is for the pictures of "Theo item"; rows use the labels sent with the notes.
  const index = useItemIndex(view === 'items');
  const filters = { ...(q && { q }), ...(itemFilter && { item: itemFilter }) };
  const listNotes = useApi<Page<ApiNote>>(view === 'list' ? `notes:${q}:${itemFilter ?? ''}` : null, () =>
    notesApi.list({ limit: PAGE, ...filters }),
  );
  // "Theo item" groups every matching note at once (all cursor pages, at most 20 of 100)
  const allNotes = useApi<Page<ApiNote>>(view === 'items' ? `notes-all:${q}:${itemFilter ?? ''}` : null, () =>
    loadAllPages<ApiNote>(
      () => notesApi.list({ limit: 100, ...filters }),
      (next) => api.page<ApiNote>(next),
    ),
  );
  const notes = view === 'list' ? listNotes : allNotes;
  const shown = useMemo(() => (notes.loading ? [] : (notes.data?.results ?? [])), [notes.loading, notes.data]);
  const selected = Math.min(cursor, Math.max(0, shown.length - 1));
  // the keyboard cursor belongs to the list (a note may show in two groups)
  const current = view === 'list' ? shown[selected] : undefined;
  // filtered by an Item, only that Item's group: its notes' other Items were filtered out
  const groups = useMemo(
    () =>
      view === 'items'
        ? groupNotesByItem(shown).filter((g) => itemFilter === null || g.item === itemFilter)
        : [],
    [view, shown, itemFilter],
  );
  const groupPictures = groups.some((g) => {
    const it = g.item === null ? undefined : index.byId.get(g.item);
    return !!it && itemPicture(it) !== null;
  });

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

  /**
   * A note opens as its own page (`?id=N`, notes-route.tsx), where it is read and edited; a new one too (`?id=new`,
   * with the Item filter and a template). The browser's own path keeps a page opened at /en/... in English.
   */
  const notePath = useCallback(
    (query: string) => `${pathname.endsWith('/') ? pathname : `${pathname}/`}?${query}`,
    [pathname],
  );
  const openNote = useCallback((note: ApiNote) => router.push(notePath(`id=${note.id}`)), [router, notePath]);
  const newNote = useCallback(
    (template?: string) =>
      router.push(
        notePath(['id=new', itemFilter && `item=${itemFilter}`, template && `template=${template}`].filter(Boolean).join('&')),
      ),
    [router, notePath, itemFilter],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (deleting || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      // The key legend dialog and a row's overflow menu handle their own keys
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const act: Record<string, () => void> = {
        ...(view === 'list' && {
          j: () => setCursor(Math.min(selected + 1, shown.length - 1)),
          arrowdown: () => setCursor(Math.min(selected + 1, shown.length - 1)),
          k: () => setCursor(Math.max(selected - 1, 0)),
          arrowup: () => setCursor(Math.max(selected - 1, 0)),
        }),
        n: () => newNote(),
        '/': () => searchRef.current?.focus(),
        ...(current && {
          e: () => openNote(current),
          enter: () => openNote(current),
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
  }, [deleting, selected, shown.length, current, openNote, newNote, view]);

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

  // The raw query counts too, so the search field never vanishes while its debounce runs
  const filtered = !!q || !!query.trim() || !!itemFilter;
  const failed = !!notes.error && !notes.data;
  const firstLoad = notes.loading && shown.length === 0;
  // The toolbar waits for a first note, a query or an Item filter (DESIGN.md §9a): with no notes the empty panel's
  // "Viết ghi chú" is the one primary (D2). The shared rule (empty-panel.tsx) reads the sidebar count meanwhile.
  const toolbar = useToolbarState({ rows: shown.length, filtered, loading: notes.loading, failed, count: 'notes' });
  /** The address without `?item=` (and without ?id=), the view kept. */
  const withoutItem = () => {
    const path = pathname.endsWith('/') ? pathname : `${pathname}/`; // trailingSlash: true (next.config)
    return view === 'items' ? `${path}?view=items` : path;
  };
  const clearItemFilter = () => router.replace(withoutItem(), { scroll: false });
  const clearFilters = () => {
    setQuery('');
    setCursor(0);
    router.replace(withoutItem(), { scroll: false });
  };

  return (
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6 px-4 pb-12 sm:px-8')}>
      {/* One toolbar row: the view switch first, search, "Ghi chú mới" at the end; at 390 px the switch and the
          (icon-only) "Ghi chú mới" keep row 1 and the search takes row 2, so no button is orphaned (DESIGN.md §6) */}
      {toolbar !== 'hide' && (
        <div className={cn('flex flex-wrap items-center gap-2', toolbar === 'wait' && 'invisible')}>
          <Tabs value={view} onValueChange={(v) => setView(v as NotesView)}>
            <TabsList aria-label={t('Kiểu xem')}>
              <TabsTab value="list">{t('Danh sách')}</TabsTab>
              <TabsTab value="items">{t('Theo item')}</TabsTab>
            </TabsList>
          </Tabs>
          <div className="relative min-w-0 max-sm:order-last max-sm:basis-full sm:w-72">
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
                      onClick={clearItemFilter}
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
            {view === 'list' && shown.length > 0 && (
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
                    onClick={() => newNote()}
                  />
                }
              >
                <Plus aria-hidden />
              </TooltipTrigger>
              <TooltipPopup>{t('Ghi chú mới')}</TooltipPopup>
            </Tooltip>
            <Button className="max-sm:hidden" onClick={() => newNote()}>
              <Plus aria-hidden />
              {t('Ghi chú mới')}
            </Button>
          </div>
        </div>
      )}

      {/* a new note's text that never reached the server (at ?id=new, or for an Item): its page offers it back */}
      <NewNoteCopyHints onOpen={(query) => router.push(notePath(query))} />

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
            <Button onClick={() => newNote()}>
              <Plus aria-hidden />
              {t('Viết ghi chú')}
            </Button>
          }
          quick={templates.map((tpl) => (
            <Button
              key={tpl.label.msgid}
              variant="outline"
              size="sm"
              onClick={() => newNote(tpl.type)}
            >
              <Plus aria-hidden />
              {t(tpl.label)}
            </Button>
          ))}
          guide={notes.error ? undefined : 'library'}
        />
      ) : view === 'items' ? (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <NoteGroupSection
              key={g.item ?? 'loose'}
              group={g}
              item={g.item === null ? undefined : index.byId.get(g.item)}
              label={g.item === null ? { title: t('Ghi chú rời') } : itemTitle(g.item)}
              withPicture={groupPictures}
              itemTitle={itemTitle}
              onOpen={openNote}
              onEdit={openNote}
              onDelete={setDeleting}
            />
          ))}
        </div>
      ) : (
        <ul aria-label={t('Ghi chú', null, 'nav')} className="divide-y overflow-hidden rounded-xl border bg-card">
          {shown.map((n, i) => (
            <NoteRow
              key={n.id}
              note={n}
              itemTitle={itemTitle}
              selected={i === selected}
              onSelect={() => setCursor(i)}
              onOpen={() => openNote(n)}
              onEdit={() => openNote(n)}
              onDelete={() => setDeleting(n)}
            />
          ))}
        </ul>
      )}
      {view === 'list' && notes.data?.next && !notes.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          {t('Tải thêm')}
        </Button>
      )}

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
    </div>
  );
}
