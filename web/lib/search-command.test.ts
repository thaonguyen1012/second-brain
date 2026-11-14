import { describe, expect, it } from 'vitest';
import { enPage } from './i18n/en';
import { makeT } from './i18n/translate';
import { MIN_QUERY, fold, foldedWords, matchCommand, placeCommand, shortcutsCommandTerms } from './search-command';

// The command's terms as the search dialog builds them, from the real dictionaries
const vi = shortcutsCommandTerms(makeT('vi', null));
const en = shortcutsCommandTerms(makeT('en', enPage));

const expectAll = (terms: typeof vi, queries: string[], want: 'strong' | 'weak' | 'none') => {
  for (const q of queries) expect(matchCommand(q, terms), JSON.stringify(q)).toBe(want);
};

describe('foldedWords', () => {
  it('drops accents and case, turns đ into d and parts words at any other character', () => {
    expect(foldedWords('Phím tắt một-phím')).toEqual(['phim', 'tat', 'mot', 'phim']);
    expect(foldedWords('  Đi   ĐẾN ')).toEqual(['di', 'den']);
    expect(foldedWords('single-key  shortcuts…')).toEqual(['single', 'key', 'shortcuts']);
    expect(foldedWords('')).toEqual([]);
    expect(fold('Ắ')).toBe('a');
    expect(fold('đ')).toBe('d');
  });

  it('reads decomposed text (NFD) as the composed text, a lone accent never parting a word', () => {
    expect('phím tắt'.normalize('NFD')).not.toBe('phím tắt');
    expect(foldedWords('Phím tắt một-phím'.normalize('NFD'))).toEqual(['phim', 'tat', 'mot', 'phim']);
    expect(foldedWords('ĐẾN'.normalize('NFD'))).toEqual(['den']);
    // a lone combining mark, as an IME may send it before its letter
    expect(foldedWords('́phim')).toEqual(['phim']);
    // fold stays one character in, one out (the search excerpt maps indexes through it)
    for (const c of Array.from('phím tắt'.normalize('NFD'))) expect(Array.from(fold(c))).toHaveLength(1);
  });
});

describe('the single-key shortcuts command in Cmd+K', () => {
  it('uses the names the row shows, in each language', () => {
    expect(vi.names).toEqual(['Tắt phím tắt một phím', 'Bật phím tắt một phím', 'Phím tắt']);
    expect(en.names).toEqual(['Turn off single-key shortcuts', 'Turn on single-key shortcuts', 'Keyboard shortcuts']);
    // every phrase is made of the names' own words
    for (const terms of [vi, en]) {
      const own = new Set(terms.names.flatMap(foldedWords));
      for (const phrase of terms.phrases)
        for (const word of foldedWords(phrase)) expect(own.has(word) || own.has(`${word}s`), word).toBe(true);
    }
  });

  it('is named by its whole object or a verb with it in Vietnamese, in full', () => {
    expectAll(vi, ['tắt phím tắt', 'tat phim tat', 'bật phím tắt', 'phím tắt một phím', 'phim tat mot phim'], 'strong');
    expectAll(vi, ['tắt phím tắt một phím', 'Bật phím tắt một phím', 'Tắt phím tắt'], 'strong');
  });

  it('is named by its whole object or a verb with it in English, in full', () => {
    expectAll(en, ['single-key shortcuts', 'single key shortcut', 'turn off shortcuts', 'turn on shortcuts'], 'strong');
    expectAll(en, ['turn off single-key shortcuts', 'Turn on single-key shortcuts', 'single-key shortcut'], 'strong');
  });

  it('is never named by the words of the handbook pages about keyboard shortcuts', () => {
    // 89 handbook pages say "phím tắt", 80 "keyboard shortcut", 21 "một phím" (in "một phím tắt"), 9 "single key":
    // their search keeps its results on top and Enter, the command after them
    expectAll(vi, ['phím tắt', 'phim tat', 'Phím tắt', 'một phím', 'mot phim', 'một phím tắt', 'phím tắt một'], 'weak');
    expectAll(en, ['shortcut', 'shortcuts', 'keyboard shortcuts', 'keyboard shortcut', 'single key', 'single-key'], 'weak');
  });

  it('ignores accents, case and spaces, also a trailing space', () => {
    expectAll(vi, ['TẮT PHÍM TẮT', 'Tat Phim Tat', '  tắt   phím   tắt  ', 'bật phím tắt ', 'TAT-PHIM-TAT'], 'strong');
    expectAll(vi, ['Phím Tắt Một Phím', 'PHIM TAT MOT-PHIM', 'tắt phím tắt\t'], 'strong');
    // typed or pasted decomposed (NFD), as the composed text
    const nfd = (qs: string[]) => qs.map((q) => q.normalize('NFD'));
    expectAll(vi, nfd(['tắt phím tắt', 'phím tắt một phím', 'Tắt phím tắt một phím', 'BẬT PHÍM TẮT ']), 'strong');
    expectAll(vi, nfd(['một', 'tắt', 'bật phím', 'phím', 'phím tắt', 'một phím']), 'weak');
    expectAll(vi, nfd(['phím tắt vscode', 'khách', 'tất cả']), 'none');
    expectAll(en, ['SINGLE-KEY SHORTCUTS ', ' Turn Off Shortcuts', 'single   KEY shortcut', 'Single-key shortcut\n'], 'strong');
    expectAll(vi, ['TA', 'Mo ', 'PHI', 'Một', 'mot', 'BAT', 'bật'], 'weak');
    expectAll(en, ['ON', 'Of ', ' Ke', 'SI', 'Sh ', 'TU'], 'weak');
  });

  it('keeps the strong match while the rest of its name is typed, never before the phrase is whole', () => {
    for (const [terms, name, whole] of [
      [vi, 'tắt phím tắt một phím', 'tắt phím tắt'],
      [vi, 'bật phím tắt một phím', 'bật phím tắt'],
      [en, 'turn off single-key shortcuts', 'turn off single-key shortcut'],
      [en, 'turn on shortcuts', 'turn on shortcuts'],
    ] as const) {
      const chars = Array.from(name);
      for (let n = MIN_QUERY; n <= chars.length; n++) {
        const q = chars.slice(0, n).join('');
        expect(matchCommand(q, terms), q).toBe(n >= Array.from(whole).length ? 'strong' : 'weak');
      }
    }
  });

  it('never names it from the reported queries: their results keep the top and Enter', () => {
    expectAll(vi, ['ba', 'ta', 'mo', 'ph', 'một', 'bat', 'phi'], 'weak');
    expectAll(en, ['on', 'of', 'ke', 'si', 'sh', 'tu'], 'weak');
  });

  it('only starts it from a verb, a lone word or a cut-off phrase', () => {
    expectAll(vi, ['tắt', 'bật', 'phím', 'phim', 'bật phím', 'tat phim', 'phim ta', 'mot ph', 'tắt một'], 'weak');
    expectAll(vi, ['phím tắt', 'một phím', 'tắt phím ta', 'phím tắt một ph'], 'weak');
    expectAll(en, ['turn', 'turn off', 'single', 'single k', 'single ke', 'key', 'keyboard', 'shortcu', 'off'], 'weak');
    expectAll(en, ['shortcuts', 'single key', 'single-key shortcu', 'turn off shortcu'], 'weak');
  });

  it('is left out by other searches', () => {
    expectAll(vi, ['', ' ', 'p', 't ', '--', 'mon', 'tai', 'phím tắt vscode', 'phim tat 2', 'khách', 'tất cả'], 'none');
    expectAll(en, ['', 'o', 'onboarding', 'keys', 'shortcuts in vscode', 'single page', 'postgres'], 'none');
  });

  it('keeps each language to its own words', () => {
    expect(matchCommand('phím tắt', en)).toBe('none');
    expect(matchCommand('shortcut', vi)).toBe('none');
  });
});

