import { describe, expect, it } from 'vitest';
import { appNav, navAreas, navMatch, navRow, navRows, otherNav } from './app-nav';

describe('sidebar model', () => {
  it('keeps the six areas of DECISIONS 9.3, in order', () => {
    expect(navAreas.map((a) => a.title.msgid)).toEqual(['Hôm nay', 'Tuần', 'Phát triển', 'Thư viện', 'Cơ hội', 'Công việc']);
    expect(new Set(navRows.map((r) => r.area)).size).toBe(6);
    expect(appNav[0]).not.toHaveProperty('label');
  });

  it('gives every page one row', () => {
    const hrefs = [...navRows, ...otherNav.links].map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^\/([a-z-]+\/)*$/);
  });
});

describe('navMatch', () => {
  it('picks the longest row href, so a sub-page is not its parent', () => {
    expect(navRow('/phat-trien/')?.title.msgid).toBe('Sổ tay');
    expect(navRow('/phat-trien/ky-nang/')?.title.msgid).toBe('Kỹ năng');
    expect(navRow('/thu-vien/ghi-chu/')?.title.msgid).toBe('Ghi chú');
    expect(navRow('/cong-viec/gio/')?.title.msgid).toBe('Giờ');
  });

  it('matches "/" only by itself and ignores a query or hash', () => {
    expect(navRow('/')?.title.msgid).toBe('Hôm nay');
    expect(navRow('/inbox/')).toBeUndefined();
    expect(navRow('/tuan/?tab=nhin-lai')?.title.msgid).toBe('Tuần');
    expect(navRow('/phat-trien/thanh-tuu/#pred-title')?.title.msgid).toBe('Nhật ký thành tựu');
  });

  it('finds the Khác rows when given them', () => {
    expect(navMatch([...navRows, ...otherNav.links], '/huong-dan/')?.title.msgid).toBe('Hướng dẫn');
  });
});
