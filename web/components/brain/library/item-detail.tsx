'use client';
import { useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { Briefcase, ExternalLink, Maximize2, Pencil } from 'lucide-react';
import { api, type ApiItem, type ApiItemStatus } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { handbookForSource, itemPicture } from '@/lib/handbook-picture';
import { formatDate, hostOf, itemStatusOf, itemTypeLabel } from '@/lib/labels';
import { useLeaveGuard } from '@/lib/use-leave-guard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SheetTitle } from '@/components/ui/sheet';
import { describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ItemDialog } from '../item-dialog';
import { AreaTile } from '../page-header';
import { DiscardChanges } from './discard-changes';
import { DoneOutputHint, missingOutput } from './done-output';
import { DetailPicture } from './item-image';
import { ItemMentions } from './item-mentions';
import { ItemNotes } from './item-notes';

// The Item page (DECISIONS 9.8 points 1-2), one component for both places it shows: the Sheet beside Thư viện (peek)
// and the full page /thu-vien/item/?id=N. Top to bottom: picture, title and properties (AFFiNE's properties at the
// top; edited through the existing ItemDialog, the one way to edit them), the done-needs-an-output hint (DECISIONS
// 4.2), every note of the Item, then "Được nhắc tới ở".

/** The one-click next step of the lifecycle, as on the List row (item-parts.tsx). */
const nextStep: Partial<Record<ApiItemStatus, { to: ApiItemStatus; label: string }>> = {
  planned: { to: 'active', label: 'Bắt đầu' },
  active: { to: 'done', label: 'Xong' },
};

/** An Item's source as a property: the handbook it is, the site it links to (new tab), or the text itself. */
function SourceValue({ source }: { source: string }) {
  const s = source.trim();
  if (s.startsWith('/docs/')) {
    const book = handbookForSource(s);
    return (
      <Link href={s} className="underline-offset-4 hover:underline">
        {book ? book.title : 'Sổ tay'}
      </Link>
    );
  }
  if (/^https?:\/\/\S+$/i.test(s))
    return (
      <a
        href={s}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
      >
        <span className="truncate">{hostOf(s) || s}</span>
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-label="(mở tab mới)" />
      </a>
    );
  return <span className="break-words">{s}</span>;
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

export function ItemDetail({
  item,
  variant,
  composeOnOpen = false,
  composerRef,
  titleRef,
  onItemChange,
  onDeleted,
  onDirtyChange,
}: {
  item: ApiItem;
  /** In the Sheet beside Thư viện (with "Mở trang đầy đủ") or as the full page (an h1). */
  variant: 'sheet' | 'page';
  /** Opened from "Viết ghi chú": the composer starts open. */
  composeOnOpen?: boolean;
  /** The composer's textarea, for the Sheet's first focus (from "Viết ghi chú"). */
  composerRef?: RefObject<HTMLTextAreaElement | null>;
  /** The Sheet's title, its first focus otherwise: never an action, so an Enter right after opening changes nothing. */
  titleRef?: RefObject<HTMLHeadingElement | null>;
  /** The Item as saved after a change made here (properties, status, note count). */
  onItemChange: (item: ApiItem) => void;
  onDeleted: (item: ApiItem) => void;
  /** Whether unsaved note text is on the page (the Sheet asks before it closes). */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [focusRating, setFocusRating] = useState(false);
  const [composeRequest, setComposeRequest] = useState(composeOnOpen ? 1 : 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [stepping, setStepping] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  useLeaveGuard(dirty, (go) => setLeave(() => go));
  const ownComposer = useRef<HTMLTextAreaElement | null>(null);
  const composer = composerRef ?? ownComposer;
  // "Viết ghi chú" in the Item dialog: once the dialog has closed, the focus goes to the composer it opened
  const writeAfterDialog = useRef(false);

  const s = itemStatusOf(item.status);
  const step = nextStep[item.status ?? 'planned'];
  const gap = missingOutput(item);
  const picture = itemPicture(item);
  const dates = [
    `thêm ${formatDate(item.createdAt)}`,
    item.startedAt && `bắt đầu ${formatDate(item.startedAt)}`,
    item.finishedAt && `xong ${formatDate(item.finishedAt)}`,
  ].filter(Boolean);

  const openEdit = (rating = false) => {
    setFocusRating(rating);
    setEditOpen(true);
  };

  const stepTo = async (to: ApiItemStatus) => {
    if (stepping) return;
    setStepping(true);
    try {
      const saved = await api.updateItem(item.id, { status: to });
      onItemChange(saved);
      setNotice(`Đã chuyển sang ${itemStatusOf(to).label}`);
    } catch (err) {
      setNotice(`Không đổi được trạng thái: ${describeApiError(toApiError(err)).title}`);
    } finally {
      setStepping(false);
    }
  };

  const titleClass = 'min-w-0 font-heading font-semibold tracking-tight break-words';
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          {picture ? <DetailPicture picture={picture} /> : variant === 'page' && <AreaTile nav="/thu-vien/" />}
          {variant === 'sheet' ? (
            // leaves room for the Sheet's close button
            <SheetTitle ref={titleRef} tabIndex={-1} className={cn(titleClass, 'pe-8 text-xl leading-tight outline-none')}>
              {item.title}
            </SheetTitle>
          ) : (
            <h1 className={cn(titleClass, 'text-3xl')}>{item.title}</h1>
          )}
        </div>

        {/* AFFiNE's properties at the top of the page: one label column, values left-aligned */}
        <dl className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
          <Property label="Trạng thái">
            <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          </Property>
          <Property label="Loại">{itemTypeLabel(item.type)}</Property>
          {item.rating ? (
            <Property label="Điểm">
              <span className="tabular-nums">{item.rating}/10</span>
            </Property>
          ) : null}
          {item.source?.trim() ? (
            <Property label="Nguồn">
              <SourceValue source={item.source} />
            </Property>
          ) : null}
          {item.tags?.length ? (
            <Property label="Tag">
              <span className="break-words text-muted-foreground">{item.tags.map((t) => `#${t}`).join(' ')}</span>
            </Property>
          ) : null}
          <Property label="Ngày">
            <span className="text-muted-foreground tabular-nums">{dates.join(' · ')}</span>
          </Property>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          {step && (
            <Button variant="outline" size="sm" disabled={stepping} onClick={() => void stepTo(step.to)}>
              {step.label}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openEdit()}>
            <Pencil aria-hidden />
            Sửa
          </Button>
          {item.type === 'project' && (
            // client, price and hours live on Công việc
            <Button variant="ghost" size="sm" render={<Link href="/cong-viec/" />}>
              <Briefcase aria-hidden />
              Công việc
            </Button>
          )}
          {variant === 'sheet' && (
            <Button variant="ghost" size="sm" className="ms-auto" render={<Link href={`/thu-vien/item/?id=${item.id}`} />}>
              <Maximize2 aria-hidden />
              Mở trang đầy đủ
            </Button>
          )}
        </div>
        {notice && (
          <p className="text-sm text-muted-foreground" role="status">
            {notice}
          </p>
        )}
      </header>

      {gap && (
        <DoneOutputHint
          type={item.type}
          gap={gap}
          onWriteNote={() => setComposeRequest((n) => n + 1)}
          onRate={() => openEdit(true)}
          className="-mt-4"
        />
      )}

      <ItemNotes
        item={item}
        composeRequest={composeRequest}
        composerRef={composer}
        onCountChange={(delta) => onItemChange({ ...item, noteCount: Math.max(0, item.noteCount + delta) })}
        onDirtyChange={(d) => {
          setDirty(d);
          onDirtyChange?.(d);
        }}
      />

      <ItemMentions itemId={item.id} />

      {/* Inside the Sheet's tree, so Base UI nests them (focus returns into the Sheet, a click in them is no
          "outside press" that closes it). */}
      <ItemDialog
        open={editOpen}
        item={item}
        focusRating={focusRating}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (o) writeAfterDialog.current = false;
          else setFocusRating(false);
        }}
        finalFocus={() => (writeAfterDialog.current ? composer.current : null) ?? true}
        onSaved={(saved, _created, imageError) => {
          onItemChange(saved);
          setEditOpen(false);
          setNotice(imageError ? `Đã lưu, nhưng chưa lưu được ảnh: ${imageError}.` : 'Đã lưu');
        }}
        onDeleted={(deleted) => {
          setEditOpen(false);
          onDeleted(deleted);
        }}
        onWriteNote={() => {
          writeAfterDialog.current = true;
          setEditOpen(false);
          setComposeRequest((n) => n + 1);
        }}
      />
      <DiscardChanges
        open={leave !== null}
        onKeep={() => setLeave(null)}
        onDiscard={() => {
          const go = leave;
          setLeave(null);
          go?.();
        }}
      />
    </div>
  );
}
