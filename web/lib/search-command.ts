// How a Cmd+K query names a command (components/search-dialog.tsx). The list holds one command, single-key shortcuts
// off or on (lib/single-key-shortcuts.ts), and a pick changes that setting in place: so the command may become the
// row Enter picks only when the query clearly names it. A query that merely starts its words ("ta", "mo", "on", "si")
// is a search like any other; the results it asked for keep the top of the list and Enter.
import type { Locale } from './i18n/config';
import type { T } from './i18n/translate';

/** Shorter queries match too much of everything: they name no command and search no second brain. */
export const MIN_QUERY = 2;

/** One character without its accents, in lower case ("Ắ" -> "a", "đ" -> "d"), so "khach" finds "khách". */
export const fold = (c: string) =>
  c.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase().charAt(0) || c;

/**
 * The words of a text, accents and case aside; any other character parts them ("Phím tắt một-phím" -> phim, tat, mot,
 * phim). Decomposed text too (NFD: a combining-mode IME, a name pasted from macOS): `fold` keeps a lone accent as it is,
 * one character in and one out for the search excerpt's index mapping, so the accents left are dropped here before
 * they could part a word ("phi" + U+0301 + "m" is "phim").
 */
export const foldedWords = (text: string): string[] =>
  Array.from(text)
    .map(fold)
    .join('')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * How clearly a query names a command: `strong` puts its row first, where Enter picks it; `weak` keeps it at the end
 * of the list, after the results (never the row Enter picks, never moving the results); `none` leaves it out once
 * results are there. `placeCommand` turns this into the row's place.
 */
export type CommandMatch = 'strong' | 'weak' | 'none';

export interface CommandTerms {
  /** Everything the command's row can say, in the UI language (both of its states): the words a query may use. */
  names: readonly string[];
  /**
   * Runs of whole words that name the command on their own, in the UI language, for what its row does now ("phím tắt
   * một phím", "tắt phím tắt" while the row turns the shortcuts off).
   */
  phrases: readonly string[];
  /**
   * Runs of whole words that ask for what the row does not do now, the state the setting is already in ("bật" while
   * the row turns the shortcuts off): a query holding one never names the command.
   */
  against?: readonly string[];
}

/**
 * - `strong`: the query holds one of `phrases` as whole words in a row, none of `against`, and each of its other words
 *   is one of the command's words, the last one also the start of one (it may still be being typed): "tat phim tat",
 *   "Tắt phím tắt ", "tắt phím tắt m", "single-key shortcuts", "turn off single-key shortcuts".
 * - `weak`: MIN_QUERY characters or more, and each typed word starts one of the command's words: "ta", "một", "bật
 *   phím", "phím tắt", "on", "turn off", "shortcuts", "keyboard shortcuts", and a phrase with a run of `against`
 *   ("bật phím tắt" while the row turns the shortcuts off).
 * - `none`: anything else ("mon", "phím tắt vscode").
 * Accents, case, hyphens and spaces do not count.
 */
export function matchCommand(query: string, { names, phrases, against = [] }: CommandTerms): CommandMatch {
  if (query.trim().length < MIN_QUERY) return 'none';
  const typed = foldedWords(query);
  const runs = phrases.map(foldedWords).filter((run) => run.length > 0);
  const own = new Set([...names.flatMap(foldedWords), ...runs.flat()]);
  const starts = (word: string) => [...own].some((o) => o.startsWith(word));
  if (typed.length === 0 || !typed.every(starts)) return 'none';
  const whole = typed.every((word, i) => own.has(word) || i === typed.length - 1);
  const holds = (run: string[]) =>
    run.length > 0 && typed.some((_, at) => run.every((word, k) => typed[at + k] === word));
  const named = runs.some(holds) && !against.map(foldedWords).some(holds);
  return whole && named ? 'strong' : 'weak';
}

