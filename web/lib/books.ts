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
    "slug": "handbook-01",
    "title": "Sổ tay 1 – Nền tảng kinh doanh",
    "description": "Marketing, kế toán, tài chính, vận hành, khởi nghiệp, chiến lược và Excel: 19 khóa của Wharton, Darden và Macquarie.",
    "track": "kinh-doanh",
    "order": 1,
    "lessonCount": 176,
    "courseraUrls": [
      {
        "title": "Business Foundations (Wharton)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Entrepreneurship (Wharton)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Business Strategy (Darden)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Excel Skills for Business (Macquarie)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-01.html"
  },
  {
    "slug": "handbook-02",
    "title": "Sổ tay 2 – Tiếng Anh thương mại",
    "description": "Tiếng Anh giao tiếp công việc: networking, họp, đàm phán, thuyết trình, viết email và tiếng Anh chuyên ngành.",
    "track": "kinh-doanh",
    "order": 2,
    "lessonCount": 167,
    "courseraUrls": [
      {
        "title": "Business English Communication Skills (UW)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Business English for Non-Native Speakers (HKUST)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Business English (Arizona State)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Improve Your English Communication Skills (Georgia Tech)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Essential English for Business Professionals (UC Irvine)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-02.html"
  },
  {
    "slug": "handbook-03",
    "title": "Sổ tay 3 – Phân tích dữ liệu",
    "description": "Phân tích dữ liệu từ Google, IBM và Microsoft: bảng tính, SQL, Python, Power BI, thống kê và machine learning.",
    "track": "kinh-doanh",
    "order": 3,
    "lessonCount": 299,
    "courseraUrls": [
      {
        "title": "Google Data Analytics",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "IBM Data Analyst",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Microsoft Power BI Data Analyst",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google Advanced Data Analytics",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-03.html"
  },
  {
    "slug": "handbook-04",
    "title": "Sổ tay 4 – Marketing & bán hàng",
    "description": "Digital marketing, thương mại điện tử, mạng xã hội, marketing analytics và bán hàng với CRM.",
    "track": "kinh-doanh",
    "order": 4,
    "lessonCount": 190,
    "courseraUrls": [
      {
        "title": "Google Digital Marketing & E-commerce",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Meta Social Media Marketing",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Marketing Analytics (Darden)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "HubSpot Sales Representative",
        "url": null,
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-04.html"
  },
  {
    "slug": "handbook-05",
    "title": "Sổ tay 5 – Kế toán & tài chính",
    "description": "Kế toán sổ sách, báo cáo tài chính, tài chính doanh nghiệp và kế toán quản trị.",
    "track": "kinh-doanh",
    "order": 5,
    "lessonCount": 65,
    "courseraUrls": [
      {
        "title": "Intuit Academy Bookkeeping",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Introduction to Finance and Accounting (Wharton)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Finance for Non-Financial Professionals",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Managerial Accounting",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-05.html"
  },
  {
    "slug": "handbook-06",
    "title": "Sổ tay AI Engineering",
    "description": "Machine learning, deep learning, generative AI, RAG và agent, đưa mô hình vào production.",
    "track": "it",
    "order": 1,
    "lessonCount": 587,
    "courseraUrls": [
      {
        "title": "Machine Learning Specialization",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Deep Learning Specialization",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "IBM Generative AI Engineering",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "IBM RAG and Agentic AI",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "IBM AI Engineering",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Machine Learning in Production",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-06.html"
  },
  {
    "slug": "handbook-07",
    "title": "Sổ tay AI & tự động hóa",
    "description": "AI cho mọi người và cho doanh nghiệp, prompting, agent, tự động hóa với Python, Git và Power Automate.",
    "track": "it",
    "order": 2,
    "lessonCount": 488,
    "courseraUrls": [
      {
        "title": "AI for Everyone",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Generative AI for Everyone",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google AI Essentials",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google Prompting Essentials",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google AI Professional Certificate",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Generative AI for Executives and Business Leaders (IBM)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Generative AI in Business (Michigan)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "AI for Business (Wharton)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Agentic AI and AI Agents for Leaders (Vanderbilt)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "AI Agent Skills for Leaders (Vanderbilt)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google IT Automation with Python",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Power Automate",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-07.html"
  },
  {
    "slug": "handbook-08",
    "title": "Sổ tay An ninh mạng",
    "description": "An ninh mạng từ nền tảng tới chuyên sâu: Google, IBM và Microsoft Cybersecurity Analyst.",
    "track": "it",
    "order": 3,
    "lessonCount": 630,
    "courseraUrls": [
      {
        "title": "Cybersecurity for Everyone (Maryland)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google Cybersecurity",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "IBM Cybersecurity Analyst",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Microsoft Cybersecurity Analyst",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-08.html"
  },
  {
    "slug": "handbook-09",
    "title": "Sổ tay Data Engineering & Robotics",
    "description": "Data engineering trên AWS và Google Cloud, cùng robotics và xe tự lái.",
    "track": "it",
    "order": 4,
    "lessonCount": 240,
    "courseraUrls": [
      {
        "title": "DeepLearning.AI Data Engineering",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google Cloud Data Engineering",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Modern Robotics (Northwestern)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Self-Driving Cars (Toronto)",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-09.html"
  },
  {
    "slug": "handbook-10",
    "title": "Sổ tay DevOps, Cloud & IT",
    "description": "DevOps và kỹ nghệ phần mềm, cloud (Google Cloud, AWS) và IT support.",
    "track": "it",
    "order": 5,
    "lessonCount": 530,
    "courseraUrls": [
      {
        "title": "IBM DevOps and Software Engineering",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google Cloud DevOps / SRE",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google Cloud Digital Leader",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "AWS Cloud Practitioner Essentials",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Google IT Support",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-10.html"
  },
  {
    "slug": "handbook-11",
    "title": "Sổ tay Fullstack Web (F8)",
    "description": "Lộ trình Fullstack Web của F8: HTML, CSS, JavaScript và các bài thực hành.",
    "track": "it",
    "order": 6,
    "lessonCount": 808,
    "courseraUrls": [],
    "originalHtml": "/original/handbook-11.html"
  },
  {
    "slug": "handbook-12",
    "title": "Sổ tay Meta Front-End",
    "description": "Front-end với HTML, CSS, JavaScript, React và UX/UI theo chương trình của Meta.",
    "track": "it",
    "order": 7,
    "lessonCount": 134,
    "courseraUrls": [
      {
        "title": "Meta Front-End Developer",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-12.html"
  },
  {
    "slug": "handbook-13",
    "title": "Sổ tay Meta Full-Stack",
    "description": "Front-end và back-end theo Meta: React, Python, Django, API và cơ sở dữ liệu.",
    "track": "it",
    "order": 8,
    "lessonCount": 251,
    "courseraUrls": [
      {
        "title": "Meta Front-End Developer",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      },
      {
        "title": "Meta Back-End Developer",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-13.html"
  },
  {
    "slug": "handbook-14",
    "title": "Sổ tay Learning How to Learn",
    "description": "Kỹ thuật học hiệu quả: tập trung và phân tán, chunking, chống trì hoãn, ghi nhớ.",
    "track": "ky-nang",
    "order": 1,
    "lessonCount": 30,
    "courseraUrls": [
      {
        "title": "Learning How to Learn",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-14.html"
  },
  {
    "slug": "handbook-15",
    "title": "Sổ tay Google Project Management",
    "description": "Quản lý dự án theo Google: khởi tạo, lập kế hoạch, thực thi, Agile và Scrum.",
    "track": "ky-nang",
    "order": 2,
    "lessonCount": 151,
    "courseraUrls": [
      {
        "title": "Google Project Management",
        "url": "https://www.coursera.org/",
        "provider": "Coursera"
      }
    ],
    "originalHtml": "/original/handbook-15.html"
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
