'use client';
import { useMemo, useRef, useState } from 'react';
import { ExternalLink, Plus, ToolCase } from 'lucide-react';
import { api, type ApiItem, type ApiItemRequest, type ApiItemStatus, type Page } from '@/lib/api/client';
import { loadAllPages } from '@/lib/api/pages';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { msg } from '@/lib/i18n/translate';
import { toolRowPicture } from '@/lib/item-picture';
import { hostOf, itemStatusOf, itemStatusesFor } from '@/lib/labels';
import { toolStageIcons } from '@/lib/tool-icons';
import {
  TOOL_STAGES,
  groupTools,
  toolGroupLabel,
  type ToolGroupKey,
  type ToolStatusFilter,
} from '@/lib/tools';
import { useListView } from '@/lib/use-board-view';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiErrorState, ApiStaleAlert, describeApiError, openError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { EmptyPanel, useToolbarState } from '../empty-panel';
import { GhostRows } from '../ghost-rows';
import { ItemDialog } from '../item-dialog';
import { PAGE_WIDTH } from '../layout';
import { RowPicture, boardMedia } from '../library/item-image';
import { ItemMenuItems } from '../library/item-parts';
import { ItemSheet } from '../library/item-sheet';
import { FilteredEmpty, RowsSkeleton, onRowClick } from '../library/list-rows';
import { RowMenu } from '../row-menu';
import { ViewSwitch } from '../view-switch';

// Công cụ (owner 13/11/2026): the tools a senior engineer uses at each stage of the work, and tools for learning by
// reading real codebases and by doing. A tool is an Item of type tool (its notes, Cmd+K, [[ ]] links, logo and status
// come with it); its stages are tags (lib/tools.ts), and the page groups the tools by them, a tool under each of its
// stages. A row opens the Item page in the Sheet, as on Thư viện (?item=N too). Two views (owner, the same day:
// "tools dạng list và dạng grid nữa", with haidave-com.vercel.app/resources as the reference): the rows, and a grid of
// cards (?view=grid); the same sections and filters in both.

/** Every tool (all cursor pages, at most 20 of 100), newest first; the groups sort them by title. */
const loadTools = () =>
  loadAllPages<ApiItem>(
    () => api.listItems({ type: 'tool', limit: 100 }),
    (next) => api.page<ApiItem>(next),
  );

const ALL_STATUSES = msg('Mọi trạng thái');
const ALL_STAGES = msg('Mọi công đoạn');

/** The rows of one group share these tracks: picture, status (from md; below it the status is in the meta line), title over summary, actions. */
const rowGrid = 'grid-cols-[3.5rem_minmax(0,1fr)_auto] md:grid-cols-[3.5rem_auto_minmax(0,1fr)_auto]';

/** The grid view's cards: as many 15rem columns as fit (one at 390 px, four beside the sidebar at 1440 px). */
const cardGrid = 'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3';

/** Where the focus goes back after the Sheet or a dialog: the row it was opened from, else that tool's first row. */
function rowFocusTarget(target: { id: number; group: ToolGroupKey } | null): HTMLElement | null {
  if (!target) return null;
  return (
    document.querySelector<HTMLElement>(`[data-tool-row="${target.group}:${target.id}"] button`) ??
    document.querySelector<HTMLElement>(`[data-tool-id="${target.id}"] button`)
  );
}

/** The official site of the tool, in a new tab: an icon button named after the site. */
function SourceLink({ url }: { url: string }) {
  const t = useT();
  const label = t('Mở {site} (tab mới)', { site: hostOf(url) || url });
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            render={<a href={url} target="_blank" rel="noopener noreferrer" />}
          />
        }
      >
        <ExternalLink aria-hidden />
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

interface ToolEntryProps {
  tool: ApiItem;
  /** The section the tool is listed under: its picture falls back to that section's icon. */
  group: ToolGroupKey;
  onOpen: () => void;
  onEdit: () => void;
  onWriteNote: () => void;
  onRate: () => void;
  onMove: (to: ApiItemStatus) => void;
}

