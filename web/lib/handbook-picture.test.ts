import { describe, expect, it, vi } from 'vitest';
import { books, bookUrl } from './books';
import { handbookForSource, itemPicture } from './handbook-picture';

// Fixture handbooks: the real registry is the owner's data and may be empty
vi.mock('./books', async (importOriginal) => {
  const { mockRegistry } = await import('./books.fixture');
  return mockRegistry(await importOriginal<typeof import('./books')>());
});

const book = books[0];

describe('handbookForSource', () => {
  it('finds the handbook of its page, with or without the trailing slash', () => {
    expect(handbookForSource(bookUrl(book))?.slug).toBe(book.slug);
    expect(handbookForSource(bookUrl(book).replace(/\/$/, ''))?.slug).toBe(book.slug);
    expect(handbookForSource(` ${bookUrl(book)} `)?.slug).toBe(book.slug);
  });

  it('knows nothing else', () => {
    expect(handbookForSource('/docs/kinh-doanh/khong-co/')).toBeUndefined();
    expect(handbookForSource('https://example.com/docs/x/')).toBeUndefined();
    expect(handbookForSource('')).toBeUndefined();
    expect(handbookForSource(null)).toBeUndefined();
  });
});

describe('itemPicture', () => {
  it('shows the Sổ tay cover of a handbook course without an image', () => {
    expect(itemPicture({ type: 'course', source: bookUrl(book), imageUrl: null })).toEqual({ kind: 'handbook', book });
  });

  it("puts the Item's own image first", () => {
    expect(itemPicture({ type: 'course', source: bookUrl(book), imageUrl: '/api/items/4/image?v=4' })).toMatchObject({
      kind: 'image',
      shape: 'cover',
    });
  });

  it('shows the icon of a tool’s first stage until it has a logo', () => {
    expect(itemPicture({ type: 'tool', tags: ['security', 'review'], imageUrl: null })).toEqual({
      kind: 'stage',
      stage: 'review',
    });
    expect(itemPicture({ type: 'tool', tags: [] })).toEqual({ kind: 'stage', stage: null });
    expect(itemPicture({ type: 'tool', tags: ['git'], imageUrl: '/api/items/5/image?v=5' })).toMatchObject({
      kind: 'image',
      shape: 'logo',
    });
  });

  it('shows nothing otherwise', () => {
    expect(itemPicture({ type: 'book', source: 'James Clear', imageUrl: null })).toBeNull();
    expect(itemPicture({ type: 'project', tags: ['security'], imageUrl: null })).toBeNull(); // only a tool has stages
    expect(itemPicture({ type: 'article', source: bookUrl(book) })).toBeNull(); // only a course is a handbook
  });
});
