// Handbook registry. The block between the BOOKS markers is maintained by
// scripts/import-gitbook.mjs (registerBook); titles, descriptions and links may be edited by hand.
// i18n-ignore-file: registry data. The UI shows titles, descriptions and track names through t(); their English is
// in lib/i18n/en/shell.ts, keyed by the Vietnamese, and lib/i18n/coverage.test.ts checks that every one has it.

export type TrackSlug = 'kinh-doanh' | 'it' | 'ky-nang';

export interface CourseLink {
  /** Program or course name as shown on the source site. */
  title: string;
  /** Exact URL found in the data, or null (for Coursera the UI falls back to a search link; else no link). */
  url: string | null;
  /** Where the course lives: 'Coursera', or the name of any other site. */
  provider: string;
}

export interface Book {
  slug: string;
  title: string;
  description: string;
  track: TrackSlug;
  order: number;
  /** Number of learning pages (lessons / lesson groups), the denominator for progress. */
  lessonCount: number;
  courseraUrls: CourseLink[];
  /** Path of the original single-file HTML under public/, or null. */
  originalHtml: string | null;
  /**
   * The drawing on the book's cover: a file name of public/covers/ without ".svg" (components/book-cover.md).
   * The importer picks one by the slug unless `--cover` names it; null or a missing file shows the plain ground.
   */
  cover?: string | null;
}

export const tracks: { slug: TrackSlug; title: string; description: string }[] = [
  { slug: 'kinh-doanh', title: 'Kinh doanh', description: 'Kinh doanh và vận hành doanh nghiệp.' },
  { slug: 'it', title: 'IT', description: 'Kỹ thuật: lập trình, dữ liệu, hạ tầng.' },
  { slug: 'ky-nang', title: 'Kỹ năng', description: 'Cách học và kỹ năng làm việc.' },
];

// BOOKS:START
export const books: Book[] = [
  {
    "slug": "sample-handbook",
    "title": "Using Alex's Brain",
    "description": "A sample handbook about the app itself: handbooks, lessons, progress, notes and the week. Replace it with your own.",
    "track": "ky-nang",
    "order": 1,
    "lessonCount": 6,
    "courseraUrls": [],
    "originalHtml": null,
    "cover": "hourglass"
  }
];
// BOOKS:END

export function getBook(slug: string): Book | undefined {
  return books.find((b) => b.slug === slug);
}

export function booksByTrack(track: TrackSlug): Book[] {
  return books.filter((b) => b.track === track).sort((a, b) => a.order - b.order);
}

export function bookUrl(book: Book): string {
  return `/docs/${book.track}/${book.slug}/`;
}
