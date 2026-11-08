import { describe, expect, it } from 'vitest';
import { linkHref } from './note-links';

describe('linkHref', () => {
  it('is the deep link of each kind of record', () => {
    expect(linkHref('item', 12)).toBe('/thu-vien/item/?id=12');
    expect(linkHref('note', 3)).toBe('/thu-vien/ghi-chu/?id=3');
    expect(linkHref('opportunity', 7)).toBe('/co-hoi/?id=7');
    expect(linkHref('skill', 5)).toBe('/phat-trien/ky-nang/?id=5');
  });

});
