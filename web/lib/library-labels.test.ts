import { describe, expect, it } from 'vitest';
import type { ApiInboxEntry } from '@/lib/api/client';
import { formatDate } from './labels';
import { tVi } from './i18n/translate';
import { itemDateLabel, itemDraftFromEntry, itemSourceLabel, itemTypeForEntry, noteTitle } from './library-labels';

describe('itemSourceLabel', () => {
  it('names a handbook "Sổ tay", a link by its host, and keeps free text', () => {
    expect(itemSourceLabel('/docs/kinh-doanh/handbook-01/', tVi)).toBe('Sổ tay');
    expect(itemSourceLabel('https://www.goodreads.com/book/show/1', tVi)).toBe('goodreads.com');
    expect(itemSourceLabel('HTTP://Example.com/x', tVi)).toBe('example.com');
    expect(itemSourceLabel('James Clear', tVi)).toBe('James Clear');
    expect(itemSourceLabel('  Udemy ', tVi)).toBe('Udemy');
  });

  it('is empty without a source and keeps a broken link as text', () => {
    expect(itemSourceLabel('', tVi)).toBe('');
    expect(itemSourceLabel(undefined, tVi)).toBe('');
    expect(itemSourceLabel(null, tVi)).toBe('');
    expect(itemSourceLabel('https://', tVi)).toBe('https://');
  });
});

describe('itemDateLabel', () => {
  const at = (iso: string) => formatDate(iso, tVi);
  const base = { createdAt: '2026-11-01T08:00:00Z', startedAt: null, finishedAt: null };

  it('names the finish in Xong, the start in Đang làm', () => {
    expect(itemDateLabel({ ...base, status: 'done', finishedAt: '2026-11-07T08:00:00Z' }, tVi)).toBe(
      `xong ${at('2026-11-07T08:00:00Z')}`,
    );
    expect(itemDateLabel({ ...base, status: 'active', startedAt: '2026-11-03T08:00:00Z' }, tVi)).toBe(
      `bắt đầu ${at('2026-11-03T08:00:00Z')}`,
    );
  });

  it('falls back to the day it was added', () => {
    expect(itemDateLabel({ ...base, status: 'done' }, tVi)).toBe(`thêm ${at(base.createdAt)}`);
    expect(itemDateLabel({ ...base, status: 'planned', startedAt: '2026-11-03T08:00:00Z' }, tVi)).toBe(
      `thêm ${at(base.createdAt)}`,
    );
    expect(itemDateLabel({ ...base, status: undefined }, tVi)).toBe(`thêm ${at(base.createdAt)}`);
  });
});

