import { describe, expect, it } from 'vitest';
import { enPage } from './i18n/en';
import { makeT } from './i18n/translate';
import { MIN_QUERY, fold, foldedWords, matchCommand, shortcutsCommandTerms } from './search-command';

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

  it('is named by its distinctive words in Vietnamese, in full', () => {
    expectAll(vi, ['phím tắt', 'phim tat', 'một phím', 'mot phim', 'Phím tắt'], 'strong');
    expectAll(vi, ['tắt phím tắt một phím', 'Bật phím tắt một phím', 'bật phím tắt', 'phím tắt một phím'], 'strong');
  });

  it('is named by its distinctive words in English, in full', () => {
    expectAll(en, ['shortcut', 'shortcuts', 'single-key', 'single key', 'keyboard shortcuts'], 'strong');
    expectAll(en, ['turn off single-key shortcuts', 'Turn on single-key shortcuts', 'single-key shortcut'], 'strong');
  });

  it('ignores accents, case and spaces, also a trailing space', () => {
    expectAll(vi, ['PHÍM TẮT', 'Phim Tat', '  phím   tắt  ', 'phím tắt ', 'Một Phím', 'MOT-PHIM', 'phím tắt\t'], 'strong');
    expectAll(en, ['SHORTCUTS ', ' Single-Key', 'single   KEY', 'Shortcut\n'], 'strong');
    expectAll(vi, ['TA', 'Mo ', 'PHI', 'Một', 'mot', 'BAT', 'bật'], 'weak');
    expectAll(en, ['ON', 'Of ', ' Ke', 'SI', 'Sh ', 'TU'], 'weak');
  });

  it('keeps the strong match while the rest of its name is typed, never before the phrase is whole', () => {
    for (const [terms, name, whole] of [
      [vi, 'tắt phím tắt một phím', 'tắt phím tắt'],
      [en, 'turn off single-key shortcuts', 'turn off single-key'],
      [en, 'shortcuts', 'shortcut'],
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
    expectAll(en, ['turn', 'turn off', 'single', 'single k', 'single ke', 'key', 'keyboard', 'shortcu', 'off'], 'weak');
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
