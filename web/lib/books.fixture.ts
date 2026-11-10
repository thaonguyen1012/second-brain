// i18n-ignore-file: test data. Two made-up handbooks for unit tests, so no test depends on which handbooks are
// imported (the registry of lib/books.ts is the owner's data and may be empty). Use it through vi.mock:
//
//   vi.mock('./books', async (importOriginal) => {
//     const { mockRegistry } = await import('./books.fixture');
//     return mockRegistry(await importOriginal<typeof import('./books')>());
//   });
import type { Book } from './books';

export const fixtureBooks: Book[] = [
  {
    slug: 'garden-notes',
    title: 'Sổ tay 1 – Làm vườn cơ bản',
    description: 'Đất, nước và ánh sáng cho người mới trồng cây.',
    track: 'ky-nang',
    order: 1,
    lessonCount: 12,
    courseraUrls: [
      { title: 'Gardening for Beginners', url: 'https://www.coursera.org/learn/x', provider: 'Coursera' },
      { title: 'Soil Basics', url: null, provider: 'Coursera' },
    ],
    originalHtml: null,
    cover: 'hourglass',
  },
  {
    slug: 'bread-notes',
    title: 'Sổ tay Làm bánh mì',
    description: 'Bột, men và lò nướng.',
    track: 'kinh-doanh',
    order: 1,
    lessonCount: 5,
    courseraUrls: [],
    originalHtml: null,
    cover: null,
  },
];

/** The registry module with the fixture books in place of the real ones (helpers that read `books` included). */
export function mockRegistry<M extends typeof import('./books')>(actual: M): M {
  return {
    ...actual,
    books: fixtureBooks,
    getBook: (slug: string) => fixtureBooks.find((b) => b.slug === slug),
    booksByTrack: (track: Book['track']) =>
      fixtureBooks.filter((b) => b.track === track).sort((a, b) => a.order - b.order),
  };
}
