'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { NotebookPen, Pencil, Plus, Search, X } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { notesApi, type ApiNote } from '@/lib/api/library';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { formatDate, itemTypeLabel } from '@/lib/labels';
import { noteTitle } from '@/lib/library-labels';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError } from '../api-state';
import { BrainCard } from '../brain-card';
import { ConfirmDelete, DeleteButton } from '../confirm-delete';
import { NoteDialog } from './note-dialog';
import type { ItemLabel } from './item-picker';
import { useItemIndex } from './use-item-index';

const PAGE = 50;
/** Notes longer than this start collapsed. */
const LONG_CHARS = 600;
const LONG_LINES = 8;

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

const isLong = (md: string) => md.length > LONG_CHARS || md.split('\n').length > LONG_LINES;

function NoteCard({
  note,
  itemTitle,
  selected,
  expanded,
  onSelect,
  onEdit,
  onToggle,
  onDelete,
}: {
  note: ApiNote;
  itemTitle: (id: number) => { title: string; type?: string };
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const id = `note-${note.id}`;
  const long = isLong(note.markdown);
  useEffect(() => {
    if (selected) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [selected, id]);
  const edited = note.updatedAt.slice(0, 10) !== note.createdAt.slice(0, 10);

  return (
    <BrainCard
      id={id}
      selected={selected}
      onClick={onSelect}
      badges={
        note.items.length === 0 ? (
          <Badge variant="secondary">Chưa liên kết item</Badge>
        ) : (
          note.items.map((itemId) => {
            const it = itemTitle(itemId);
            return (
              <Badge
                key={itemId}
                variant="outline"
                render={<Link href={`/thu-vien/ghi-chu/?item=${itemId}`} title="Lọc ghi chú theo item này" />}
              >
                {it.type && <span className="text-muted-foreground">{itemTypeLabel(it.type)} ·</span>}
                <span className="max-w-56 truncate">{it.title}</span>
              </Badge>
            );
          })
        )
      }
      title={noteTitle(note)}
      meta={[`tạo ${formatDate(note.createdAt)}`, edited && `sửa ${formatDate(note.updatedAt)}`]
        .filter(Boolean)
        .join(' · ')}
      actions={
        <>
          <Button size="xs" variant="outline" onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa <Kbd>E</Kbd>
          </Button>
          {long && (
            <Button size="xs" variant="ghost" onClick={onToggle} aria-expanded={expanded} aria-controls={`${id}-body`}>
              {expanded ? 'Thu gọn' : 'Xem đầy đủ'} <Kbd>V</Kbd>
            </Button>
          )}
          <DeleteButton className="ms-auto" onClick={onDelete}>
            Xóa <Kbd>Del</Kbd>
          </DeleteButton>
        </>
      }
    >
      {/* Plain text on purpose: markdown is shown as typed, never parsed into HTML. */}
      <p
        id={`${id}-body`}
        className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted-foreground ${
          long && !expanded ? 'line-clamp-8' : ''
        }`}
      >
        {note.markdown}
      </p>
    </BrainCard>
  );
}

const keyHelp: [string, string][] = [
  ['J / K', 'xuống / lên'],
  ['E', 'sửa'],
  ['V', 'xem đủ'],
  ['Del', 'xóa'],
  ['N', 'ghi chú mới'],
  ['/', 'tìm'],
];

/** Ghi chú: markdown notes linked to Items, search (?q) and filter by Item (?item), create and edit. */
export function NotesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const itemFilter = Number(params.get('item')) || null;

  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);
  const [cursor, setCursor] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [editing, setEditing] = useState<ApiNote | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ApiNote | null>(null);
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

  const openEditor = useCallback((note: ApiNote | null) => {
    setEditing(note);
    setDialogOpen(true);
  }, []);
  // ?id=N (Cmd+K result): open that note in the dialog, wherever it sits in the list.
  useOpenFromUrl('id', (id) =>
    notesApi.get(id).then(openEditor, (err: unknown) => {
      const e = toApiError(err);
      setNotice(
        e.status === 404 && e.reachable
          ? `Không tìm thấy ghi chú #${id}, có thể đã bị xóa.`
          : describeApiError(e).title,
      );
    }),
  );
  const toggle = useCallback(
    (id: number) =>
      setExpanded((s) => {
        const next = new Set(s);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
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
      if (dialogOpen || deleting || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const act: Record<string, () => void> = {
        j: () => setCursor(Math.min(selected + 1, shown.length - 1)),
        arrowdown: () => setCursor(Math.min(selected + 1, shown.length - 1)),
        k: () => setCursor(Math.max(selected - 1, 0)),
        arrowup: () => setCursor(Math.max(selected - 1, 0)),
        n: () => openEditor(null),
        '/': () => searchRef.current?.focus(),
        ...(current && {
          e: () => openEditor(current),
          enter: () => openEditor(current),
          v: () => isLong(current.markdown) && toggle(current.id),
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
  }, [dialogOpen, deleting, selected, shown.length, current, openEditor, toggle]);

  const loadMore = async () => {
    const next = notes.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(notes);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const itemsStatus = index.error
    ? `Không tải được danh sách item: ${describeApiError(index.error).title}`
    : index.loading && index.items.length === 0
      ? 'Đang tải danh sách item…'
      : undefined;
  const filtered = !!q || !!itemFilter;

  return (
    <div className="flex flex-col gap-5 px-4 pb-12 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={searchRef}
            data-local-search
            type="search"
            aria-label="Tìm trong ghi chú"
            placeholder="Tìm trong tiêu đề và nội dung…"
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
          <Badge variant="info" size="lg" className="gap-1 pe-0.5">
            Item: <span className="max-w-60 truncate">{filterItem.title}</span>
            <button
              type="button"
              className="inline-flex size-5 items-center justify-center rounded-sm hover:bg-background/30"
              aria-label="Bỏ lọc theo item"
              onClick={() => router.replace(pathname)}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </Badge>
        )}
        <Button className="ms-auto" onClick={() => openEditor(null)}>
          <Plus aria-hidden />
          Ghi chú mới
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {notice && (
          <p className="text-sm text-muted-foreground" role="status">
            {notice}
          </p>
        )}
        <p className="ms-auto hidden flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground lg:flex">
          {keyHelp.map(([k, label]) => (
            <span key={k}>
              <Kbd>{k}</Kbd> {label}
            </span>
          ))}
        </p>
      </div>

      <ApiStaleAlert result={notes} />
      {notes.error && !notes.data ? (
        <ApiErrorState error={notes.error} onRetry={notes.reload} />
      ) : notes.loading && shown.length === 0 ? (
        <LoadingCards />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<NotebookPen aria-hidden />}
          title={filtered ? 'Không có ghi chú nào khớp' : 'Chưa có ghi chú nào'}
          description={
            filtered
              ? 'Thử từ khóa khác hoặc bỏ lọc theo item.'
              : 'Sách xong cần highlights và 3 ý chính, phim xong cần một câu nhận xét: ghi ở đây và liên kết tới item.'
          }
        >
          <Button onClick={() => openEditor(null)}>
            <Plus aria-hidden />
            {filterItem ? `Viết ghi chú cho "${filterItem.title}"` : 'Viết ghi chú đầu tiên'}
          </Button>
        </EmptyState>
      ) : (
        <div className="grid items-start gap-3 xl:grid-cols-2">
          {shown.map((n, i) => (
            <NoteCard
              key={n.id}
              note={n}
              itemTitle={itemTitle}
              selected={i === selected}
              expanded={expanded.has(n.id)}
              onSelect={() => setCursor(i)}
              onEdit={() => openEditor(n)}
              onToggle={() => toggle(n.id)}
              onDelete={() => setDeleting(n)}
            />
          ))}
        </div>
      )}
      {notes.data?.next && !notes.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          Tải thêm
        </Button>
      )}

      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa ghi chú?"
        description={
          deleting
            ? `"${noteTitle(deleting)}" bị xóa hẳn. Item liên kết vẫn giữ nguyên. Không hoàn tác được.`
            : undefined
        }
        action={() => (deleting ? notesApi.delete(deleting.id) : Promise.resolve())}
        onDeleted={() => {
          if (!deleting) return;
          const gone = deleting.id;
          notes.mutate((d) => d && { ...d, results: d.results.filter((n) => n.id !== gone) });
          setNotice(`Đã xóa "${noteTitle(deleting)}"`);
        }}
      />

      <NoteDialog
        open={dialogOpen}
        note={editing}
        draft={editing ? undefined : { items: itemFilter ? [itemFilter] : [] }}
        items={index.items}
        byId={labels}
        itemsStatus={itemsStatus}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          upsert(saved, created);
          setDialogOpen(false);
          setNotice(`${created ? 'Đã tạo' : 'Đã lưu'} "${noteTitle(saved)}"`);
          if (created) setCursor(0);
        }}
      />
    </div>
  );
}
