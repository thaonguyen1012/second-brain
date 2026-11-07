import { describe, expect, it } from 'vitest';
import { books } from './books';
import { bookMark, markOf } from './book-marks';

describe('markOf', () => {
  it('has a mark for every handbook in the registry', () => {
    for (const b of books) expect(bookMark[b.slug], b.slug).toBeTruthy();
  });

  it('keeps marks short and unique', () => {
    const marks = books.map((b) => markOf(b));
    expect(new Set(marks).size).toBe(marks.length);
    for (const m of marks) expect(m.length).toBeLessThanOrEqual(4);
  });

  it('falls back to two letters of the title after the prefix', () => {
    expect(markOf({ slug: 'new-book', title: 'Sổ tay Học máy' })).toBe('Họ');
    expect(markOf({ slug: 'new-book', title: 'Sổ tay 6 – thống kê' })).toBe('Th');
    expect(markOf({ slug: 'new-book', title: '' })).toBe('?');
  });
});
