import { describe, expect, it } from 'vitest';
import { enPage } from './i18n/en';
import { makeT } from './i18n/translate';
import {
  type CommandTerms,
  MIN_QUERY,
  fold,
  foldedWords,
  matchCommand,
  placeCommand,
  shortcutsCommandTerms,
} from './search-command';

// The command's terms as the search dialog builds them, from the real dictionaries, in each state of the switch:
// while single-key shortcuts are on its row turns them off ("Tắt phím tắt một phím"), while off it turns them on
const tVi = makeT('vi', null);
const tEn = makeT('en', enPage);
const viOn = shortcutsCommandTerms(tVi, true);
const viOff = shortcutsCommandTerms(tVi, false);
const enOn = shortcutsCommandTerms(tEn, true);
const enOff = shortcutsCommandTerms(tEn, false);
const vi = [viOn, viOff];
const en = [enOn, enOff];

const expectAll = (terms: CommandTerms | CommandTerms[], queries: string[], want: 'strong' | 'weak' | 'none') => {
  for (const one of Array.isArray(terms) ? terms : [terms])
    for (const q of queries) expect(matchCommand(q, one), JSON.stringify(q)).toBe(want);
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
  it('uses the names the row shows, in each language and state', () => {
    for (const terms of vi) expect(terms.names).toEqual(['Tắt phím tắt một phím', 'Bật phím tắt một phím', 'Phím tắt']);
    const enNames = ['Turn off single-key shortcuts', 'Turn on single-key shortcuts', 'Keyboard shortcuts'];
    for (const terms of en) expect(terms.names).toEqual(enNames);
    // every phrase, and every word that asks for the other state, is made of the names' own words
    for (const terms of [...vi, ...en]) {
      const own = new Set(terms.names.flatMap(foldedWords));
      for (const phrase of [...terms.phrases, ...(terms.against ?? [])])
        for (const word of foldedWords(phrase)) expect(own.has(word) || own.has(`${word}s`), word).toBe(true);
    }
  });

  it('is named by its whole object in either state', () => {
    expectAll(vi, ['phím tắt một phím', 'phim tat mot phim', 'Phím Tắt Một Phím', 'phím tắt một phím '], 'strong');
    expectAll(en, ['single-key shortcuts', 'single key shortcut', 'SINGLE KEY SHORTCUTS'], 'strong');
  });

  it('is named by the verb of what its row does now, alone or with the rest of its name', () => {
    // on: the row turns them off
    expectAll(viOn, ['tắt phím tắt', 'tat phim tat', 'Tắt phím tắt', 'tắt phím tắt một phím'], 'strong');
    expectAll(enOn, ['turn off shortcuts', 'Turn off single-key shortcuts', 'single-key shortcuts off'], 'strong');
    // off: the row turns them on
    expectAll(viOff, ['bật phím tắt', 'bat phim tat', 'Bật phím tắt', 'bật phím tắt một phím'], 'strong');
    expectAll(enOff, ['turn on shortcuts', 'Turn on single-key shortcuts', 'single-key shortcuts on'], 'strong');
  });

  it('is never named by the other verb, which asks for the state the switch is already in', () => {
    // on: "bật" (turn on) asks for what is so; Enter turned them off
    expectAll(viOn, ['bật phím tắt', 'bat phim tat', 'BẬT PHÍM TẮT', 'bật phím tắt một phím'], 'weak');
    expectAll(viOn, ['Bật phím tắt một phím', 'phím tắt một phím bật'], 'weak');
    expectAll(enOn, ['turn on shortcuts', 'Turn on single-key shortcuts', 'single-key shortcuts on'], 'weak');
    // off: "tắt phím tắt" (turn off; "tắt" alone is also the second word of "phím tắt"); Enter turned them on
    expectAll(viOff, ['tắt phím tắt', 'tat phim tat', 'TẮT PHÍM TẮT', 'tắt phím tắt một phím'], 'weak');
    expectAll(viOff, ['Tắt phím tắt một phím'], 'weak');
    expectAll(enOff, ['turn off shortcuts', 'Turn off single-key shortcuts', 'single-key shortcuts off'], 'weak');
    // decomposed (NFD) as composed
    expectAll(viOn, ['bật phím tắt'.normalize('NFD'), 'Bật phím tắt một phím'.normalize('NFD')], 'weak');
    expectAll(viOff, ['tắt phím tắt'.normalize('NFD'), 'TẮT PHÍM TẮT MỘT PHÍM'.normalize('NFD')], 'weak');
  });

  it('is never named by the words of the handbook pages about keyboard shortcuts', () => {
    // 89 handbook pages say "phím tắt", 80 "keyboard shortcut", 21 "một phím" (in "một phím tắt"), 9 "single key":
    // their search keeps its results on top and Enter, the command after them
    expectAll(vi, ['phím tắt', 'phim tat', 'Phím tắt', 'một phím', 'mot phim', 'một phím tắt', 'phím tắt một'], 'weak');
    expectAll(en, ['shortcut', 'shortcuts', 'keyboard shortcuts', 'keyboard shortcut', 'single key', 'single-key'], 'weak');
  });

  it('ignores accents, case and spaces, also a trailing space', () => {
    expectAll(viOn, ['TẮT PHÍM TẮT', 'Tat Phim Tat', '  tắt   phím   tắt  ', 'TAT-PHIM-TAT'], 'strong');
    expectAll(viOn, ['tắt phím tắt\t'], 'strong');
    expectAll(viOff, ['BẬT PHÍM TẮT', 'Bat Phim Tat', 'bật phím tắt ', 'BAT-PHIM-TAT'], 'strong');
    expectAll(vi, ['Phím Tắt Một Phím', 'PHIM TAT MOT-PHIM'], 'strong');
    // typed or pasted decomposed (NFD), as the composed text
    const nfd = (qs: string[]) => qs.map((q) => q.normalize('NFD'));
    expectAll(viOn, nfd(['tắt phím tắt', 'Tắt phím tắt một phím']), 'strong');
    expectAll(viOff, nfd(['BẬT PHÍM TẮT ', 'bật phím tắt một phím']), 'strong');
    expectAll(vi, nfd(['phím tắt một phím']), 'strong');
    expectAll(vi, nfd(['một', 'tắt', 'bật phím', 'phím', 'phím tắt', 'một phím']), 'weak');
    expectAll(vi, nfd(['phím tắt vscode', 'khách', 'tất cả']), 'none');
    expectAll(enOn, ['SINGLE-KEY SHORTCUTS ', ' Turn Off Shortcuts', 'single   KEY shortcut'], 'strong');
    expectAll(enOn, ['Single-key shortcut\n'], 'strong');
    expectAll(enOff, ['SINGLE-KEY SHORTCUTS ', ' Turn On Shortcuts', 'turn on SHORTCUTS\t'], 'strong');
    expectAll(vi, ['TA', 'Mo ', 'PHI', 'Một', 'mot', 'BAT', 'bật'], 'weak');
    expectAll(en, ['ON', 'Of ', ' Ke', 'SI', 'Sh ', 'TU'], 'weak');
  });

  it('keeps the strong match while the rest of its name is typed, never before the phrase is whole', () => {
    for (const [terms, name, whole] of [
      [viOn, 'tắt phím tắt một phím', 'tắt phím tắt'],
      [viOff, 'bật phím tắt một phím', 'bật phím tắt'],
      [enOn, 'turn off single-key shortcuts', 'turn off single-key shortcut'],
      [enOff, 'turn on single-key shortcuts', 'turn on single-key shortcut'],
      [enOff, 'turn on shortcuts', 'turn on shortcuts'],
    ] as const) {
      const chars = Array.from(name);
      for (let n = MIN_QUERY; n <= chars.length; n++) {
        const q = chars.slice(0, n).join('');
        expect(matchCommand(q, terms), q).toBe(n >= Array.from(whole).length ? 'strong' : 'weak');
      }
    }
  });

  it('never names it while the other verb is typed, letter by letter', () => {
    for (const [terms, name] of [
      [viOn, 'bật phím tắt một phím'],
      [viOff, 'tắt phím tắt một phím'],
      [enOn, 'turn on single-key shortcuts'],
      [enOff, 'turn off single-key shortcuts'],
    ] as const) {
      const chars = Array.from(name);
      for (let n = MIN_QUERY; n <= chars.length; n++) {
        const q = chars.slice(0, n).join('');
        expect(matchCommand(q, terms), q).toBe('weak');
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
    for (const terms of en) expect(matchCommand('phím tắt', terms)).toBe('none');
    for (const terms of vi) expect(matchCommand('shortcut', terms)).toBe('none');
  });
});

describe('where the command goes in the Cmd+K list', () => {
  const place = (terms: CommandTerms, q: string, rows: number, destinations = false) =>
    placeCommand(matchCommand(q, terms), { rows, destinations });

  it('leads the list only for a query that names what its row does now, also when it is the only row', () => {
    for (const rows of [0, 1, 12]) {
      expect(place(viOn, 'tắt phím tắt', rows)).toBe('first');
      expect(place(viOff, 'bật phím tắt', rows)).toBe('first');
      expect(place(enOn, 'turn off shortcuts', rows)).toBe('first');
      expect(place(enOff, 'turn on single-key shortcuts', rows)).toBe('first');
      for (const terms of en) expect(place(terms, 'single-key shortcuts', rows)).toBe('first');
      for (const terms of vi) expect(place(terms, 'phim tat mot phim', rows, true)).toBe('first');
    }
  });

  it('follows the results of a query for the state the switch is already in, never taking Enter from them', () => {
    // Enter opens the first result instead of doing the opposite of the words typed; alone, the command is left out
    for (const [terms, q] of [
      [viOn, 'bật phím tắt'],
      [viOn, 'Bật phím tắt một phím'],
      [viOff, 'tắt phím tắt'],
      [viOff, 'Tắt phím tắt một phím'],
      [enOn, 'turn on shortcuts'],
      [enOff, 'turn off single-key shortcuts'],
    ] as const) {
      expect(place(terms, q, 20), q).toBe('last');
      expect(place(terms, q, 3, true), q).toBe('last');
      expect(place(terms, q, 0), q).toBeNull();
    }
  });

  it('follows the results of a search for keyboard shortcut pages, never taking Enter from them', () => {
    for (const q of ['phím tắt', 'phim tat', 'một phím'])
      for (const terms of vi) {
        expect(place(terms, q, 20), q).toBe('last');
        expect(place(terms, q, 0), q).toBeNull();
      }
    for (const q of ['shortcuts', 'keyboard shortcuts', 'single key'])
      for (const terms of en) {
        expect(place(terms, q, 20), q).toBe('last');
        expect(place(terms, q, 0), q).toBeNull();
      }
  });

  it('ends the results of a weak query, and is left out when nothing else is listed', () => {
    // the reported queries: their results (handbook or second brain) keep the top and Enter
    for (const q of ['ba', 'ta', 'mo', 'ph', 'một', 'bat', 'phi', 'tắt', 'bật phím'])
      for (const terms of vi) {
        expect(place(terms, q, 3), q).toBe('last');
        expect(place(terms, q, 3, true), q).toBe('last');
        // no handbook hit (no search index, or nothing found) and no second-brain hit yet: the command alone would be
        // the active row, Enter's; the list is empty instead, and the command comes back at the end with the first hit
        expect(place(terms, q, 0), q).toBeNull();
      }
    for (const q of ['on', 'of', 'ke', 'si', 'sh', 'tu', 'turn off', 'single k'])
      for (const terms of en) {
        expect(place(terms, q, 1), q).toBe('last');
        expect(place(terms, q, 0), q).toBeNull();
      }
  });

  it('ends the destinations while nothing is typed or the first results are on their way, then leaves', () => {
    for (const terms of [...vi, ...en]) {
      expect(place(terms, '', 9, true)).toBe('last');
      // never the only row unless named
      expect(place(terms, '', 0, true)).toBeNull();
    }
    for (const terms of vi) {
      expect(place(terms, 'mon', 9, true)).toBe('last');
      expect(place(terms, 'mon', 4)).toBeNull();
      expect(place(terms, 'phím tắt vscode', 0)).toBeNull();
    }
    for (const terms of en) expect(place(terms, 'postgres', 4)).toBeNull();
  });
});
