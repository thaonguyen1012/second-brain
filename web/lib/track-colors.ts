// Sổ tay group colours (DESIGN.md §4, §9a): `--track-<slug>` in app/global.css, the hue of the area a group's
// handbooks feed, painted wherever one handbook is shown (Sổ tay cards, rows and jump dots; the Hôm nay hero, its
// in-progress rows, the Sổ tay tile and the roadmap rows) as its cover, its dot and its progress indicator; text
// stays neutral and the empty progress rail stays gray. Class names are written out in full: Tailwind only
// generates classes it finds in the source.
import type { TrackSlug } from './books';

/** Solid group colour: the dot of a handbook and its progress indicator. */
export const trackFill: Record<TrackSlug, string> = {
  'kinh-doanh': 'bg-track-kinh-doanh',
  it: 'bg-track-it',
  'ky-nang': 'bg-track-ky-nang',
};

/** A handbook's cover: the flat group tint (the area's -soft step) under its monogram (§9a). */
export const trackSoft: Record<TrackSlug, string> = {
  'kinh-doanh': 'bg-track-kinh-doanh-soft',
  it: 'bg-track-it-soft',
  'ky-nang': 'bg-track-ky-nang-soft',
};

/** The monogram on a cover, in the group hue (a 24px mark, >= 3.4:1 on its tint; never body text). */
export const trackInk: Record<TrackSlug, string> = {
  'kinh-doanh': 'text-track-kinh-doanh',
  it: 'text-track-it',
  'ky-nang': 'text-track-ky-nang',
};