/** The tool's site when its source is a web address, and the line under its title: the summary (what it is for), else where it lives. */
function toolLines(tool: ApiItem): { link: string | null; meta: string } {
  const source = tool.source?.trim() ?? '';
  const link = /^https?:\/\/\S+$/i.test(source) ? source : null;
  return { link, meta: tool.summary?.trim() || (link ? hostOf(link) : source) };
}

/** A tool's menu, the same on a row and a card: the Item's own entries, then a move to each other status. */
function ToolMenu({ tool, onEdit, onWriteNote, onRate, onMove }: Omit<ToolEntryProps, 'group' | 'onOpen'>) {
  const t = useT();
  return (
    <RowMenu label={t('Thao tác cho "{title}"', { title: tool.title })}>
      <ItemMenuItems item={tool} onEdit={onEdit} onWriteNote={onWriteNote} onRate={onRate} />
      <MenuSeparator />
      {itemStatusesFor('tool')
        .filter((other) => other.value !== tool.status)
        .map((other) => (
          <MenuItem key={other.value} onClick={() => onMove(other.value)}>
            {t('Chuyển sang {status}', { status: t(other.label) })}
          </MenuItem>
        ))}
    </RowMenu>
  );
}

/**
 * A tool as a card of the grid view (DESIGN.md §6 "View switches"): the board card's white surface, the logo or the
 * section's icon in the 40px place before the title, the summary in up to 2 lines, then the status and the site link
 * at the foot, so the cards of one grid row end on one line. The whole card opens the Item page, like a row.
 */
function ToolCard({ tool, group, onOpen, ...menu }: ToolEntryProps) {
  const t = useT();
  const s = itemStatusOf(tool.status, 'tool');
  const { link, meta } = toolLines(tool);
  const media = boardMedia(toolRowPicture(tool, group), t);
  return (
    <li
      data-tool-row={`${group}:${tool.id}`}
      data-tool-id={tool.id}
      className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent has-focus-visible:bg-accent"
      onClick={(e) => onRowClick(e, onOpen)}
    >
      <div className="flex items-center gap-2">
        {media && (
          <span aria-hidden className="shrink-0">
            {media.node}
          </span>
        )}
        <button
          type="button"
          className="min-w-0 flex-1 rounded-sm py-0.5 text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          <span className="line-clamp-2 break-words">{tool.title}</span>
        </button>
        <span className="-me-1.5 shrink-0">
          <ToolMenu tool={tool} {...menu} />
        </span>
      </div>
      {meta && <p className="line-clamp-2 text-xs break-words text-muted-foreground">{meta}</p>}
      <div className="mt-auto flex min-h-8 items-center justify-between gap-2">
        <StatusBadge tone={s.tone}>{t(s.label)}</StatusBadge>
        {link && (
          <span className="-me-1.5">
            <SourceLink url={link} />
          </span>
        )}
      </div>
    </li>
  );
}

