import { coverName } from '@/lib/book-marks';
import { cn } from '@/lib/utils';

export type BookCoverVariant = 'band' | 'side' | 'thumb';

/**
 * A handbook's cover (DESIGN.md §9a; drawing rules in components/book-cover.md): the illustration
 * `public/covers/<cover>.svg` (the registry's `cover`, picked by the importer) on the flat cover ground, with the
 * book's name printed in HTML over the drawing's calm top-left. A printed object, so the same in both themes
 * (`--cover-ground`, `--cover-ink`).
 *
 * - `band`: full width at 16:7, cropped from the right (the Sổ tay card's top).
 * - `side`: the Hôm nay hero. Below sm a 16:7 band (with the name) on top of the card; from sm the column its parent
 *   gives it, filled edge to edge with the picture's right part and no name: the text beside it names the book (owner,
 *   07/11/2026: one side the handbook's picture, the other the title). Anchoring the whole 16:7 picture under a block
 *   of ground to keep the name shrank it to a strip in a beige box, the boxed look the split replaces.
 * - `thumb`: no name, cropped to the subject at the right; the parent sizes it (shelf rows, the phone card).
 *
 * Every crop keeps the right edge (object-right), so the subject, drawn inside the right square x 180-320 of the
 * 320x140 canvas (book-cover.md), survives every shape from 16:7 to a tall thumb.
 *
 * The name is 14-18px with the cover's width (container units), two lines at most. Decorative (`aria-hidden`): the
 * card or row around it always names the book. A static file in a plain <img>, never inline SVG, so nothing of the
 * drawing ships in a client bundle; this component has no hooks and renders on the server and the client alike. The
 * root is a block `span`, so it can sit inside a link. A book with no drawing (`cover` null) shows the ground and
 * its name; so does one whose file is missing: the broken image is painted over with the ground (`::after`, which
 * browsers draw only on an image that failed), so no broken-image icon shows.
 */
export function BookCover({
  cover,
  title,
  variant,
  className,
}: {
  /** The drawing: a file name of public/covers/ without ".svg" (lib/books.ts `cover`), or null for none. */
  cover: string | null | undefined;
  /** Registry title; the cover prints coverName(title). */
  title: string;
  variant: BookCoverVariant;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        '@container relative block overflow-hidden bg-cover-ground',
        variant === 'band' && 'aspect-[16/7]',
        variant === 'side' && 'max-sm:aspect-[16/7]',
        className,
      )}
    >
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- a static vector drawing; next/image adds nothing here
        <img
          src={`/covers/${cover}.svg`}
          alt=""
          loading={variant === 'side' ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 size-full object-cover object-right after:absolute after:inset-0 after:bg-cover-ground"
        />
      )}
      {variant !== 'thumb' && (
        <span
          className={cn(
            'absolute start-0 top-0 line-clamp-2 max-w-[56%] ps-[max(12px,5cqw)] pt-[max(12px,4.5cqw)]',
            'font-heading text-[length:clamp(14px,5.5cqw,18px)] leading-tight font-semibold tracking-tight text-balance text-cover-ink',
            variant === 'side' && 'sm:hidden',
          )}
        >
          {coverName(title)}
        </span>
      )}
    </span>
  );
}
