import type { ReactNode } from 'react';
import { BookCover } from '@/components/book-cover';
import type { ItemPicture } from '@/lib/item-picture';
import type { T } from '@/lib/i18n/translate';
import { toolStageIcons } from '@/lib/tool-icons';
import type { ToolStage } from '@/lib/tools';
import { cn } from '@/lib/utils';

// How an Item's picture (lib/item-picture.ts) is drawn (DESIGN.md §9a "Item images"): flush with the edges of its row
// or card, clipped only by the container's radius (the split rule of covers), never a framed or padded box, no text
// or scrim on it; a project's or a tool's logo is the one inset picture, on the logo ground, and a tool without a
// logo shows its stage's icon in that place (no ground, no tile). Decorative: the row or card always names the
// record, so every picture is alt="" and aria-hidden. Local images only (isLocalImage).

/** A plain <img> for an uploaded or fetched image (already a small webp from the server). */
function Img({ url, className }: { url: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small local webp; next/image adds nothing here
  return <img src={url} alt="" loading="lazy" decoding="async" draggable={false} className={className} />;
}

/**
 * A logo inside its ground, scaled to fit. The white ground is kept under forced colours too: there the system would
 * paint it Canvas (black in the dark contrast themes) and a dark transparent logo would vanish.
 */
function Logo({ url, className }: { url: string; className?: string }) {
  return (
    <span className={cn('flex items-center justify-center bg-logo-ground forced-color-adjust-none', className)}>
      <Img url={url} className="max-h-full max-w-full object-contain" />
    </span>
  );
}

/**
 * A tool's stage icon in the place of its missing logo (owner 13/11/2026): the lucide icon centred in the slot, muted
 * ink with the page title icon's 1.5 line, nothing behind it (no colour per stage, no tile; DESIGN.md §9a).
 */
function StageGlyph({ stage, className, iconClass }: { stage: ToolStage | null; className?: string; iconClass: string }) {
  const Icon = toolStageIcons[stage ?? 'other'];
  return (
    <span className={cn('flex items-center justify-center text-muted-foreground', className)}>
      <Icon className={cn(iconClass, 'forced-colors:text-inherit')} strokeWidth={1.5} absoluteStrokeWidth />
    </span>
  );
}

/**
 * The picture cell of a Thư viện, Công cụ or Công việc row: a flush square as tall as the row (56px), the handbook's
 * cover thumb, an image cropped to the square, a logo inside it, or a tool's stage icon in the logo's place. Without a
 * picture the cell stays empty, so the columns still line up (DESIGN.md §3).
 */
export function RowPicture({ picture, className }: { picture: ItemPicture | null; className?: string }) {
  return (
    <span aria-hidden className={cn('relative -my-2 block w-14 self-stretch overflow-hidden', className)}>
      {picture?.kind === 'handbook' ? (
        <BookCover cover={picture.book.cover} title={picture.book.title} variant="thumb" className="absolute inset-0" />
      ) : picture?.kind === 'stage' ? (
        <StageGlyph stage={picture.stage} className="absolute inset-0" iconClass="size-6" />
      ) : picture?.shape === 'logo' ? (
        <Logo url={picture.url} className="absolute inset-0 p-2" />
      ) : picture ? (
        <Img url={picture.url} className="absolute inset-0 size-full object-cover" />
      ) : null}
    </span>
  );
}

/**
 * The picture at the start of the Item page's header (the Sheet and /thu-vien/item/): the record's own object beside
 * its title, at its shape (a 2:3 poster, a 16:7 cover, the handbook's cover thumb, a logo on its ground), rounded-md
 * with no frame or shadow (DESIGN.md §9a "Item images"). Nothing without a picture.
 */
export function DetailPicture({ picture, className }: { picture: ItemPicture | null; className?: string }) {
  if (!picture) return null;
  const box = 'block shrink-0 overflow-hidden rounded-md';
  if (picture.kind === 'stage')
    return (
      <span aria-hidden className={cn('shrink-0', className)}>
        <StageGlyph stage={picture.stage} className="size-12 sm:size-14" iconClass="size-7" />
      </span>
    );
  if (picture.kind === 'handbook')
    return (
      <BookCover
        cover={picture.book.cover}
        title={picture.book.title}
        variant="thumb"
        className={cn(box, 'size-16 sm:size-20', className)}
      />
    );
  return (
    <span aria-hidden className={cn(box, picture.shape === 'poster' ? 'aspect-[2/3] w-16 sm:w-20' : picture.shape === 'logo' ? 'size-12 sm:size-14' : 'aspect-[16/7] w-28 sm:w-36', className)}>
      {picture.shape === 'logo' ? (
        <Logo url={picture.url} className="size-full p-1.5" />
      ) : (
        <Img url={picture.url} className="size-full object-cover" />
      )}
    </span>
  );
}

/** Where a picture sits on a board card (components/brain/status-board.tsx). */
export type MediaPlacement = 'top' | 'start' | 'inline';

export interface BoardMedia {
  node: ReactNode;
  placement: MediaPlacement;
}

/**
 * A board card's picture: the handbook's cover band or a landscape cover flush on top (16:7), a poster flush down the
 * card's start (a 4rem column, 2:3 at the card's minimum height), or a 40px logo before the title (a tool without
 * one: its stage icon in that 40px place).
 */
export function boardMedia(picture: ItemPicture | null, t: T): BoardMedia | null {
  if (!picture) return null;
  if (picture.kind === 'stage')
    return { placement: 'inline', node: <StageGlyph stage={picture.stage} className="size-10" iconClass="size-5" /> };
  if (picture.kind === 'handbook')
    return {
      placement: 'top',
      node: <BookCover cover={picture.book.cover} title={t(picture.book.title)} variant="band" />,
    };
  if (picture.shape === 'logo')
    return { placement: 'inline', node: <Logo url={picture.url} className="size-10 overflow-hidden rounded-md p-1" /> };
  if (picture.shape === 'poster')
    return { placement: 'start', node: <Img url={picture.url} className="absolute inset-0 size-full object-cover" /> };
  return {
    placement: 'top',
    node: (
      <span className="block aspect-[16/7] overflow-hidden">
        <Img url={picture.url} className="size-full object-cover" />
      </span>
    ),
  };
}
