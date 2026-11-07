import type { TrackSlug } from '@/lib/books';
import { cn } from '@/lib/utils';

/**
 * Drawing of each Sổ tay group on a 24 grid: [flat fill in the group colour, ivory paper fill, ink outline, ivory
 * strokes]; '' when a mark has none. Kinh doanh: a little shop under a striped awning (the door is a hole in the
 * coloured wall: its subpath runs the other way, so the nonzero rule cuts it out). IT: a terminal window with a
 * prompt. Kỹ năng: a graduation cap with its tassel (the crown's fill runs up under the board, the same way round,
 * so the two parts join without a seam). Never a light bulb: that is Cơ hội's nav icon (lib/app-nav.ts).
 */
const MARKS: Record<TrackSlug, [fill: string, paper: string, ink: string, light: string]> = {
  'kinh-doanh': [
    'M4.5 4h5l-.67 4.5a3.17 2.25 0 0 1-6.33 0zM14.5 4h5l2 4.5a3.17 2.25 0 0 1-6.33 0zM4.5 10.2h15v10.3h-15zM13 14v6.5h4V14z',
    'M9.5 4h5l.67 4.5a3.17 2.25 0 0 1-6.34 0z',
    'M4.5 4h15l2 4.5a3.17 2.25 0 0 1-6.33 0 3.17 2.25 0 0 1-6.34 0 3.17 2.25 0 0 1-6.33 0zM4.5 10.6v9.9h15v-9.9M2.5 20.5h19M13 20.5V14h4v6.5',
    '',
  ],
  it: [
    'M2.5 8.5h19V17a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17z',
    'M5 4.5h14A2.5 2.5 0 0 1 21.5 7v1.5h-19V7A2.5 2.5 0 0 1 5 4.5z',
    'M5 4.5h14A2.5 2.5 0 0 1 21.5 7v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17V7A2.5 2.5 0 0 1 5 4.5zM2.5 8.5h19',
    'M6.5 11.5l3 2.5-3 2.5M12 16.5h4.5',
  ],
  'ky-nang': [
    'M12 4l10 4.8-10 4.8L2 8.8zM6 8.8h12v7.7c0 1.8-2.7 3.2-6 3.2s-6-1.4-6-3.2z',
    '',
    'M12 4l10 4.8-10 4.8L2 8.8zM6 10.7v5.8c0 1.8 2.7 3.2 6 3.2s6-1.4 6-3.2v-5.8M20 9.8v5.7',
    '',
  ],
};

/** The covers' ivory (components/book-cover.md): the one light tone of the marks, fixed like the brand mark's hues. */
const IVORY = '#faf9f5';

/**
 * The mark of a Sổ tay group (DESIGN.md §4 "Group marks"): a small drawing in the manner of the brand mark and the
 * handbook covers, in place of the old colour dot. The main flat fill is the group's `--track-<slug>` token (the hue
 * its progress bars wear); fills are printed slightly off register (translate 1.5 1.2, the covers' offset scaled to
 * this line); the ink is `currentColor`, so it follows the text in both themes and in forced colours; ivory is the
 * one light tone (an awning stripe, a title bar). No tile. Server and client alike (no hooks; it ships
 * in the Hôm nay bundle, keep it small); decorative, the group's name always sits next to it. 18px by default; pass
 * a `size-*` class (16px in rows, 20px before a section title).
 */
export function GroupMark({ track, className }: { track: TrackSlug; className?: string }) {
  const [fill, paper, ink, light] = MARKS[track];
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={cn('size-4.5 shrink-0', className)}>
      <g transform="translate(1.5 1.2)">
        <path fill={`var(--track-${track})`} d={fill} />
        {paper && <path fill={IVORY} d={paper} />}
      </g>
      <g fill="none" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path stroke="currentColor" d={ink} />
        {light && <path stroke={IVORY} strokeWidth="1.5" d={light} />}
      </g>
    </svg>
  );
}