/** Loading cards at the grid's geometry (DESIGN.md D27): a section heading over six card placeholders. */
function CardsSkeleton() {
  const t = useT();
  const bar = 'motion-reduce:animate-none';
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label={t('Đang tải')}>
      <Skeleton aria-hidden className={cn('h-7 w-48', bar)} />
      <ul aria-hidden className={cardGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <span className="flex items-center gap-2">
              <Skeleton className={cn('size-10 shrink-0', bar)} />
              <Skeleton className={cn('h-4 w-2/3', bar)} />
            </span>
            <Skeleton className={cn('h-3 w-full', bar)} />
            <Skeleton className={cn('h-3 w-1/2', bar)} />
            <span className="flex min-h-8 items-center">
              <Skeleton className={cn('h-5 w-20', bar)} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolRow({ tool, group, onOpen, ...menu }: ToolEntryProps) {
  const t = useT();
  const s = itemStatusOf(tool.status, 'tool');
  const { link, meta } = toolLines(tool);
  return (
    <li
      data-tool-row={`${group}:${tool.id}`}
      data-tool-id={tool.id}
      className="col-span-full grid min-h-14 grid-cols-subgrid items-center py-2 ps-0 pe-3 transition-colors hover:bg-accent has-focus-visible:bg-accent"
      onClick={(e) => onRowClick(e, onOpen)}
    >
      <RowPicture picture={toolRowPicture(tool, group)} />
      <span className="flex max-md:hidden">
        <StatusBadge tone={s.tone}>{t(s.label)}</StatusBadge>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          className="max-w-full truncate rounded-sm text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          {tool.title}
        </button>
        <p className="line-clamp-2 text-xs break-words text-muted-foreground sm:line-clamp-1">
          <span className="md:hidden">
            {t(s.label)}
            {meta && ' · '}
          </span>
          {meta}
        </p>
      </div>
      <div className="flex items-center justify-end gap-1">
        {link && <SourceLink url={link} />}
        <ToolMenu tool={tool} {...menu} />
      </div>
    </li>
  );
}

export function ToolsPage() {
  const t = useT();
  // Danh sách, or Lưới (?view=grid; the last choice is remembered in this browser, and a remembered grid waits until
  // useOpenFromUrl has dropped ?item=, so the two URL changes never undo each other)
  const [view, setView] = useListView<'grid'>('alex-brain:tools-view', 'grid', 'item');
  const [status, setStatus] = useState<ToolStatusFilter>('all');
  const [stage, setStage] = useState<ToolGroupKey | 'all'>('all');
  const [editing, setEditing] = useState<ApiItem | null>(null);
  const [draft, setDraft] = useState<Partial<ApiItemRequest> | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [focusRating, setFocusRating] = useState(false);
  // The tool shown in the Sheet (kept while it animates out); `compose`: opened from "Viết ghi chú"
  const [sheet, setSheet] = useState<{ item: ApiItem; compose: boolean } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // The row a dialog or the Sheet was opened from: it takes the focus back when they close
  const returnTo = useRef<{ id: number; group: ToolGroupKey } | null>(null);
  const finalFocus = () => rowFocusTarget(returnTo.current) ?? null;

  const tools = useApi<Page<ApiItem>>('items:tool', loadTools);
  const ready = tools.data !== undefined;
  const all = useMemo(() => tools.data?.results ?? [], [tools.data]);
  const groups = useMemo(() => groupTools(all, { status, stage }), [all, status, stage]);

  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: t(ALL_STATUSES) },
      ...itemStatusesFor('tool').map((s) => ({ value: s.value, label: t(s.label) })),
    ],
    [t],
  );
  const stageOptions = useMemo(
    () => [
      { value: 'all' as const, label: t(ALL_STAGES) },
      ...[...TOOL_STAGES.map((s) => s.slug), 'other' as const].map((key) => ({
        value: key,
        label: t(toolGroupLabel(key)),
      })),
    ],
    [t],
  );

  const openSheet = (item: ApiItem, group: ToolGroupKey | null, compose = false) => {
    returnTo.current = group ? { id: item.id, group } : null;
    setSheet({ item, compose });
    setSheetOpen(true);
  };
  const openEdit = (item: ApiItem, group: ToolGroupKey, rating = false) => {
    returnTo.current = { id: item.id, group };
    setEditing(item);
    setFocusRating(rating);
    setDialogOpen(true);
  };
  /** A new tool, with the chosen stage picked already. */
  const openNew = () => {
    returnTo.current = null;
    setEditing(null);
    setDraft({ type: 'tool', status: 'planned', tags: stage !== 'all' && stage !== 'other' ? [stage] : [] });
    setFocusRating(false);
    setDialogOpen(true);
  };

  // ?item=N (Cmd+K, a link): that tool's page in the Sheet
  useOpenFromUrl('item', (id) => {
    api.getItem(id).then(
      (item) => openSheet(item, null),
      (err: unknown) => setNotice(openError(err, t('Không tìm thấy item #{id}, có thể đã bị xóa.', { id }), t)),
    );
  });

  /** The list after a save: a tool that is no longer a tool leaves the page. */
  const upsert = (saved: ApiItem, created: boolean) =>
    tools.mutate((d) => {
      if (!d) return d;
      const rest = d.results.filter((i) => i.id !== saved.id);
      if (saved.type !== 'tool') return { ...d, results: rest };
      return { ...d, results: created ? [saved, ...rest] : d.results.map((i) => (i.id === saved.id ? saved : i)) };
    });
  const remove = (id: number) => tools.mutate((d) => d && { ...d, results: d.results.filter((i) => i.id !== id) });

  const move = async (tool: ApiItem, to: ApiItemStatus) => {
    try {
      upsert(await api.updateItem(tool.id, { status: to }), false);
      setNotice(`"${tool.title}" → ${t(itemStatusOf(to, 'tool').label)}`);
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
    }
  };

  const loadMore = async () => {
    if (!tools.data?.next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(tools);
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = status !== 'all' || stage !== 'all';
  const failed = !!tools.error && !ready;
  // The toolbar waits for a first tool or a filter (DESIGN.md §9a); the sidebar count decides while the list loads
  const toolbar = useToolbarState({ rows: all.length, filtered, loading: !ready, failed, count: 'tools' });

  return (
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6 px-4 pb-12 sm:px-8')}>
      {/* Narrower than one row (48rem: the longest stage name fits beside the switch and "Thêm công cụ"): the view
          switch and "Thêm công cụ" keep the first row, the two filters share the second, never an orphaned button
          (DESIGN.md §6 Toolbar), as on Thư viện; below 28rem the switch drops its icons, or the button would wrap
          alone at 390 px. Both filters apply to both views. */}
      {toolbar !== 'hide' && (
        <div className={cn('@container', toolbar === 'wait' && 'invisible')}>
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitch view={view} onChange={setView} alt="grid" textOnlyWhenNarrow />
            <div className="order-last grid w-full grid-cols-2 gap-2 @3xl:order-none @3xl:flex @3xl:w-auto @3xl:items-center">
              <ChoiceSelect
                label={t('Trạng thái')}
                value={status}
                onChange={setStatus}
                choices={statusOptions}
                className="min-w-0 @3xl:w-auto"
              />
              <ChoiceSelect
                label={t('Công đoạn')}
                value={stage}
                onChange={setStage}
                choices={stageOptions}
                className="min-w-0 @3xl:w-auto"
              />
            </div>
            <Button className="ms-auto shrink-0" onClick={openNew}>
              <Plus aria-hidden />
              {t('Thêm công cụ')}
            </Button>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground empty:sr-only" role="status">
        {notice}
      </p>

      <ApiStaleAlert result={tools} />
      {failed && tools.error ? (
        <ApiErrorState error={tools.error} onRetry={tools.reload} />
      ) : !ready ? (
        view === 'grid' ? (
          <CardsSkeleton />
        ) : (
          <RowsSkeleton picture />
        )
      ) : groups.length === 0 && filtered ? (
        <FilteredEmpty
          onClear={() => {
            setStatus('all');
            setStage('all');
          }}
        >
          {t('Không có công cụ nào khớp bộ lọc.')}
        </FilteredEmpty>
      ) : all.length === 0 ? (
        <EmptyPanel
          glyph={ToolCase}
          title={t('Chưa có công cụ nào')}
          text={t.rich(
            'Lưu công cụ bạn dùng hoặc muốn thử, kèm một dòng dùng để làm gì; hoặc chạy <code>manage.py seed_tools</code> một lần để có sẵn danh sách gợi ý.',
            { code: (chunks) => <code className="font-mono text-xs text-foreground">{chunks}</code> },
          )}
          action={
            <Button onClick={openNew}>
              <Plus aria-hidden />
              {t('Thêm công cụ')}
            </Button>
          }
          ghost={<GhostRows />}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ key, tools: list }) => {
            const Icon = toolStageIcons[key];
            const Entry = view === 'grid' ? ToolCard : ToolRow;
            return (
              <section key={key} aria-labelledby={`tools-${key}`} className="flex flex-col gap-3">
                {/* The stage's icon before its name (owner 13/11/2026), ink and the title icon's line, no tile */}
                <h2
                  id={`tools-${key}`}
                  className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight"
                >
                  <Icon
                    aria-hidden
                    className="size-5 shrink-0 forced-colors:text-inherit"
                    strokeWidth={1.5}
                    absoluteStrokeWidth
                  />
                  {t(toolGroupLabel(key))}
                  <span className="text-sm font-normal text-muted-foreground tabular-nums">{list.length}</span>
                </h2>
                <ul
                  aria-labelledby={`tools-${key}`}
                  className={
                    view === 'grid'
                      ? cardGrid
                      : cn('grid gap-x-3 divide-y overflow-hidden rounded-xl border bg-card', rowGrid)
                  }
                >
                  {list.map((tool) => (
                    <Entry
                      key={tool.id}
                      tool={tool}
                      group={key}
                      onOpen={() => openSheet(tool, key)}
                      onEdit={() => openEdit(tool, key)}
                      onWriteNote={() => openSheet(tool, key, true)}
                      onRate={() => openEdit(tool, key, true)}
                      onMove={(to) => void move(tool, to)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {/* Only past the 20-page cap of loadTools */}
      {ready && tools.data?.next && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          {t('Tải thêm')}
        </Button>
      )}

      <ItemDialog
        open={dialogOpen}
        item={editing}
        draft={draft}
        focusRating={focusRating}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setFocusRating(false);
        }}
        onSaved={(saved, created, imageError) => {
          upsert(saved, created);
          setDialogOpen(false);
          const vars = { title: saved.title, error: imageError ?? '' };
          setNotice(
            imageError
              ? created
                ? t('Đã thêm "{title}", nhưng chưa lưu được ảnh: {error}.', vars)
                : t('Đã lưu "{title}", nhưng chưa lưu được ảnh: {error}.', vars)
              : created
                ? t('Đã thêm "{title}"', vars)
                : t('Đã lưu "{title}"', vars),
          );
        }}
        onDeleted={(deleted) => {
          remove(deleted.id);
          setDialogOpen(false);
          setEditing(null);
          setNotice(t('Đã xóa "{title}"', { title: deleted.title }));
        }}
        onWriteNote={(item) => {
          setDialogOpen(false);
          openSheet(item, returnTo.current?.group ?? null, true);
        }}
        finalFocus={finalFocus}
      />

      <ItemSheet
        item={sheet?.item ?? null}
        open={sheetOpen}
        compose={sheet?.compose ?? false}
        onOpenChange={setSheetOpen}
        finalFocus={finalFocus}
        onItemChange={(saved) => {
          setSheet((s) => s && { ...s, item: saved });
          upsert(saved, false);
        }}
        onOtherCounts={(ids, delta) =>
          tools.mutate(
            (d) =>
              d && {
                ...d,
                results: d.results.map((i) =>
                  ids.includes(i.id) ? { ...i, noteCount: Math.max(0, i.noteCount + delta) } : i,
                ),
              },
          )
        }
        onDeleted={(deleted) => {
          remove(deleted.id);
          setSheetOpen(false);
          returnTo.current = null;
          setNotice(t('Đã xóa "{title}"', { title: deleted.title }));
        }}
      />
    </div>
  );
}
