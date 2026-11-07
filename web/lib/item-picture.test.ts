import { describe, expect, it } from 'vitest';
import { books, bookUrl } from './books';
import {
  MAX_IMAGE_BYTES,
  handbookForSource,
  imageFileProblem,
  imageShapeOf,
  isLocalImage,
  isWebLink,
  itemPicture,
} from './item-picture';

describe('imageFileProblem', () => {
  it('accepts the four formats the server decodes, up to 10 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
      expect(imageFileProblem({ type, size: 1000 })).toBeNull();
    expect(imageFileProblem({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull();
  });

  it('says why before any upload', () => {
    expect(imageFileProblem({ type: 'image/svg+xml', size: 10 })).toBe('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.');
    expect(imageFileProblem({ type: 'image/heic', size: 10 })).toBe('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.');
    expect(imageFileProblem({ type: '', size: 10 })).toBe('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.');
    expect(imageFileProblem({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 })).toBe('Ảnh lớn hơn 10 MB.');
  });
});

describe('isWebLink', () => {
  it('is true only for an http(s) address', () => {
    expect(isWebLink('https://www.imdb.com/title/tt1/')).toBe(true);
    expect(isWebLink(' http://example.com ')).toBe(true);
    expect(isWebLink('James Clear')).toBe(false);
    expect(isWebLink('/docs/it/x/')).toBe(false);
    expect(isWebLink('https://')).toBe(false);
    expect(isWebLink('')).toBe(false);
    expect(isWebLink(undefined)).toBe(false);
  });
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

describe('imageShapeOf', () => {
  it('gives books and films a poster, projects a logo, the rest a cover', () => {
    expect(imageShapeOf('book')).toBe('poster');
    expect(imageShapeOf('film')).toBe('poster');
    expect(imageShapeOf('project')).toBe('logo');
    expect(imageShapeOf('article')).toBe('cover');
    expect(imageShapeOf('course')).toBe('cover');
  });
});

describe('isLocalImage', () => {
  it('accepts only same-origin paths', () => {
    expect(isLocalImage('/api/items/3/image?v=ab12cd34')).toBe(true);
    expect(isLocalImage('//evil.example/x.png')).toBe(false);
    expect(isLocalImage('https://example.com/x.png')).toBe(false);
    expect(isLocalImage('data:image/png;base64,AAAA')).toBe(false);
    expect(isLocalImage('')).toBe(false);
    expect(isLocalImage(null)).toBe(false);
    expect(isLocalImage(undefined)).toBe(false);
  });
});

describe('itemPicture', () => {
  it("shows the Item's own image in the shape of its type", () => {
    expect(itemPicture({ type: 'film', imageUrl: '/api/items/1/image?v=1' })).toEqual({
      kind: 'image',
      url: '/api/items/1/image?v=1',
      shape: 'poster',
    });
    expect(itemPicture({ type: 'project', imageUrl: '/api/items/2/image?v=2' })).toMatchObject({ shape: 'logo' });
  });

  it('shows the Sổ tay cover of a handbook course without an image', () => {
    expect(itemPicture({ type: 'course', source: bookUrl(book), imageUrl: null })).toEqual({ kind: 'handbook', book });
    // an image of its own wins over the cover
    expect(itemPicture({ type: 'course', source: bookUrl(book), imageUrl: '/api/items/4/image?v=4' })).toMatchObject({
      kind: 'image',
      shape: 'cover',
    });
  });

  it('shows nothing otherwise', () => {
    expect(itemPicture({ type: 'book', source: 'James Clear', imageUrl: null })).toBeNull();
    expect(itemPicture({ type: 'article', source: bookUrl(book) })).toBeNull(); // only a course is a handbook
    expect(itemPicture({ type: 'book', imageUrl: 'https://example.com/cover.jpg' })).toBeNull();
  });
});
