import type { ReactNode } from 'react';
import { BookCover } from '@/components/book-cover';
import type { ItemPicture } from '@/lib/item-picture';
import { cn } from '@/lib/utils';

// How an Item's picture (lib/item-picture.ts) is drawn (DESIGN.md §9a "Item images"): flush with the edges of its row
// or card, clipped only by the container's radius (the split rule of covers), never a framed or padded box, no text
// or scrim on it; a project logo is the one inset picture, on the logo ground. Decorative: the row or card always
// names the record, so every picture is alt="" and aria-hidden. Local images only (isLocalImage).

/** A plain <img> for an uploaded or fetched image (already a small webp from the server). */
function Img({ url, className }: { url: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small local webp; next/image adds nothing here
  return <img src={url} alt="" loading="lazy" decoding="async" draggable={false} className={className} />;
}

/** A logo inside its ground, scaled to fit. */
function Logo({ url, className }: { url: string; className?: string }) {
  return (
    <span className={cn('flex items-center justify-center bg-logo-ground', className)}>
      <Img url={url} className="max-h-full max-w-full object-contain" />
    </span>
  );
}

/**
 * The picture cell of a Thư viện or Công việc row: a flush square as tall as the row (56px), the handbook's cover
 * thumb, an image cropped to the square, or a logo inside it. Without a picture the cell stays empty, so the columns
 * still line up (DESIGN.md §3).
 */
export function RowPicture({ picture, className }: { picture: ItemPicture | null; className?: string }) {
  return (
    <span aria-hidden className={cn('relative -my-2 block w-14 self-stretch overflow-hidden', className)}>
      {picture?.kind === 'handbook' ? (
        <BookCover slug={picture.book.slug} title={picture.book.title} variant="thumb" className="absolute inset-0" />
      ) : picture?.shape === 'logo' ? (
        <Logo url={picture.url} className="absolute inset-0 p-2" />
      ) : picture ? (
        <Img url={picture.url} className="absolute inset-0 size-full object-cover" />
      ) : null}
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
 * card's start (a 4rem column, 2:3 at the card's minimum height), or a 40px logo before the title.
 */
export function boardMedia(picture: ItemPicture | null): BoardMedia | null {
  if (!picture) return null;
  if (picture.kind === 'handbook')
    return {
      placement: 'top',
      node: <BookCover slug={picture.book.slug} title={picture.book.title} variant="band" />,
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
