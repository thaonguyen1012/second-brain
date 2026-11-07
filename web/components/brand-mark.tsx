import type { SVGProps } from 'react';

/**
 * The app's mark (owner, 07/11/2026: no bordered tile, colourful, in the manner of Anthropic's warm palette): an open
 * handbook, orange and blue pages, with a green sprout growing from its spine. The ink (spine and stem) is
 * `currentColor`, so it follows the text colour in both themes; the three hues are the mark's own and name nothing
 * else in the app (DESIGN.md §4). Same drawing as public/icons/icon.svg, which scripts/make-icons.mjs renders to the
 * PNG icons: change both together. Integer steps on a 128 grid keep it small (home JS budget). Decorative: the app
 * name always sits next to it.
 */
export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 128 128" aria-hidden focusable="false" {...props}>
      <path fill="#d97757" d="M61 62c-12-9-30-12-50-9-1 20-1 40 1 60 19-3 36 0 49 9 1-20 1-40 0-60z" />
      <path fill="#6a9bcc" d="M67 62c12-9 30-12 50-9 1 20 1 40-1 60-19-3-36 0-49 9-1-20-1-40 0-60z" />
      <path fill="#788c5d" d="M67 41c3-19 18-29 37-29-2 18-17 30-37 29zM63 50c-3-15-14-24-30-24 1 16 13 25 30 24z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="6.4"
        strokeLinecap="round"
        d="M64 119c1-18 1-35 0-52-1-15 1-29 5-41"
      />
    </svg>
  );
}
