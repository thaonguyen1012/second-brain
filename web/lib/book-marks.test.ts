import { describe, expect, it } from 'vitest';
import { books } from './books';
import { coverName } from './book-marks';

describe('coverName', () => {
  it('drops the series prefix of every handbook in the registry', () => {
    for (const b of books) {
      const name = coverName(b.title);
      expect(name, b.slug).toBeTruthy();
      expect(name, b.slug).not.toMatch(/^sổ tay/iu);
      expect(name, b.slug).not.toMatch(/^\d/);
      expect(b.title.normalize('NFC').endsWith(name), b.slug).toBe(true);
    }
  });

  it('keeps names unique', () => {
    const names = books.map((b) => coverName(b.title));
    expect(new Set(names).size).toBe(names.length);
  });

  it('handles the numbered, the plain and the odd titles', () => {
    expect(coverName('Sổ tay 1 – Nền tảng kinh doanh')).toBe('Nền tảng kinh doanh');
    expect(coverName('Sổ tay Fullstack Web (F8)')).toBe('Fullstack Web (F8)');
    expect(coverName('Sổ tay 6 - thống kê')).toBe('Thống kê');
    expect(coverName('sổ tay Học máy')).toBe('Học máy');
    expect(coverName('Sổ tay AI Engineering')).toBe('AI Engineering'); // decomposed "ổ"
    expect(coverName('Học máy')).toBe('Học máy');
    expect(coverName('Sổ tay')).toBe('Sổ tay');
  });
});
