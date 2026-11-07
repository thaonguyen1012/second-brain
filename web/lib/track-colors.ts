// Sổ tay group colours (DESIGN.md §4, §9a): `--track-<slug>` in app/global.css, the hue of the area a group's
// handbooks feed, painted wherever one handbook is shown (Sổ tay cards, rows and jump dots; the Hôm nay hero, its
// in-progress rows, the Sổ tay tile and the roadmap rows) on its dot and its progress indicator only: the cover is
// an illustration (components/book-cover.tsx), text stays neutral and the empty progress rail stays gray. Class
// names are written out in full: Tailwind only generates classes it finds in the source.
import type { TrackSlug } from './books';

/** Solid group colour: the dot of a handbook and its progress indicator. */
export const trackFill: Record<TrackSlug, string> = {
  'kinh-doanh': 'bg-track-kinh-doanh',
  it: 'bg-track-it',
  'ky-nang': 'bg-track-ky-nang',
};