describe('where the command goes in the Cmd+K list', () => {
  const place = (terms: typeof vi, q: string, rows: number, destinations = false) =>
    placeCommand(matchCommand(q, terms), { rows, destinations });

  it('leads the list only for a query that names it, also when it is the only row', () => {
    for (const rows of [0, 1, 12]) {
      expect(place(vi, 'tắt phím tắt', rows)).toBe('first');
      expect(place(en, 'single-key shortcuts', rows)).toBe('first');
      expect(place(vi, 'phim tat mot phim', rows, true)).toBe('first');
    }
  });

  it('follows the results of a search for keyboard shortcut pages, never taking Enter from them', () => {
    for (const q of ['phím tắt', 'phim tat', 'một phím']) {
      expect(place(vi, q, 20), q).toBe('last');
      expect(place(vi, q, 0), q).toBeNull();
    }
    for (const q of ['shortcuts', 'keyboard shortcuts', 'single key']) {
      expect(place(en, q, 20), q).toBe('last');
      expect(place(en, q, 0), q).toBeNull();
    }
  });

  it('ends the results of a weak query, and is left out when nothing else is listed', () => {
    // the reported queries: their results (handbook or second brain) keep the top and Enter
    for (const q of ['ba', 'ta', 'mo', 'ph', 'một', 'bat', 'phi', 'tắt', 'bật phím']) {
      expect(place(vi, q, 3), q).toBe('last');
      expect(place(vi, q, 3, true), q).toBe('last');
      // no handbook hit (no search index, or nothing found) and no second-brain hit yet: the command alone would be
      // the active row, Enter's; the list is empty instead, and the command comes back at the end with the first hit
      expect(place(vi, q, 0), q).toBeNull();
    }
    for (const q of ['on', 'of', 'ke', 'si', 'sh', 'tu', 'turn off', 'single k']) {
      expect(place(en, q, 1), q).toBe('last');
      expect(place(en, q, 0), q).toBeNull();
    }
  });

  it('ends the destinations while nothing is typed or the first results are on their way, then leaves', () => {
    expect(place(vi, '', 9, true)).toBe('last');
    expect(place(en, '', 9, true)).toBe('last');
    expect(place(vi, 'mon', 9, true)).toBe('last');
    expect(place(vi, 'mon', 4)).toBeNull();
    expect(place(en, 'postgres', 4)).toBeNull();
    expect(place(vi, 'phím tắt vscode', 0)).toBeNull();
    // never the only row unless named
    expect(place(vi, '', 0, true)).toBeNull();
  });
});