describe('noteTitle', () => {
  const note = (title: string, markdown: string) => ({ id: 7, title, markdown });

  it('prefers the trimmed title', () => {
    expect(noteTitle(note('  Ý tưởng  ', '# Khác'), tVi)).toBe('Ý tưởng');
  });

  it('falls back to the first non-empty markdown line without heading, quote or list marks', () => {
    expect(noteTitle(note('', '\n\n## Kế hoạch tuần\nchi tiết'), tVi)).toBe('Kế hoạch tuần');
    expect(noteTitle(note('  ', '> trích dẫn hay'), tVi)).toBe('trích dẫn hay');
    expect(noteTitle(note('', '- việc một\n- việc hai'), tVi)).toBe('việc một');
    expect(noteTitle(note('', '#hashtag không phải heading'), tVi)).toBe('#hashtag không phải heading');
    expect(noteTitle(note('', '1. bước đầu'), tVi)).toBe('bước đầu');
    expect(noteTitle(note('', '- [ ] việc chưa xong'), tVi)).toBe('việc chưa xong');
  });

  it('shows escaped characters as themselves, as the editor writes them', () => {
    expect(noteTitle(note('', String.raw`\[RD] mở ngoặc vuông, file_name và 2\*3 = 6`), tVi)).toBe(
      '[RD] mở ngoặc vuông, file_name và 2*3 = 6',
    );
    expect(noteTitle(note('', String.raw`Xem [\[RC\] Book C](/thu-vien/item/?id=22) nhé`), tVi)).toBe('Xem [RC] Book C nhé');
    expect(noteTitle(note('', String.raw`\# không phải heading, 1\. không phải danh sách`), tVi)).toBe(
      '# không phải heading, 1. không phải danh sách',
    );
    expect(noteTitle(note('', '> - [ ] việc trong trích dẫn'), tVi)).toBe('việc trong trích dẫn');
    expect(noteTitle(note('', '-5 độ'), tVi)).toBe('-5 độ');
  });

  it('shows a link by its text (a `[[ ]]` link)', () => {
    expect(noteTitle(note('', 'Xem [Atomic Habits](/thu-vien/item/?id=12) và [ý khác](/thu-vien/ghi-chu/?id=3)'), tVi)).toBe(
      'Xem Atomic Habits và ý khác',
    );
  });

  it('skips lines that are only marks and cuts long lines at 120 characters', () => {
    expect(noteTitle(note('', '#   \nnội dung'), tVi)).toBe('nội dung');
    // the editor's empty-line placeholder is not text
    expect(noteTitle(note('', '<br />\n\n- <br />\n\nÝ chính'), tVi)).toBe('Ý chính');
    expect(noteTitle(note('', 'x'.repeat(300)), tVi)).toHaveLength(120);
  });

  it('uses "Ghi chú #id" for an empty note', () => {
    expect(noteTitle(note('', ''), tVi)).toBe('Ghi chú #7');
    expect(noteTitle(note('', '\n  \n'), tVi)).toBe('Ghi chú #7');
  });

  it('shows no backslash for a line break (Shift+Enter, pasted lines)', () => {
    expect(noteTitle(note('', '\\[V3] Dòng một\\\ndòng hai'), tVi)).toBe('[V3] Dòng một');
    expect(noteTitle(note('', 'Dòng một\\\r\ndòng hai'), tVi)).toBe('Dòng một');
    expect(noteTitle(note('', 'C:\\\\\nx'), tVi)).toBe('C:\\');
  });

  it('shows numeric character references as their character', () => {
    expect(noteTitle(note('', String.raw`&#x20;\[V3] khoảng trắng đầu`), tVi)).toBe('[V3] khoảng trắng đầu');
    expect(noteTitle(note('', '# &#x20;Tiêu đề'), tVi)).toBe('Tiêu đề');
    expect(noteTitle(note('', '&#x9;Tab đầu'), tVi)).toBe('Tab đầu');
    expect(noteTitle(note('', '&#123;json&#125; và &#0;'), tVi)).toBe('{json} và \uFFFD');
    expect(noteTitle(note('', String.raw`\&#x20;viết như chữ`), tVi)).toBe('&#x20;viết như chữ');
  });

  it('leaves inline marks out and keeps escaped characters, an escaped "!" before a link too', () => {
    expect(noteTitle(note('', '**Ý chính:** đọc *chương* `3` ~~cũ~~'), tVi)).toBe('Ý chính: đọc chương 3 cũ');
    expect(noteTitle(note('', String.raw`2\*3 = 6, file_name và _nghiêng_`), tVi)).toBe('2*3 = 6, file_name và nghiêng');
    expect(noteTitle(note('', String.raw`Hay quá\![Sách](/thu-vien/item/?id=5)`), tVi)).toBe('Hay quá!Sách');
  });

  it('reads like the backend: ASCII list numbers, one whitespace set, a cut that never splits a character', () => {
    expect(noteTitle(note('', '٣. chữ số'), tVi)).toBe('٣. chữ số');
    expect(noteTitle(note('', '\uFEFFBOM a\u0085b\u001Cc'), tVi)).toBe('BOM a b\u001Cc');
    expect(noteTitle(note('', `${'a'.repeat(119)}😀b`), tVi)).toBe(`${'a'.repeat(119)}😀`);
    expect(Array.from(noteTitle(note('', '😀'.repeat(61)), tVi))).toHaveLength(61);
    expect(noteTitle(note('  \uFEFF Tiêu đề\u3000', 'x'), tVi)).toBe('Tiêu đề');
  });

  it('stays fast on long lines of escaped brackets and reads only up to the first line with text', () => {
    for (const markdown of ['[' + String.raw`\[`.repeat(99_999), String.raw`Ghi chú \[V3\]V `.repeat(2_500)]) {
      const started = performance.now();
      noteTitle(note('', markdown), tVi);
      expect(performance.now() - started).toBeLessThan(500);
    }
    const started = performance.now();
    expect(noteTitle(note('', `# Tiêu đề\n${'[' + String.raw`\[`.repeat(99_999)}`), tVi)).toBe('Tiêu đề');
    expect(performance.now() - started).toBeLessThan(50);
  });
});

const entry = (over: Partial<ApiInboxEntry>): ApiInboxEntry =>
  ({ url: '', ogSiteName: '', suggestedDestination: '', suggestedTags: [], ...over }) as ApiInboxEntry;

describe('itemTypeForEntry', () => {
  it('knows course, film and book hosts, with www. and subdomains', () => {
    expect(itemTypeForEntry(entry({ url: 'https://www.coursera.org/learn/x' }))).toBe('course');
    expect(itemTypeForEntry(entry({ url: 'https://learn.udemy.com/course/y' }))).toBe('course');
    expect(itemTypeForEntry(entry({ url: 'https://www.csfd.cz/film/1' }))).toBe('film');
    expect(itemTypeForEntry(entry({ url: 'https://www.goodreads.com/book/show/1' }))).toBe('book');
  });

  it('does not match a host that only ends with the same letters', () => {
    expect(itemTypeForEntry(entry({ url: 'https://notcoursera.org/x' }))).toBe('article');
    expect(itemTypeForEntry(entry({ url: 'https://imdb.com.evil.io/x' }))).toBe('article');
  });

  it('uses the suggested destination for other hosts: book -> book, the rest -> article', () => {
    expect(itemTypeForEntry(entry({ url: 'https://blog.example.com/p', suggestedDestination: 'book' }))).toBe('book');
    expect(itemTypeForEntry(entry({ url: 'https://blog.example.com/p', suggestedDestination: 'read_later' }))).toBe('article');
    expect(itemTypeForEntry(entry({ url: '', suggestedDestination: 'opportunity' }))).toBe('article');
  });

  it('lets the host win over the suggestion', () => {
    expect(itemTypeForEntry(entry({ url: 'https://www.imdb.com/title/1', suggestedDestination: 'book' }))).toBe('film');
  });
});

describe('itemDraftFromEntry', () => {
  it('prefills a planned Item and respects the API field limits', () => {
    const draft = itemDraftFromEntry(
      entry({ url: 'https://www.coursera.org/learn/x', suggestedTags: ['ai', 't'.repeat(80)] }),
      'T'.repeat(400),
    );
    expect(draft).toMatchObject({ type: 'course', status: 'planned', source: 'https://www.coursera.org/learn/x' });
    expect(draft.title).toHaveLength(300);
    expect(draft.tags).toEqual(['ai', 't'.repeat(50)]);
  });

  it('uses the site name as the source of a text entry', () => {
    expect(itemDraftFromEntry(entry({ ogSiteName: 'Podcast X' }), 'Tập 1').source).toBe('Podcast X');
    expect(itemDraftFromEntry(entry({}), 'Tập 1').source).toBe('');
  });
});
