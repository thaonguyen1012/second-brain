import { describe, expect, it, vi } from 'vitest';
import { MAX_TEXT, MAX_URL, bookmarkletHref, capturePath, draftFromParams, httpUrl } from './capture';

describe('httpUrl', () => {
  it('accepts http and https, normalised by URL', () => {
    expect(httpUrl('https://example.com')).toBe('https://example.com/');
    expect(httpUrl('  http://Example.COM/a b?x=1  ')).toBe('http://example.com/a%20b?x=1');
    expect(httpUrl('HTTPS://example.com/Path')).toBe('https://example.com/Path');
  });

  it('rejects every other scheme', () => {
    for (const bad of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'chrome://settings',
      'mailto:a@b.cz',
      'ftp://example.com/x',
    ])
      expect(httpUrl(bad), bad).toBeNull();
  });

  it('rejects empty, relative and malformed values', () => {
    for (const bad of ['', '   ', '/inbox/', 'example.com', 'http://', 'https://exa mple.com'])
      expect(httpUrl(bad), JSON.stringify(bad)).toBeNull();
  });

  it('enforces the POST /api/inbox URL limit on the trimmed value', () => {
    const base = 'https://example.com/';
    const atLimit = base + 'a'.repeat(MAX_URL - base.length);
    expect(atLimit).toHaveLength(MAX_URL);
    expect(httpUrl(atLimit)).toBe(atLimit);
    expect(httpUrl(`  ${atLimit}  `)).toBe(atLimit);
    expect(httpUrl(atLimit + 'a')).toBeNull();
  });
});

const params = (q: Record<string, string>) => new URLSearchParams(q);

describe('draftFromParams', () => {
  it('uses url, title and the selected text from the bookmarklet', () => {
    expect(
      draftFromParams(params({ url: ' https://a.cz/x ', title: ' Tiêu đề ', text: 'Đoạn được chọn' })),
    ).toEqual({ url: 'https://a.cz/x', note: 'Tiêu đề\n\nĐoạn được chọn' });
  });

  it('takes the link out of `text` when an Android share sheet leaves `url` empty', () => {
    expect(draftFromParams(params({ title: 'Bài hay', text: 'Đọc cái này https://a.cz/p?q=1 nhé' }))).toEqual({
      url: 'https://a.cz/p?q=1',
      note: 'Bài hay\n\nĐọc cái này nhé',
    });
  });

  it('keeps line breaks of the shared text while removing the link', () => {
    expect(draftFromParams(params({ text: 'Dòng một\nhttps://a.cz/x\nDòng hai' }))).toEqual({
      url: 'https://a.cz/x',
      note: 'Dòng một\n \nDòng hai',
    });
  });

  it('stops the link at whitespace, quotes and angle brackets', () => {
    expect(draftFromParams(params({ text: '<https://a.cz/x>' })).url).toBe('https://a.cz/x');
    expect(draftFromParams(params({ text: '"https://a.cz/y" xem' })).url).toBe('https://a.cz/y');
  });

  it('leaves `text` alone when `url` is given', () => {
    expect(draftFromParams(params({ url: 'https://a.cz/', text: 'xem https://b.cz/' }))).toEqual({
      url: 'https://a.cz/',
      note: 'xem https://b.cz/',
    });
  });

  it('does not repeat the URL or the title in the note', () => {
    expect(draftFromParams(params({ url: 'https://a.cz/', title: 'https://a.cz/', text: 'https://a.cz/' }))).toEqual({
      url: 'https://a.cz/',
      note: '',
    });
    expect(draftFromParams(params({ title: 'Cùng chữ', text: 'Cùng chữ' })).note).toBe('Cùng chữ');
  });

  it('returns an empty draft for no parameters and a text-only draft for plain text', () => {
    expect(draftFromParams(new URLSearchParams())).toEqual({ url: '', note: '' });
    expect(draftFromParams(params({ text: 'chỉ là ghi chú' }))).toEqual({ url: '', note: 'chỉ là ghi chú' });
  });

  it('cuts the note at the POST /api/inbox text limit', () => {
    const note = draftFromParams(params({ title: 't', text: 'x'.repeat(MAX_TEXT + 50) })).note;
    expect(note).toHaveLength(MAX_TEXT);
    expect(note.startsWith('t\n\nx')).toBe(true);
  });
});

describe('bookmarkletHref', () => {
  it('points at the capture page of the given origin', () => {
    expect(capturePath).toBe('/inbox/them/');
    const href = bookmarkletHref('https://brain.example.com');
    expect(href.startsWith('javascript:(function(){')).toBe(true);
    expect(href).toContain("'https://brain.example.com/inbox/them/?url='");
  });

  it('refuses origins that could break out of the generated string', () => {
    for (const bad of [
      "https://a.cz'+alert(1)+'",
      'https://a.cz"',
      'https://a.cz\\',
      'https://a .cz',
      'javascript:alert(1)',
      'ftp://a.cz',
      '',
    ])
      expect(() => bookmarkletHref(bad), bad).toThrow('bad origin');
  });

  // Runs the generated code against a fake page, the way a browser runs a bookmarklet.
  function runBookmarklet(page: { href: string; title: string; selection: string; popupBlocked?: boolean }) {
    const code = decodeURIComponent(bookmarkletHref('http://127.0.0.1:8080').slice('javascript:'.length));
    const location = { href: page.href };
    const open = vi.fn(() => (page.popupBlocked ? null : {}));
    const getSelection = () => page.selection;
    const window = { getSelection, open };
    new Function('window', 'location', 'document', 'getSelection', code)(window, location, { title: page.title }, getSelection);
    return { open, location };
  }

  it('opens a popup with the encoded URL, title and selection', () => {
    const { open, location } = runBookmarklet({
      href: 'https://a.cz/x?y=1&z=2',
      title: 'Tiêu đề & dấu',
      selection: '  đoạn chọn  ',
    });
    expect(open).toHaveBeenCalledOnce();
    const [url, name] = open.mock.calls[0] as unknown as [string, string];
    expect(name).toBe('alex-brain-capture');
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('http://127.0.0.1:8080/inbox/them/');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      url: 'https://a.cz/x?y=1&z=2',
      title: 'Tiêu đề & dấu',
      text: 'đoạn chọn',
    });
    expect(location.href).toBe('https://a.cz/x?y=1&z=2');
  });

  it('omits an empty selection, caps title and selection, and falls back to the same tab', () => {
    const { location } = runBookmarklet({
      href: 'https://a.cz/',
      title: 'T'.repeat(400),
      selection: '   ',
      popupBlocked: true,
    });
    const parsed = new URL(location.href);
    expect(parsed.pathname).toBe('/inbox/them/');
    expect(parsed.searchParams.has('text')).toBe(false);
    expect(parsed.searchParams.get('title')).toHaveLength(300);

    const long = runBookmarklet({ href: 'https://a.cz/', title: '', selection: 's'.repeat(2000) });
    const [url] = long.open.mock.calls[0] as unknown as [string];
    expect(new URL(url).searchParams.get('text')).toHaveLength(1500);
  });
});
