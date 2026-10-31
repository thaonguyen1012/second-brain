import Link from 'next/link';
import { bookUrl, type Book, type CourseLink } from '@/lib/books';
import { BookProgress } from './progress';

const searchUrl = (title: string) => `https://www.coursera.org/search?query=${encodeURIComponent(title)}`;
const linkOf = (c: CourseLink) => c.url ?? searchUrl(c.title);

const button =
  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground';

/** "Khóa học gốc · <source>": one link, or a small menu when the book covers several programs. */
function SourceCourses({ book }: { book: Book }) {
  const links = book.courseraUrls;
  if (links.length === 0) return null;
  const provider = links[0].provider;
  if (links.length === 1)
    return (
      <a className={button} href={linkOf(links[0])} target="_blank" rel="noreferrer">
        Khóa học gốc · {provider}
      </a>
    );
  return (
    <details className="group relative">
      <summary className={`${button} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        Khóa học gốc · {provider}
        <span className="text-xs transition group-open:rotate-180">▾</span>
      </summary>
      <ul className="absolute bottom-full left-0 z-20 mb-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border bg-fd-popover p-1.5 text-sm shadow-lg">
        {links.map((c) => (
          <li key={c.title}>
            <a
              className="flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-1.5 hover:bg-fd-accent"
              href={linkOf(c)}
              target="_blank"
              rel="noreferrer"
            >
              <span>{c.title}</span>
              {!c.url && <span className="shrink-0 text-xs text-fd-muted-foreground">tìm kiếm</span>}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function BookCard({ book }: { book: Book }) {
  return (
    <article className="group flex flex-col gap-4 rounded-2xl border bg-fd-card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-fd-primary/40 hover:shadow-lg hover:shadow-fd-primary/5">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold leading-snug">
          <Link href={bookUrl(book)} className="hover:text-fd-primary">
            {book.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-fd-muted-foreground">{book.description}</p>
      </div>
      <BookProgress book={book.slug} total={book.lessonCount} />
      <div className="mt-auto flex flex-wrap gap-2">
        <Link
          href={bookUrl(book)}
          className="inline-flex items-center rounded-lg bg-fd-primary px-3 py-1.5 text-sm font-medium text-fd-primary-foreground transition hover:opacity-90"
        >
          Học ngay
        </Link>
        <SourceCourses book={book} />
        {book.originalHtml && (
          <a className={button} href={book.originalHtml} target="_blank" rel="noreferrer">
            Bản gốc (HTML)
          </a>
        )}
      </div>
    </article>
  );
}
