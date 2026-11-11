// The importer never writes outside the book folder, whatever the export's SUMMARY.md says (security audit S-22).
import { describe, expect, it } from 'vitest';
import { parseSummary, planLayout } from './book-import.mjs';

describe('planLayout', () => {
  it('keeps ordinary links inside the book', () => {
    const { files } = planLayout(parseSummary('* [Intro](README.md)\n* [M](m/README.md)\n  * [A](m/a.md)\n'));
    expect(files.map((f) => f.out)).toEqual(['index.md', 'm/index.md', 'm/a.md']);
  });

  it.each([
    '* [Up](../README.md)\n  * [A](../a.md)\n',
    '* [Up](x/../../README.md)\n  * [A](a.md)\n',
  ])('refuses a path that climbs out: %s', (summary) => {
    expect(() => planLayout(parseSummary(summary))).toThrow(/Unsafe output path/);
  });
});
