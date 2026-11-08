import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { books } from '../books';
import { contentText } from './content-lang';
import { enPage } from './en';
import { makeT } from './translate';

// Titles exactly as content/docs has them: page front matter, folder meta.json, sidebar separators.
const vietnamese = [
  '5.8 Margin Collapse là gì?', // only accents Vietnamese shares with French: à, ì
  '3.14 Thuộc tính href với hash và id #2',
  'Chương 31. Prototype phần 2, call, bind, apply',
  '17. Animation, BEM, Tags: table, iframe, video và audio', // the number goes with the Vietnamese part
  'Sổ tay 5 – Kế toán & tài chính', // two parts, both Vietnamese
  '🧭 Cách học với sổ tay này',
  'Sổ tay AI Engineering',
];
const english = [
  '31.2. MCP Server',
  'Module 1.4 · Meeting Arrangements on the Telephone',
  '8. More Introduction to Financial Accounting',
  '15.7 Position absolute #1',
  'Intuit Academy Bookkeeping – Intuit',
  '2.20 Comment trong HTML?', // Vietnamese without a diacritic: not seen
];

/** The markup of `node` inside a <p>. */
const html = (node: ReactNode) => renderToStaticMarkup(createElement('p', null, node));
/** `text` as an English page renders it. */
const en = (text: string) => html(contentText(text, 'en'));

describe('contentText', () => {
  it('puts a Vietnamese title in one span', () => {
    for (const title of vietnamese) {
      expect(en(title), title).toBe(html(createElement('span', { lang: 'vi' }, title)));
    }
    expect(en('Sổ tay 5 – Kế toán & tài chính')).toBe(
      '<p><span lang="vi">Sổ tay 5 – Kế toán &amp; tài chính</span></p>',
    );
    expect(en('Sổ tay AI Engineering'.normalize('NFD'))).toMatch(/^<p><span lang="vi">/);
  });

  it('marks only the Vietnamese label of an English title', () => {
    expect(en('Module 8.4 · Week 8: Deferred Taxes — Phần 4')).toBe(
      '<p>Module 8.4 · Week 8: Deferred Taxes — <span lang="vi">Phần 4</span></p>',
    );
    expect(en('⭐ Tóm tắt chương 3 – Tracking expenses, liabilities, and equity')).toBe(
      '<p><span lang="vi">⭐ Tóm tắt chương 3 – </span>Tracking expenses, liabilities, and equity</p>',
    );
    expect(en('Khóa 1. Supervised Machine Learning: Regression and Classification')).toBe(
      '<p><span lang="vi">Khóa 1. </span>Supervised Machine Learning: Regression and Classification</p>',
    );
    expect(en('Cách học với sổ tay này · How to use')).toBe(
      '<p><span lang="vi">Cách học với sổ tay này · </span>How to use</p>',
    );
  });

  it('returns text without a Vietnamese letter as it is', () => {
    for (const title of english) expect(contentText(title, 'en'), title).toBe(title);
    expect(contentText('2026', 'en')).toBe('2026');
  });

  it('returns no title, and the English that stands in for one, as it is', () => {
    expect(contentText(undefined, 'en')).toBeUndefined();
    expect(contentText(null, 'en')).toBeNull();
    expect(contentText('', 'en')).toBe('');
    const t = makeT('en', enPage);
    for (const text of [t('Mở đầu sổ tay'), t('Trang chủ'), ...books.map((b) => t(b.title))]) {
      expect(contentText(text, 'en'), text).toBe(text);
    }
    expect(t('Mở đầu sổ tay')).toBe('Handbook introduction');
  });

  it('changes nothing on a Vietnamese page', () => {
    for (const title of [...vietnamese, 'Module 8.4 · Week 8: Deferred Taxes — Phần 4']) {
      expect(contentText(title, 'vi'), title).toBe(title);
    }
  });
});
