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
  },
  {
    "slug": "handbook-10",
    "title": "Sổ tay DevOps, Cloud & IT",
    "description": "",
    "track": "it",
    "order": 5,
    "lessonCount": 530,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-10.html"
  },
  {
    "slug": "handbook-11",
    "title": "Sổ tay Fullstack Web (F8)",
    "description": "",
    "track": "it",
    "order": 6,
    "lessonCount": 808,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-11.html"
  },
  {
    "slug": "handbook-15",
    "title": "Sổ tay Google Project Management",
    "description": "",
    "track": "ky-nang",
    "order": 2,
    "lessonCount": 151,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-15.html"
  },
  {
    "slug": "handbook-12",
    "title": "Sổ tay Meta Front-End",
    "description": "",
    "track": "it",
    "order": 7,
    "lessonCount": 134,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-12.html"
  },
  {
    "slug": "handbook-13",
    "title": "Sổ tay Meta Full-Stack",
    "description": "",
    "track": "it",
    "order": 8,
    "lessonCount": 251,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-13.html"
  },
  {
    "slug": "handbook-01",
    "title": "Sổ tay 1 – Nền tảng kinh doanh",
    "description": "",
    "track": "kinh-doanh",
    "order": 2,
    "lessonCount": 176,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-01.html"
  },
  {
    "slug": "handbook-02",
    "title": "Sổ tay 2 – Tiếng Anh thương mại",
    "description": "",
    "track": "kinh-doanh",
    "order": 3,
    "lessonCount": 167,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-02.html"
  },
  {
    "slug": "handbook-03",
    "title": "Sổ tay 3 – Phân tích dữ liệu",
    "description": "",
    "track": "kinh-doanh",
    "order": 4,
    "lessonCount": 299,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-03.html"
  },
  {
    "slug": "handbook-04",
    "title": "Sổ tay 4 – Marketing & bán hàng",
    "description": "",
    "track": "kinh-doanh",
    "order": 5,
    "lessonCount": 190,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-04.html"
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
