// Sổ tay group colours (DESIGN.md §4): `--track-<slug>` in app/global.css, the hue of the area a group's handbooks
// feed, painted only on Sổ tay as the card dot, the progress indicator and the jump-link underline; text stays
// neutral and the empty progress rail stays gray. Shared by the book cards and the Sổ tay page. Class names are
// written out in full: Tailwind only generates classes it finds in the source.
import type { TrackSlug } from './books';

/** Solid group colour: the dot on a book card and the progress indicator. */
export const trackFill: Record<TrackSlug, string> = {
  'kinh-doanh': 'bg-track-kinh-doanh',
  it: 'bg-track-it',
  'ky-nang': 'bg-track-ky-nang',
};

/** Underline colour of a group jump link on Sổ tay (the link text stays neutral). */
export const trackUnderline: Record<TrackSlug, string> = {
  'kinh-doanh': 'decoration-track-kinh-doanh',
  it: 'decoration-track-it',
  'ky-nang': 'decoration-track-ky-nang',
};
