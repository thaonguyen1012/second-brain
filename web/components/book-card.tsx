import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { bookUrl, type Book, type CourseLink } from '@/lib/books';
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
import { BookProgress } from './progress';

const searchUrl = (title: string) => `https://www.coursera.org/search?query=${encodeURIComponent(title)}`;
const linkOf = (c: CourseLink) => c.url ?? searchUrl(c.title);

/**
 * The secondary links of a book ("Khóa học gốc", one per program, and "Bản gốc (HTML)") in one overflow menu, so
 * the card shows one action row: "Học ngay" plus this menu (DESIGN.md D22).
 */
function BookLinks({ book }: { book: Book }) {
  const links = book.courseraUrls;
  if (links.length === 0 && !book.originalHtml) return null;
  return (
    <Menu>
      <MenuTrigger
        render={<Button size="sm" variant="ghost" />}
        aria-label={`Liên kết khác của ${book.title}`}
      >
        Liên kết
        <ChevronDown aria-hidden />
      </MenuTrigger>
      <MenuPopup align="start" className="w-80 max-w-[calc(100vw-2rem)]">
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
    </Menu>
  );
}

/** Book card: one bordered container, title and description, progress (with the lesson count), one action row. */
export function BookCard({ book }: { book: Book }) {
  return (
    <Card render={<article />} className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-[15px] font-semibold leading-5 tracking-tight">
          <Link href={bookUrl(book)} className="hover:text-primary">
            {book.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{book.description}</p>
      </div>
      <BookProgress book={book.slug} total={book.lessonCount} />
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button size="sm" render={<Link href={bookUrl(book)} />}>
          Học ngay
        </Button>
        <BookLinks book={book} />
      </div>
    </Card>
  );
}
