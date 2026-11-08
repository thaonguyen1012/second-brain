// The name printed on each handbook's cover (DESIGN.md §9a): the registry title without its series prefix, derived
// here rather than listed, so a new import gets its cover name with no extra step. Free of the registry itself, so a
// client chunk can call coverName() without pulling in every book.

/**
 * "Sổ tay 1 – Nền tảng kinh doanh" -> "Nền tảng kinh doanh", "Sổ tay AI Engineering" -> "AI Engineering": drops the
 * "Sổ tay" prefix and any "N –" number after it, first letter upper case. A title that is only the prefix stays as is.
 * The English titles (lib/i18n/en/shell.ts) work the same: "Handbook 1 – Business foundations" -> "Business
 * foundations", "AI Engineering handbook" -> "AI Engineering".
 */
export function coverName(title: string): string {
  const full = title.normalize('NFC').trim();
  const name = full
    .replace(/^(?:sổ tay|handbook)\s*/iu, '')
    .replace(/^\d+\s*[–—-]\s*/u, '')
    .replace(/\s+handbook\b/iu, '')
    .trim();
  if (!name) return full;
  return name.charAt(0).toLocaleUpperCase('vi') + name.slice(1);
}
