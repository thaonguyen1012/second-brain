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
    expect(coverName('Sổ tay 1 – Làm vườn cơ bản')).toBe('Làm vườn cơ bản');
    expect(coverName('Sổ tay Guitar đệm hát (YouTube)')).toBe('Guitar đệm hát (YouTube)');
    expect(coverName('Sổ tay 6 - thống kê')).toBe('Thống kê');
    expect(coverName('sổ tay Học máy')).toBe('Học máy');
    expect(coverName('Sổ tay Machine Learning')).toBe('Machine Learning'); // decomposed "ổ"
    expect(coverName('Học máy')).toBe('Học máy');
    expect(coverName('Sổ tay')).toBe('Sổ tay');
  });

  it('reads the English titles the same way', () => {
    expect(coverName('Handbook 1 – Gardening basics')).toBe('Gardening basics');
    expect(coverName('Machine Learning handbook')).toBe('Machine Learning');
    expect(coverName('Guitar handbook (YouTube)')).toBe('Guitar (YouTube)');
    expect(coverName('Bread Baking handbook')).toBe('Bread Baking');
  });
});
