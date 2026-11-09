'use client';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { Briefcase, ExternalLink, Maximize2, Pencil } from 'lucide-react';
import { api, type ApiItem, type ApiItemStatus } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { handbookForSource, itemPicture } from '@/lib/handbook-picture';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { formatDate, hostOf, itemStatusOf, itemTypeLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SheetTitle } from '@/components/ui/sheet';
import { describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ItemDialog } from '../item-dialog';
import { AreaTile } from '../page-header';
import { DoneOutputHint, missingOutput } from './done-output';
import { DetailPicture } from './item-image';
import { ItemMentions } from './item-mentions';
import { ItemNotes } from './item-notes';

// The Item page (DECISIONS 9.8 points 1-2), one component for both places it shows: the Sheet beside Thư viện (peek)
// and the full page /thu-vien/item/?id=N. Top to bottom: picture, title and properties (AFFiNE's properties at the
// top; edited through the existing ItemDialog, the one way to edit them), the done-needs-an-output hint (DECISIONS
// 4.2), every note of the Item, then "Được nhắc tới ở".

/** The one-click next step of the lifecycle, as on the List row (item-parts.tsx). */
const nextStep: Partial<Record<ApiItemStatus, { to: ApiItemStatus; label: Msg }>> = {
  planned: { to: 'active', label: msg('Bắt đầu') },
  active: { to: 'done', label: msg('Xong') },
};

/** An Item's source as a property: the handbook it is, the site it links to (new tab), or the text itself. */
function SourceValue({ source }: { source: string }) {
  const t = useT();
  const s = source.trim();
  if (s.startsWith('/docs/')) {
    const book = handbookForSource(s);
    return (
      <Link href={s} className="underline-offset-4 hover:underline">
        {book ? t(book.title) : t('Sổ tay')}
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
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-label={t('(mở tab mới)')} />
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
  titleRef,
  onItemChange,
  onOtherCounts,
  onDeleted,
}: {
  item: ApiItem;
  /** In the Sheet beside Thư viện (with "Mở trang đầy đủ") or as the full page (an h1). */
  variant: 'sheet' | 'page';
  /** Opened from "Viết ghi chú": the composer starts open. */
  composeOnOpen?: boolean;
  /** The Sheet's title, its first focus otherwise: never an action, so an Enter right after opening changes nothing. */
  titleRef?: RefObject<HTMLHeadingElement | null>;
  /** The Item as saved after a change made here (properties, status, note count). */
  onItemChange: (item: ApiItem) => void;
  /** Other Items whose note count changed here (a deleted note was linked to them too). */
  onOtherCounts?: (items: readonly number[], delta: number) => void;
  onDeleted: (item: ApiItem) => void;
}) {
  const t = useT();
  const [editOpen, setEditOpen] = useState(false);
  const [focusRating, setFocusRating] = useState(false);
  const [composeRequest, setComposeRequest] = useState(composeOnOpen ? 1 : 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [stepping, setStepping] = useState(false);
  // The Item as last rendered: a note saved after a status change must not put the old status back
  const latest = useRef(item);
  useEffect(() => {
    latest.current = item;
  });
  // the composer's editable (ItemNotes), where the focus goes after "Viết ghi chú" in the Item dialog
  const composerId = useId();
  // "Viết ghi chú" in the Item dialog: once the dialog has closed, the focus goes to the composer it opened
  const writeAfterDialog = useRef(false);

  const s = itemStatusOf(item.status);
  const step = nextStep[item.status ?? 'planned'];
  const gap = missingOutput(item);
  const picture = itemPicture(item);
  const dates = [
    t('thêm {date}', { date: formatDate(item.createdAt, t) }),
    item.startedAt && t('bắt đầu {date}', { date: formatDate(item.startedAt, t) }),
    item.finishedAt && t('xong {date}', { date: formatDate(item.finishedAt, t) }),
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
      setNotice(t('Đã chuyển sang {status}', { status: t(itemStatusOf(to).label) }));
    } catch (err) {
      setNotice(t('Không đổi được trạng thái: {reason}', { reason: describeApiError(toApiError(err), t).title }));
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
          <Property label={t('Trạng thái')}>
            <StatusBadge tone={s.tone}>{t(s.label)}</StatusBadge>
          </Property>
          <Property label={t('Loại')}>{t(itemTypeLabel(item.type))}</Property>
          {item.rating ? (
            <Property label={t('Điểm', null, 'rating')}>
              <span className="tabular-nums">{item.rating}/10</span>
            </Property>
          ) : null}
          {item.source?.trim() ? (
            <Property label={t('Nguồn')}>
              <SourceValue source={item.source} />
            </Property>
          ) : null}
          {item.tags?.length ? (
            <Property label={t('Tag')}>
              <span className="break-words text-muted-foreground">{item.tags.map((t) => `#${t}`).join(' ')}</span>
            </Property>
          ) : null}
          <Property label={t('Ngày')}>
            <span className="text-muted-foreground tabular-nums">{dates.join(' · ')}</span>
          </Property>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          {step && (
            <Button variant="outline" size="sm" disabled={stepping} onClick={() => void stepTo(step.to)}>
              {t(step.label)}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openEdit()}>
            <Pencil aria-hidden />
            {t('Sửa')}
          </Button>
          {item.type === 'project' && (
            // client, price and hours live on Công việc
            <Button variant="ghost" size="sm" render={<Link href="/cong-viec/" />}>
              <Briefcase aria-hidden />
              {t('Công việc')}
            </Button>
          )}
          {variant === 'sheet' && (
            <Button variant="ghost" size="sm" className="ms-auto" render={<Link href={`/thu-vien/item/?id=${item.id}`} />}>
              <Maximize2 aria-hidden />
              {t('Mở trang đầy đủ')}
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
        composerId={composerId}
        onCountChange={(items, delta) => {
          const now = latest.current;
          if (items.includes(now.id)) onItemChange({ ...now, noteCount: Math.max(0, now.noteCount + delta) });
          const others = items.filter((id) => id !== now.id);
          if (others.length) onOtherCounts?.(others, delta);
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
        // the composer's editor if it is ready (else it takes the focus itself once its chunk has loaded)
        finalFocus={() => (writeAfterDialog.current ? document.getElementById(composerId) : null) ?? true}
        onSaved={(saved, _created, imageError) => {
          onItemChange(saved);
          setEditOpen(false);
          setNotice(imageError ? t('Đã lưu, nhưng chưa lưu được ảnh: {error}.', { error: imageError }) : t('Đã lưu'));
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
    </div>
  );
}