/** Where the command's row is in the Cmd+K list: first, last, or left out. */
export type CommandPlace = 'first' | 'last' | null;

/**
 * Where the command's row goes in the Cmd+K list, given how the query names it and the other rows: `rows` counts them
 * (second-brain hits, then the handbook results or the destinations), `destinations` says the list still shows the
 * destinations (nothing typed yet, or this query's first results on their way).
 * - `first` (where Enter picks it) only for a query that names it, even alone.
 * - `last`, after the other rows, for a query that only starts its words, and at the end of the destinations.
 * - `null`, left out, for any other query once its results are there, and whenever the command would be the list's only
 *   row without being named: the list's first row is the one Enter picks (Fumadocs makes it the active row), so a
 *   weak match alone would be Enter's again. The list is then empty and says "Không tìm thấy kết quả" (or "Đang tìm…").
 */
export function placeCommand(
  match: CommandMatch,
  { rows, destinations }: { rows: number; destinations: boolean },
): CommandPlace {
  if (match === 'strong') return 'first';
  if (rows === 0) return null;
  return match === 'weak' || destinations ? 'last' : null;
}

/** The words of one action of the command: its verb with "phím tắt" / "shortcuts", and what asks for that action. */
interface ShortcutsVerb {
  phrase: string;
  asks: string;
}

/**
 * What names the single-key shortcuts command on its own, per UI language: its whole object ("phím tắt một phím",
 * "single-key shortcuts"), in either state, or the verb of what its row does now with "phím tắt" / "shortcuts" ("tắt
 * phím tắt", "turn off shortcuts" while they are on; "bật phím tắt", "turn on shortcuts" while off). The other verb
 * asks for the state the switch is already in, so a query holding it (`asks`: "bật" or "on" while they are on, "tắt
 * phím tắt" or "off" while off; "tắt" alone is also the second word of "phím tắt") keeps the command after the
 * results: Enter never does the opposite of the words typed (nor after a pick made under the verb of what the row
 * did: the dialog stays open on the new state with no row highlighted, and a held Enter picks once;
 * components/search-dialog.tsx). Never a verb alone ("tắt", "bật", "turn", "on" start too many searches), a lone
 * "phím", "key" or "single", nor "phím tắt", "một phím", "shortcuts", "keyboard shortcuts" or "single key": those are
 * the words of the handbook pages about keyboard shortcuts (89 pages say "phím tắt", 80 "keyboard shortcut", 21 "một
 * phím", in "một phím tắt"; 9 say "single key", of encryption), whose search keeps its results on top and Enter, the
 * command after them.
 */
const SHORTCUTS_WORDS: Record<Locale, { object: readonly string[]; off: ShortcutsVerb; on: ShortcutsVerb }> = {
  vi: {
    object: ['phím tắt một phím'], // i18n-ignore: words a query is matched against
    off: { phrase: 'tắt phím tắt', asks: 'tắt phím tắt' }, // i18n-ignore: words a query is matched against
    on: { phrase: 'bật phím tắt', asks: 'bật' }, // i18n-ignore: words a query is matched against
  },
  en: {
    object: ['single key shortcut', 'single key shortcuts'],
    off: { phrase: 'turn off shortcuts', asks: 'off' },
    on: { phrase: 'turn on shortcuts', asks: 'on' },
  },
};

/**
 * The single-key shortcuts command's terms in `t`'s language while the shortcuts are `on` (its row turns them off) or
 * off (it turns them on): its two names, the key legends' title, its phrases for that state and the other verb.
 */
export function shortcutsCommandTerms(t: T, on: boolean): CommandTerms {
  const words = SHORTCUTS_WORDS[t.locale];
  const [does, other] = on ? [words.off, words.on] : [words.on, words.off];
  return {
    names: [t('Tắt phím tắt một phím'), t('Bật phím tắt một phím'), t('Phím tắt')],
    phrases: [...words.object, does.phrase],
    against: [other.asks],
  };
}
