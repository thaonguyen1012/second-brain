import { describe, expect, it } from 'vitest';
import { changedFromTemplate, groupNotesByItem, markdownHref, noteDateLabel, noteHeading } from './item-notes';
import { formatDate } from './labels';

const note = (id: number, items: number[], createdAt = '2026-11-07T10:00:00Z', updatedAt = createdAt) => ({
  id,
  title: '',
  items,
  createdAt,
  updatedAt,
});

describe('groupNotesByItem', () => {
  it('puts a note under every Item it links and keeps the newest-first order inside a group', () => {
    const notes = [note(5, [2]), note(4, [1, 2]), note(3, []), note(2, [1]), note(1, [])];
    const groups = groupNotesByItem(notes);
    expect(groups.map((g) => g.item)).toEqual([2, 1, null]);
    expect(groups[0].notes.map((n) => n.id)).toEqual([5, 4]);
    expect(groups[1].notes.map((n) => n.id)).toEqual([4, 2]);
  });

  it('keeps "Ghi chú rời" last even when its note is the newest, and drops repeated links', () => {
    const groups = groupNotesByItem([note(9, []), note(8, [3, 3])]);
    expect(groups.map((g) => [g.item, g.notes.map((n) => n.id)])).toEqual([
      [3, [8]],
      [null, [9]],
    ]);
  });

  it('answers no group for no notes', () => {
    expect(groupNotesByItem([])).toEqual([]);
  });
});

describe('noteDateLabel', () => {
  it('says the day written, or "sửa" with the day of a later change', () => {
    const written = '2026-11-03T08:00:00Z';
    expect(noteDateLabel({ createdAt: written, updatedAt: '2026-11-03T20:00:00Z' })).toBe(formatDate(written));
    expect(noteDateLabel({ createdAt: written, updatedAt: '2026-11-07T08:00:00Z' })).toBe(
      `sửa ${formatDate('2026-11-07T08:00:00Z')}`,
    );
  });
});

describe('noteHeading', () => {
  it('drops a title that only repeats the Item title, keeps any other', () => {
    expect(noteHeading('Atomic Habits', 'Atomic Habits')).toBeNull();
    expect(noteHeading('  atomic habits ', 'Atomic Habits')).toBeNull();
    expect(noteHeading('Đọc lại chương 3', 'Atomic Habits')).toBe('Đọc lại chương 3');
    expect(noteHeading('   ', 'Atomic Habits')).toBeNull();
  });
});

describe('markdownHref', () => {
  it('keeps same-origin paths in the app and opens http(s) and mailto outside', () => {
    expect(markdownHref('/thu-vien/item/?id=12')).toEqual({ kind: 'internal', href: '/thu-vien/item/?id=12' });
    expect(markdownHref('https://jamesclear.com/atomic-habits')).toEqual({
      kind: 'external',
      href: 'https://jamesclear.com/atomic-habits',
    });
    expect(markdownHref('mailto:alex@example.com').kind).toBe('external');
  });

  it('shows every other target as text', () => {
    for (const href of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', '/\\evil.example', 'chuong-3', '', undefined])
      expect(markdownHref(href)).toEqual({ kind: 'text' });
  });
});

describe('changedFromTemplate', () => {
  const book = '## Highlights\n\n- \n\n## 3 ý chính\n\n1. \n2. \n3. \n';
  it('treats an untouched template (spacing aside) as unchanged', () => {
    expect(changedFromTemplate(book, book)).toBe(false);
    expect(changedFromTemplate(`${book}\n\n`, book)).toBe(false);
    expect(changedFromTemplate(book.replace('- ', '- Thói quen nhỏ'), book)).toBe(true);
    expect(changedFromTemplate('Nhận xét: hay', 'Nhận xét: ')).toBe(true);
  });
});
