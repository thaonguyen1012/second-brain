import { describe, expect, it } from 'vitest';
import type { ApiInboxEntry } from '@/lib/api/client';
import { itemDraftFromEntry, itemTypeForEntry, noteTitle } from './library-labels';

describe('noteTitle', () => {
  const note = (title: string, markdown: string) => ({ id: 7, title, markdown });

  it('prefers the trimmed title', () => {
    expect(noteTitle(note('  Ý tưởng  ', '# Khác'))).toBe('Ý tưởng');
  });

  it('falls back to the first non-empty markdown line without heading, quote or list marks', () => {
    expect(noteTitle(note('', '\n\n## Kế hoạch tuần\nchi tiết'))).toBe('Kế hoạch tuần');
    expect(noteTitle(note('  ', '> trích dẫn hay'))).toBe('trích dẫn hay');
    expect(noteTitle(note('', '- việc một\n- việc hai'))).toBe('việc một');
    expect(noteTitle(note('', '#hashtag không phải heading'))).toBe('#hashtag không phải heading');
  });

  it('skips lines that are only marks and cuts long lines at 120 characters', () => {
    expect(noteTitle(note('', '#   \nnội dung'))).toBe('nội dung');
    expect(noteTitle(note('', 'x'.repeat(300)))).toHaveLength(120);
  });

  it('uses "Ghi chú #id" for an empty note', () => {
    expect(noteTitle(note('', ''))).toBe('Ghi chú #7');
    expect(noteTitle(note('', '\n  \n'))).toBe('Ghi chú #7');
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
