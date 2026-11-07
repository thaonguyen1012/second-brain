import Link from 'next/link';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { bookUrl, type Book, type CourseLink } from '@/lib/books';
import { markOf } from '@/lib/book-marks';
import { trackFill, trackInk, trackSoft } from '@/lib/track-colors';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuLinkItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { BookAction } from './book-actions';
import { BookProgress } from './progress';

const searchUrl = (title: string) => `https://www.coursera.org/search?query=${encodeURIComponent(title)}`;
const linkOf = (c: CourseLink) => c.url ?? searchUrl(c.title);

/** The cover's source label: "Coursera · 4 khóa", or "F8" for the F8 book, which lists no programs. */
function sourceOf(book: Book): string | null {
  const links = book.courseraUrls;
  if (links.length > 0) return `${links[0].provider} · ${links.length} khóa`;
  return /\bF8\b/.test(book.title) ? 'F8' : null;
}

/**
 * The secondary links of a book ("Khóa học gốc", one per program, and "Bản gốc (HTML)") in one overflow menu, so
 * the card keeps one action row (DESIGN.md D22). `icon`: the ghost ⋯ of the phone card, with its tooltip (D21).
 */
function BookLinks({ book, icon = false, className }: { book: Book; icon?: boolean; className?: string }) {
  const links = book.courseraUrls;
  if (links.length === 0 && !book.originalHtml) return null;
  const label = `Liên kết khác của ${book.title}`;
  const popup = (
    <MenuPopup align={icon ? 'end' : 'start'} className="w-80 max-w-[calc(100vw-2rem)]">
      {links.length > 0 && (
        <MenuGroup>
          <MenuGroupLabel>Khóa học gốc · {links[0].provider}</MenuGroupLabel>
          {links.map((c) => (
            <MenuLinkItem key={c.title} render={<a href={linkOf(c)} target="_blank" rel="noreferrer" />}>
              <span className="flex-1">{c.title}</span>
              {!c.url && <span className="shrink-0 text-xs text-muted-foreground">tìm kiếm</span>}
            </MenuLinkItem>
          ))}
        </MenuGroup>
      )}
      {links.length > 0 && book.originalHtml && <MenuSeparator />}
      {book.originalHtml && (
        <MenuLinkItem render={<a href={book.originalHtml} target="_blank" rel="noreferrer" />}>
          Bản gốc (HTML)
        </MenuLinkItem>
      )}
    </MenuPopup>
  );
  if (icon) {
    return (
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={label} className={className} />} />
            }
          >
            <MoreHorizontal aria-hidden />
          </TooltipTrigger>
          <TooltipPopup>Liên kết</TooltipPopup>
        </Tooltip>
        {popup}
      </Menu>
    );
  }
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="ghost" className={className} />} aria-label={label}>
        Liên kết
        <ChevronDown aria-hidden />
      </MenuTrigger>
      {popup}
    </Menu>
  );
}

/**
 * Book card (DESIGN.md §9a): the cover band (the group tint, the monogram in the group hue, the source at the right),
 * the title as the link to the book, the description, progress in the group colour, one action row. The button is
 * filled on every card: the owner's call (03/11/2026), made knowing it puts 15 blue buttons on the page (§6, D2).
 * Below sm the card turns horizontal to keep the page short: the band becomes a 56px tile, the description goes,
 * and the button, with "Liên kết" as a ⋯ after it, sits beside the progress.
 */
export function BookCard({ book }: { book: Book }) {
  const source = sourceOf(book);
  return (
    <Card
      render={<article />}
      className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-0 gap-x-3 overflow-hidden border p-3 sm:flex sm:flex-col sm:p-0"
    >
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-lg sm:h-20 sm:w-auto sm:items-end sm:justify-between sm:rounded-none sm:px-4 sm:pb-3',
          trackSoft[book.track],
        )}
      >
        <span
          aria-hidden
          className={cn('font-heading text-lg leading-none font-semibold sm:text-2xl', trackInk[book.track])}
        >
          {markOf(book)}
        </span>
        {source && <span className="text-xs text-muted-foreground max-sm:hidden">{source}</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-1 sm:flex-1 sm:gap-4 sm:p-4">
        <div className="flex flex-col gap-1">
          {/* The clamp sits on the link: on the h3 its overflow would cut the link's focus ring. */}
          <h3 className="font-heading text-[15px] leading-5 font-semibold tracking-tight">
            <Link
              href={bookUrl(book)}
              className="line-clamp-2 rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              {book.title}
            </Link>
          </h3>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground max-sm:hidden">
            {book.description}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:contents">
          <div className="min-w-0 flex-1 sm:flex-none">
            <BookProgress book={book.slug} total={book.lessonCount} fill={trackFill[book.track]} />
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:mt-auto sm:gap-2">
            <BookAction slug={book.slug} href={bookUrl(book)} title={book.title} total={book.lessonCount} />
            {/* -me-2 puts the ⋯ glyph on the card's 12px inset. */}
            <BookLinks book={book} icon className="-me-2 sm:hidden" />
            <BookLinks book={book} className="max-sm:hidden" />
          </div>
        </div>
      </div>
    </Card>
  );
}
