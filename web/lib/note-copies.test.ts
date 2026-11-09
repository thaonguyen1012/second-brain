import { describe, expect, it } from 'vitest';
import {
  COPY_PREFIX,
  LOCK_GRACE_MS,
  newNoteQuery,
  offeredCopies,
  parseCopy,
  parseSlotName,
  readSlots,
  serializeCopy,
  slotName,
  textHash,
  writerLive,
  writtenOverOlder,
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
    const over = copy('Hai', '2026-11-08T10:00:00.000Z', { base: '2026-11-08T11:00:00.123456+01:00', sent: 'abcd0123' });
    expect(parseCopy(serializeCopy(over))).toEqual(over);
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

describe('writtenOverOlder', () => {
  const V0 = '2026-11-08T23:00:00.100000+01:00';
  const V1 = '2026-11-08T23:00:05.200000+01:00';
  const note = (markdown: string, updatedAt: string) => ({ title: 'T', markdown, updatedAt });

  it('is not said of a copy written over the version shown, or without a version', () => {
    expect(writtenOverOlder(copy('Gõ thêm', 'x', { base: V0 }), note('Gốc', V0))).toBe(false);
    // a new note's copy, a copy from before copies said so
    expect(writtenOverOlder(copy('Gõ thêm', 'x'), note('Gốc', V1))).toBe(false);
    expect(writtenOverOlder(copy('Gõ thêm', 'x', { base: V0 }), null)).toBe(false);
  });

  it('is said of a copy when the note was saved since (its own save may have arrived unanswered)', () => {
    // the laptop's save arrived as its tab closed, then a phone added a sentence
    const laptop = copy('Gốc. LAPTOP.', 'x', { base: V0 });
    expect(writtenOverOlder(laptop, note('Gốc. LAPTOP. PHONE.', V1))).toBe(true);
    // the same date written another way (summer time) is the same version
    expect(writtenOverOlder(copy('A', 'x', { base: '2026-11-08T22:00:00.100000Z' }), note('B', V0))).toBe(false);
    // a page showing an older version than the copy's says nothing about it
    expect(writtenOverOlder(copy('A', 'x', { base: V1 }), note('B', V0))).toBe(false);
  });

  it('is not said when the save on its way as the copy was written is all that arrived since', () => {
    const typedOn = copy('Gốc. Một. Hai.', 'x', { base: V0, sent: textHash({ title: 'T ', markdown: 'Gốc. Một.' }) });
    expect(writtenOverOlder(typedOn, note('Gốc. Một.', V1))).toBe(false);
    // something else arrived after that save
    expect(writtenOverOlder(typedOn, note('Gốc. Một. PHONE.', V1))).toBe(true);
  });

  it('fingerprints a text as the server keeps it', () => {
    expect(textHash({ title: ' T ', markdown: 'a' })).toBe(textHash({ title: 'T', markdown: 'a' }));
    expect(textHash({ title: 'T', markdown: 'a' })).not.toBe(textHash({ title: 'T', markdown: 'b' }));
    expect(textHash({ title: '', markdown: '' })).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('writerLive', () => {
  const here = 'tab-here';
  const other = (owner: string, at: string) => slot(owner, copy('Đang gõ', at, { tab: 'tab-other' }));
  const asked = Date.parse('2026-11-08T10:00:10Z');

  it('knows this page’s own editors', () => {
    const mine = slot('a', copy('x', '2026-11-08T10:00:00Z', { tab: here }));
    expect(writerLive(mine, { tab: here, live: new Set(['a']), held: new Set(), askedAt: asked })).toBe(true);
    expect(writerLive(mine, { tab: here, live: new Set(), held: new Set(['a']), askedAt: asked })).toBe(false);
  });

  it('takes another page’s editor as open while its lock is held, or until the browser was asked about it', () => {
    const gone = other('b', '2026-11-08T10:00:00Z');
    const p = { tab: here, live: new Set<string>(), askedAt: asked };
    expect(writerLive(gone, { ...p, held: new Set(['b']) })).toBe(true);
    expect(writerLive(gone, { ...p, held: new Set() })).toBe(false);
    // not asked yet: held back, not offered
    expect(writerLive(gone, { ...p, held: null })).toBe(true);
    // written shortly before the question (its editor may not have had its lock yet) or after it
    const recent = other('c', new Date(asked - LOCK_GRACE_MS + 500).toISOString());
    expect(writerLive(recent, { ...p, held: new Set() })).toBe(true);
    // without Web Locks another page's copy is offered, as before
    expect(writerLive(gone, { ...p, held: undefined })).toBe(false);
  });

  it('takes a copy from before copies had writers as gone', () => {
    const legacy: Slot = { name: `${COPY_PREFIX}note-5`, key: 'note-5', owner: '', copy: copy('x', 'y', { tab: '' }) };
    expect(writerLive(legacy, { tab: here, live: new Set(['']), held: null, askedAt: asked })).toBe(false);
  });
});

describe('newNoteQuery', () => {
  it('opens a new note’s copy where it was written', () => {
    expect(newNoteQuery('new')).toBe('id=new');
    expect(newNoteQuery('new-item-12')).toBe('id=new&item=12');
    expect(newNoteQuery('note-3')).toBeNull();
  });
});
