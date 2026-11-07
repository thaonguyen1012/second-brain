// Sổ tay group colours (DESIGN.md §4, §9a): `--track-<slug>` in app/global.css, the hue of the area a group's
// handbooks feed. It appears in two forms only: the main fill of the group's drawn mark (components/group-mark.tsx,
// which reads the token itself; there are no group dots) and, through `trackFill`, the progress indicator wherever
// one handbook or group is shown (Sổ tay cards and rows, the Hôm nay hero, its in-progress rows, the Sổ tay tile and
// the roadmap rows). The cover is an illustration (components/book-cover.tsx), text stays neutral and the empty
// progress rail stays gray. Class names are written out in full: Tailwind only generates classes it finds in the
// source.
import type { TrackSlug } from './books';

/** Solid group colour of a progress indicator (a book's or a group's bar). */
export const trackFill: Record<TrackSlug, string> = {
  'kinh-doanh': 'bg-track-kinh-doanh',
  it: 'bg-track-it',
  'ky-nang': 'bg-track-ky-nang',
};
