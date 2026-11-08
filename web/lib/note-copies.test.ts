import { describe, expect, it } from 'vitest';
import {
  COPY_PREFIX,
  newNoteQuery,
  offeredCopies,
  parseCopy,
  parseSlotName,
  readSlots,
  serializeCopy,
  slotName,
  type NoteCopy,
  type Slot,
} from './note-copies';

function storageOf(entries: Record<string, string>) {
  const names = Object.keys(entries);
  return {
    length: names.length,
    key: (i: number) => names[i] ?? null,
    getItem: (n: string) => entries[n] ?? null,
  };
}

const copy = (markdown: string, at: string, extra: Partial<NoteCopy> = {}): NoteCopy => ({
  title: '',
  markdown,
  at,
  tab: 't1',
  ...extra,
});
const slot = (owner: string, c: NoteCopy, key = 'note-5'): Slot => ({
  name: slotName(key, owner),
  key,
  owner,
  copy: c,
});

describe('slot names', () => {
  it('reads the key and the writer, and copies from before writers', () => {
    expect(parseSlotName(slotName('note-12', 'a-b'))).toEqual({
      key: 'note-12',
      owner: 'a-b',
    });
    expect(parseSlotName(`${COPY_PREFIX}new-item-4`)).toEqual({
      key: 'new-item-4',
      owner: '',
    });
    expect(parseSlotName(`${COPY_PREFIX}new:x`)).toEqual({
      key: 'new',
      owner: 'x',
    });
    expect(parseSlotName(`${COPY_PREFIX}other:x`)).toBeNull();
    expect(parseSlotName('alex-brain:progress')).toBeNull();
  });

  it('round-trips a copy and refuses broken ones', () => {
    const c = copy('Một', '2026-11-08T10:00:00.000Z', { clientId: 'c1' });
    expect(parseCopy(serializeCopy(c))).toEqual(c);
    // a copy from before copies had writers has no tab
    expect(
      parseCopy(
        JSON.stringify({
          title: 'T',
          markdown: 'x',
          at: '2026-01-01T00:00:00Z',
        }),
      )?.tab,
    ).toBe('');
    expect(parseCopy('{')).toBeNull();
    expect(parseCopy(JSON.stringify({ title: 1, markdown: 'x', at: 'y' }))).toBeNull();
  });

  it('lists the copies of one key', () => {
    const store = storageOf({
      [slotName('note-5', 'a')]: serializeCopy(copy('A', '2026-11-08T10:00:00Z')),
      [slotName('note-6', 'b')]: serializeCopy(copy('B', '2026-11-08T10:00:00Z')),
      [slotName('note-5', 'c')]: '{broken',
      'alex-brain:theme': 'dark',
    });
    expect(readSlots(store, (k) => k === 'note-5').map((s) => s.owner)).toEqual(['a']);
  });
});

describe('offeredCopies', () => {
  const none = () => false;

  it('offers copies of gone writers, newest first, one per text', () => {
    const out = offeredCopies(
      [
        slot('old', copy('Cũ', '2026-11-08T09:00:00Z')),
        slot('new', copy('Mới', '2026-11-08T10:00:00Z')),
        slot('twin', copy('Mới', '2026-11-08T08:00:00Z')),
      ],
      { live: none },
    );
    expect(out.map((s) => s.owner)).toEqual(['new', 'old']);
  });

  it('never offers a live editor’s copy, a blank one, or one the server or the editor already has', () => {
    const out = offeredCopies(
      [
        slot('live', copy('Đang gõ', '2026-11-08T10:00:00Z')),
        slot('blank', copy('  <br />\n', '2026-11-08T10:00:00Z')),
        slot('saved', copy('Trên máy chủ', '2026-11-08T10:00:00Z')),
        slot('handed', copy('Mở ra', '2026-11-08T10:00:00Z')),
        slot('gone', copy('Bản nháp', '2026-11-08T10:00:00Z')),
      ],
      {
        live: (s) => s.owner === 'live',
        server: { title: '', markdown: 'Trên máy chủ' },
        opening: { title: '', markdown: 'Mở ra' },
      },
    );
    expect(out.map((s) => s.owner)).toEqual(['gone']);
  });

  it('holds back a copy until it is ready', () => {
    const asked = slot('a', copy('Mới', '2026-11-08T10:00:00Z', { clientId: 'c1' }), 'new');
    expect(offeredCopies([asked], { live: none, ready: () => false })).toEqual([]);
    expect(offeredCopies([asked], { live: none, ready: () => true })).toEqual([asked]);
  });
});

describe('newNoteQuery', () => {
  it('opens a new note’s copy where it was written', () => {
    expect(newNoteQuery('new')).toBe('id=new');
    expect(newNoteQuery('new-item-12')).toBe('id=new&item=12');
    expect(newNoteQuery('note-3')).toBeNull();
  });
});
