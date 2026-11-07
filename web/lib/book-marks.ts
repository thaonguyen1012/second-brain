// The monogram on each handbook's cover (DESIGN.md §9a): Geist 600 in the group hue on its -soft tint. Kept outside
// the generated BOOKS block of books.ts, so the importer never overwrites it, and free of the registry itself, so a
// client chunk can call markOf() without pulling in every book.

/** Slug -> monogram: the number of Sổ tay 1-5, a short word for the others. */
export const bookMark: Record<string, string> = {
  'handbook-01': '1',
  'handbook-02': '2',
  'handbook-03': '3',
  'handbook-04': '4',
  'handbook-05': '5',
  'handbook-06': 'AI',
  'handbook-07': 'Auto',
  'handbook-08': 'Sec',
  'handbook-09': 'Data',
  'handbook-10': 'Ops',
  'handbook-11': 'F8',
  'handbook-12': 'FE',
  'handbook-13': 'FS',
  'handbook-14': 'Học',
  'handbook-15': 'PM',
};

/**
 * A handbook's monogram; a book without an entry (a new import) gets the first two letters of its title after the
 * "Sổ tay" prefix and any "N –" number ("Sổ tay Học máy" -> "Họ"), first letter upper case.
 */
export function markOf(book: { slug: string; title: string }): string {
  const mark = bookMark[book.slug];
  if (mark) return mark;
  const name = book.title.replace(/^sổ tay\s*/iu, '').replace(/^\d+\s*[–-]\s*/u, '');
  const letters = (name.match(/\p{L}/gu) ?? []).slice(0, 2).join('');
  if (!letters) return '?';
  return letters.charAt(0).toLocaleUpperCase('vi') + letters.slice(1);
}
