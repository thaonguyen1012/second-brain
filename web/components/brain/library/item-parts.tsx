'use client';
import Link from 'next/link';
import { Briefcase, Maximize2, NotebookPen, Pencil, Plus, Star } from 'lucide-react';
import type { ApiItem, ApiItemStatus } from '@/lib/api/client';
import { itemPicture } from '@/lib/handbook-picture';
import { formatDate, itemStatusOf, itemTypeLabel } from '@/lib/labels';
import { itemDateLabel, itemSourceLabel } from '@/lib/library-labels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MenuItem, MenuLinkItem } from '@/components/ui/menu';
import { StatusBadge } from '../brain-card';
import { RowMenu } from '../row-menu';
import { gapLabel, missingOutput } from './done-output';
import { RowPicture } from './item-image';
import { onRowClick } from './list-rows';

/**
 * The List's shared subgrid. With pictures (some row has one): a flush 56px picture track first, and the status moves
 * from its badge into the meta line below md, as on Dự án, so the title keeps its room at 390 px (DESIGN.md §3).
 */
export function itemListGrid(withPicture: boolean): string {
  return withPicture
    ? 'grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:grid-cols-[3.5rem_minmax(0,1fr)_auto_auto] md:grid-cols-[3.5rem_auto_minmax(0,1fr)_auto_auto]'
    : 'grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]';
}

// The parts of an Item on Thư viện: its row in the List, the body of its card on the Bảng (components/brain/
// status-board.tsx) and the menu entries both share.

/** The one-click next step of the lifecycle (DECISIONS 4.2); "done" still needs a note to count. */
const nextStep: Partial<Record<ApiItemStatus, { to: ApiItemStatus; label: string }>> = {
  planned: { to: 'active', label: 'Bắt đầu' },
  active: { to: 'done', label: 'Xong' },
};

/**
 * Sửa, Viết ghi chú, Mở trang đầy đủ, Chấm điểm (a done film without a rating) and, for a project, Công việc. The
 * notes themselves are on the Item page (the row or card title opens it beside the list).
 */
export function ItemMenuItems({
  item,
  onEdit,
  onWriteNote,
  onRate,
}: {
  item: ApiItem;
  onEdit: () => void;
  onWriteNote: () => void;
  onRate: () => void;
}) {
  const gap = missingOutput(item);
  return (
    <>
      <MenuItem onClick={onEdit}>
        <Pencil aria-hidden />
        Sửa
      </MenuItem>
      <MenuItem onClick={onWriteNote}>
        <NotebookPen aria-hidden />
        Viết ghi chú
      </MenuItem>
      <MenuLinkItem render={<Link href={`/thu-vien/item/?id=${item.id}`} />}>
        <Maximize2 aria-hidden />
        Mở trang đầy đủ
      </MenuLinkItem>
      {gap?.rating && (
        <MenuItem onClick={onRate}>
          <Star aria-hidden />
          Chấm điểm
        </MenuItem>
      )}
      {item.type === 'project' && (
        // client, price and hours live on Công việc
        <MenuLinkItem render={<Link href="/cong-viec/" />}>
          <Briefcase aria-hidden />
          Mở ở Công việc
        </MenuLinkItem>
      )}
    </>
  );
}

