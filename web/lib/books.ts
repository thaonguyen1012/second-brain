// Handbook registry. The block between the BOOKS markers is maintained by
// scripts/import-gitbook.mjs (registerBook); titles, descriptions and links may be edited by hand.

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
  /** Number of learning pages (lessons / lesson groups), the denominator for progress. */
  lessonCount: number;
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
    "lessonCount": 630,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-08.html"
  },
  {
    "slug": "handbook-05",
    "title": "Sổ tay 5 – Kế toán & tài chính",
    "description": "",
    "track": "kinh-doanh",
    "order": 1,
    "lessonCount": 65,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-05.html"
  },
  {
    "slug": "handbook-06",
    "title": "Sổ tay AI Engineering",
    "description": "",
    "track": "it",
    "order": 2,
    "lessonCount": 587,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-06.html"
  },
  {
    "slug": "handbook-07",
    "title": "Sổ tay AI & tự động hóa",
    "description": "",
    "track": "it",
    "order": 3,
    "lessonCount": 488,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-07.html"
  },
  {
    "slug": "handbook-09",
    "title": "Sổ tay Data Engineering & Robotics",
    "description": "",
    "track": "it",
    "order": 4,
    "lessonCount": 240,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-09.html"
  },
  {
    "slug": "handbook-14",
    "title": "Sổ tay Learning How to Learn",
    "description": "",
    "track": "ky-nang",
    "order": 1,
    "lessonCount": 30,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-14.html"
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
