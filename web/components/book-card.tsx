import Link from 'next/link';
import { bookUrl, type Book, type CourseLink } from '@/lib/books';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BookProgress } from './progress';

const searchUrl = (title: string) => `https://www.coursera.org/search?query=${encodeURIComponent(title)}`;
const linkOf = (c: CourseLink) => c.url ?? searchUrl(c.title);

/** "Khóa học gốc · <source>": one link, or a small menu when the book covers several programs. */
function SourceCourses({ book }: { book: Book }) {
  const links = book.courseraUrls;
  if (links.length === 0) return null;
  const provider = links[0].provider;
  if (links.length === 1)
    return (
      <Button variant="outline" size="sm" render={<a href={linkOf(links[0])} target="_blank" rel="noreferrer" />}>
        Khóa học gốc · {provider}
      </Button>
    );
  return (
    <details className="group relative">
      <Button
        variant="outline"
        size="sm"
        render={<summary />}
        className="list-none [&::-webkit-details-marker]:hidden"
      >
        Khóa học gốc · {provider}
        <span className="text-xs transition group-open:rotate-180">▾</span>
      </Button>
      <ul className="absolute bottom-full left-0 z-20 mb-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border bg-popover p-1.5 text-sm shadow-popover">
        {links.map((c) => (
          <li key={c.title}>
            <a
              className="flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 hover:bg-accent"
              href={linkOf(c)}
              target="_blank"
              rel="noreferrer"
            >
              <span>{c.title}</span>
              {!c.url && <span className="shrink-0 text-xs text-muted-foreground">tìm kiếm</span>}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Book card after the Brainwave "Scene Card": a tinted panel with the title, then progress and actions. */
export function BookCard({ book }: { book: Book }) {
  return (
    <Card
      render={<article />}
      className="flex flex-col gap-2 rounded-3xl border p-2 shadow-depth-1 transition-shadow duration-200 hover:shadow-popover"
    >
      <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-4">
        <Badge variant="outline" className="self-start">
          {book.lessonCount} bài
        </Badge>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-heading text-[15px] font-semibold leading-5 tracking-tight">
            <Link href={bookUrl(book)} className="hover:text-primary">
              {book.title}
            </Link>
          </h3>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{book.description}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-3">
        <BookProgress book={book.slug} total={book.lessonCount} />
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" render={<Link href={bookUrl(book)} />}>
            Học ngay
          </Button>
          <SourceCourses book={book} />
          {book.originalHtml && (
            <Button variant="outline" size="sm" render={<a href={book.originalHtml} target="_blank" rel="noreferrer" />}>
              Bản gốc (HTML)
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
