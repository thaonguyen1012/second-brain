// The page of each kind of record a note can link to (DECISIONS 9.8): the Item page, the note page, an opportunity, a
// skill, each named by `?id=`. The Item page and the note page link with them, and the editor's `[[ ]]` picker writes
// them into a note as readable markdown, `[Atomic Habits](/thu-vien/item/?id=12)`; the backend reads the same paths
// out of a note on every save (backend/library/links.py, PATHS: note-links.test.ts keeps the two lists equal).

export type LinkKind = 'item' | 'note' | 'opportunity' | 'skill';

/** The page of each kind of record; `?id=` names the record. */
export const KIND_PATHS: Record<LinkKind, string> = {
  item: '/thu-vien/item/',
  note: '/thu-vien/ghi-chu/',
  opportunity: '/co-hoi/',
  skill: '/phat-trien/ky-nang/',
};

/** The deep link of a record (language-neutral: the cookie picks the language, as everywhere in the app). */
export const linkHref = (kind: LinkKind, id: number): string => `${KIND_PATHS[kind]}?id=${id}`;

/** A record the `[[` picker offers. */
export interface LinkTarget {
  kind: LinkKind;
  id: number;
  title: string;
}
