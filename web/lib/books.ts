// Handbook registry. The block between the BOOKS markers is maintained by
// scripts/import-gitbook.mjs (registerBook); edit titles/descriptions/links by hand if needed.

export type TrackSlug = 'kinh-doanh' | 'it' | 'ky-nang';

export interface CourseLink {
  /** Program or course name as shown on the source site. */
  title: string;
  /** Exact URL found in the data, or null (UI falls back to a search link). */
  url: string | null;
  /** Where the course lives. */
  provider: 'Coursera' | 'F8';
}

export interface Book {
  slug: string;
  title: string;
  description: string;
  track: TrackSlug;
  order: number;
  /** Number of chapters (modules). */
  chapterCount: number;
  /** Number of pages, used as the denominator for progress. */
  pageCount: number;
  courseraUrls: CourseLink[];
  /** Path of the original single-file HTML under public/, or null. */
  originalHtml: string | null;
}

export const tracks: { slug: TrackSlug; title: string; description: string }[] = [
  { slug: 'kinh-doanh', title: 'Kinh doanh', description: 'Vận hành doanh nghiệp: nền tảng, tiếng Anh, dữ liệu, marketing, kế toán.' },
  { slug: 'it', title: 'IT', description: 'Đi sâu kỹ thuật: AI, an ninh mạng, dữ liệu, DevOps, web.' },
  { slug: 'ky-nang', title: 'Kỹ năng', description: 'Học cách học và quản lý dự án.' },
];

// BOOKS:START
export const books: Book[] = [
  {
    "slug": "handbook-08",
    "title": "Sổ tay An ninh mạng",
    "description": "",
    "track": "it",
    "order": 1,
    "chapterCount": 141,
    "pageCount": 2433,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-08.html"
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
