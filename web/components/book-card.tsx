import Link from 'next/link';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { bookUrl, type Book, type CourseLink } from '@/lib/books';
import { trackFill } from '@/lib/track-colors';
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
import { BookCover } from './book-cover';
import { BookProgress } from './progress';
import type { T } from '@/lib/i18n/translate';

const searchUrl = (title: string) => `https://www.coursera.org/search?query=${encodeURIComponent(title)}`;
const linkOf = (c: CourseLink) => c.url ?? searchUrl(c.title);

/** The source line under the title: "Coursera · 4 khóa", or "F8" for the F8 book, which lists no programs. */
function sourceOf(book: Book, t: T): string | null {
  const links = book.courseraUrls;
  if (links.length > 0) return t('{provider} · {n} khóa', { provider: links[0].provider, n: links.length });
  return /\bF8\b/.test(book.title) ? 'F8' : null;
}

/**
 * The secondary links of a book ("Khóa học gốc", one per program, and "Bản gốc (HTML)") in one overflow menu, so
 * the card keeps one action row (DESIGN.md D22). `icon`: the ghost ⋯ of the phone card, with its tooltip (D21).
 */
function BookLinks({ book, t, icon = false, className }: { book: Book; t: T; icon?: boolean; className?: string }) {
  const links = book.courseraUrls;
  if (links.length === 0 && !book.originalHtml) return null;
  const label = t('Liên kết khác của {title}', { title: t(book.title) });
  const popup = (
    <MenuPopup align={icon ? 'end' : 'start'} className="w-80 max-w-[calc(100vw-2rem)]">
      {links.length > 0 && (
        <MenuGroup>
          <MenuGroupLabel>{t('Khóa học gốc · {provider}', { provider: links[0].provider })}</MenuGroupLabel>
          {links.map((c) => (
            <MenuLinkItem key={c.title} render={<a href={linkOf(c)} target="_blank" rel="noreferrer" />}>
              <span className="flex-1">{c.title}</span>
              {!c.url && <span className="shrink-0 text-xs text-muted-foreground">{t('tìm kiếm')}</span>}
            </MenuLinkItem>
          ))}
        </MenuGroup>
      )}
      {links.length > 0 && book.originalHtml && <MenuSeparator />}
      {book.originalHtml && (
        <MenuLinkItem render={<a href={book.originalHtml} target="_blank" rel="noreferrer" />}>
          {t('Bản gốc (HTML)')}
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
          <TooltipPopup>{t('Liên kết')}</TooltipPopup>
        </Tooltip>
        {popup}
      </Menu>
    );
  }
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="ghost" className={className} />} aria-label={label}>
        {t('Liên kết')}
        <ChevronDown aria-hidden />
      </MenuTrigger>
      {popup}
    </Menu>
  );
}

/**
 * Book card (DESIGN.md §9a): the illustrated cover as a full-bleed 16:7 band (its name printed on it), the title as
 * the link to the book, the source and the description, progress in the group colour, one action row. The button is
 * filled on every card: the owner's call (03/11/2026), made knowing it puts 15 blue buttons on the page (§6, D2).
 * Below sm the card turns horizontal to keep the page short: the cover becomes a flush left column the card's height
 * (its subject, no name), source and description go, and the button, with "Liên kết" as a ⋯ after it, sits beside
 * the progress.
 */
export function BookCard({ book, t }: { book: Book; t: T }) {
  const source = sourceOf(book, t);
  const title = t(book.title);
  return (
    <Card
      render={<article />}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-0 overflow-hidden border p-0 sm:flex sm:flex-col"
    >
      <BookCover slug={book.slug} title={title} variant="thumb" className="sm:hidden" />
      <BookCover slug={book.slug} title={title} variant="band" className="max-sm:hidden" />
      <div className="flex min-w-0 flex-col gap-1 p-3 sm:flex-1 sm:gap-4 sm:p-4">
        <div className="flex flex-col gap-1">
          {/* The clamp sits on the link: on the h3 its overflow would cut the link's focus ring. */}
          <h3 className="font-heading text-[15px] leading-5 font-semibold tracking-tight">
            <Link
              href={bookUrl(book)}
              className="line-clamp-2 rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            >
              {title}
            </Link>
          </h3>
          {source && <p className="text-xs text-muted-foreground max-sm:hidden">{source}</p>}
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground max-sm:hidden">
            {t(book.description)}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:contents">
          <div className="min-w-0 flex-1 sm:flex-none">
            <BookProgress book={book.slug} total={book.lessonCount} fill={trackFill[book.track]} />
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:mt-auto sm:gap-2">
            <BookAction slug={book.slug} href={bookUrl(book)} title={title} total={book.lessonCount} />
            {/* -me-2 puts the ⋯ glyph on the card's 12px inset. */}
            <BookLinks book={book} t={t} icon className="-me-2 sm:hidden" />
            <BookLinks book={book} t={t} className="max-sm:hidden" />
          </div>
        </div>
      </div>
    </Card>
  );
}