export function ItemRow({
  item,
  withPicture,
  onOpen,
  onEdit,
  onStep,
  onWriteNote,
  onRate,
}: {
  item: ApiItem;
  /** The list has a picture track (itemListGrid). */
  withPicture: boolean;
  /** The title and a click on the row: the Item page beside the list. */
  onOpen: () => void;
  /** The menu's "Sửa": the Item dialog. */
  onEdit: () => void;
  onStep: (to: ApiItemStatus) => void;
  onWriteNote: () => void;
  onRate: () => void;
}) {
  const s = itemStatusOf(item.status);
  const gap = missingOutput(item);
  const step = nextStep[item.status ?? 'planned'];
  const dates = [
    item.startedAt && `bắt đầu ${formatDate(item.startedAt)}`,
    item.finishedAt && `xong ${formatDate(item.finishedAt)}`,
  ].filter(Boolean);
  const meta = [
    itemTypeLabel(item.type),
    itemSourceLabel(item.source),
    ...(dates.length ? dates : [`thêm ${formatDate(item.createdAt)}`]),
  ]
    .filter(Boolean)
    .join(' · ');
  const tags = (item.tags ?? []).map((t) => `#${t}`).join(' ');
  return (
    // One row of the shared subgrid (status | title over meta | rating | actions), DESIGN.md §3 "list row beats card"
    <li
      data-card-id={item.id}
      className={cn(
        'col-span-full grid min-h-14 grid-cols-subgrid items-center py-2 transition-colors hover:bg-accent has-focus-visible:bg-accent',
        // a picture is flush with the list's start edge, clipped by its radius; the text keeps 12px from it
        withPicture ? 'ps-0 pe-3' : 'px-3',
      )}
      onClick={(e) => onRowClick(e, onOpen)}
    >
      {withPicture && <RowPicture picture={itemPicture(item)} />}
      <span className={cn('flex', withPicture && 'max-md:hidden')}>
        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          className="max-w-full truncate rounded-sm text-start text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          {item.title}
        </button>
        <p className="truncate text-xs text-muted-foreground">
          {withPicture && <span className="md:hidden">{s.label} · </span>}
          {meta}
          {gap && (
            <>
              {' · '}
              <span className="text-warning-foreground">{gapLabel(gap)}</span>
            </>
          )}
          {tags && ` · ${tags}`}
        </p>
      </div>
      <span className="text-end text-xs tabular-nums text-muted-foreground max-sm:hidden">
        {item.rating ? `${item.rating}/10` : ''}
      </span>
      <div className="flex items-center justify-end gap-1">
        {step && (
          <Button size="xs" variant="outline" onClick={() => onStep(step.to)}>
            {step.label}
          </Button>
        )}
        <RowMenu>
          <ItemMenuItems item={item} onEdit={onEdit} onWriteNote={onWriteNote} onRate={onRate} />
        </RowMenu>
      </div>
    </li>
  );
}

/**
 * Under a board card's title: type (when the list is not filtered by type), source and the lane's date, then a footer
 * only when there is something to say: the rating, the note count, and for a done Item without its output the
 * warning words with the one action that fixes it (DECISIONS 4.2: a soft rule, a drop into Xong is never blocked).
 */
export function ItemCardBody({
  item,
  showType,
  onWriteNote,
  onRate,
}: {
  item: ApiItem;
  showType: boolean;
  onWriteNote: () => void;
  onRate: () => void;
}) {
  const gap = missingOutput(item);
  const meta = [showType && itemTypeLabel(item.type), itemSourceLabel(item.source), itemDateLabel(item)]
    .filter(Boolean)
    .join(' · ');
  const footer = !!item.rating || item.noteCount > 0 || gap !== null;
  return (
    <>
      <p className="line-clamp-2 text-xs break-words text-muted-foreground">{meta}</p>
      {footer && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          {!!item.rating && (
            <span>
              <span className="font-medium text-foreground">{item.rating}</span>/10
              <span className="sr-only"> điểm</span>
            </span>
          )}
          {item.noteCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <NotebookPen className="size-3.5" aria-hidden />
              {item.noteCount}
              <span className="sr-only"> ghi chú</span>
            </span>
          )}
          {gap && <span className="text-warning-foreground">{gapLabel(gap)}</span>}
        </div>
      )}
      {gap && (
        <Button
          size="xs"
          variant="outline"
          className="self-start"
          onClick={gap.note ? onWriteNote : onRate}
          // several cards show this button: the name says whose (it starts with the visible words)
          aria-label={`${gap.note ? 'Viết ghi chú' : 'Chấm điểm'} cho “${item.title}”`}
        >
          {gap.note ? <Plus aria-hidden /> : <Star aria-hidden />}
          {gap.note ? 'Viết ghi chú' : 'Chấm điểm'}
        </Button>
      )}
    </>
  );
}
