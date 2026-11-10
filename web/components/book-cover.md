# Handbook covers: style guide

A set of drawings, `web/public/covers/<name>.svg`, shown by `components/book-cover.tsx`. A handbook's registry entry
names its drawing (`cover` in `lib/books.ts`): the importer takes `--cover <name>` or, without it, picks one by the
slug, so every imported handbook has a cover; draw a new one and name it in the registry to give a book its own.
Think of a series of paperbacks from one mid-century publisher: the same paper, the same inks, the same hand, one
idea per book. The references that set the bar: `columns.svg` (three columns rising like a bar chart before a clay
sun) and `lighthouse.svg` (a lighthouse keeping watch at dusk). Copy their structure, not their subjects. Original
drawings only: never trace or imitate anyone's real artwork, logos or wordmarks.

The book's name is **not** in the drawing. The app prints it in HTML over the drawing's calm top-left.

## File

- `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140">` (16:7). No `width`/`height`: CSS sizes it.
- At most **6 KB** (6144 bytes). Integer or one-decimal coordinates; reuse geometry with `<defs>` + `<use href>`.
- Allowed elements: `rect`, `circle`, `ellipse`, `path`, `polygon`, `g`, `use`, `defs`, one `filter`.
  Forbidden: `text`, `image`, `data:` URIs, gradients, `style`, `script`, event attributes, `xlink:href`, external
  URLs, fonts, `opacity`/`fill-opacity`/`stroke-opacity`, `mask`, `clipPath`.

## Palette (fixed: hex inside the SVG only, no other colours, no tints, no transparency)

| Name | Hex | Use |
|---|---|---|
| ground (oat) | `#e3dacc` | the paper. Always the first element: `<rect width="320" height="140" fill="#e3dacc"/>`, flat, never filtered |
| ink | `#141413` | every outline, small solid details (door, keyhole, window bars) |
| ivory | `#faf9f5` | light faces, highlights, light beams, wave dashes |
| manilla | `#ebdbbc` | light fill **inside an ink outline only** (next to the ground it disappears) |
| kraft | `#d4a27f` | wood, earth, hills, paper goods |
| clay | `#d97757` | the accent: the one big warm shape the eye lands on (a sun disc, the main object) |
| book cloth | `#cc785c` | the shade side of clay, roofs, plinths: a second warm, never next to clay without an outline between |
| sky | `#6a9bcc` | water, glass, sky shapes: the cool counterpoint |
| olive | `#788c5d` | plants, land, grass |

Per cover: ink, ivory and the ground plus **at most 4** of the other six. No tone was added to or dropped from this set.

## Construction (four layers, in this order)

1. **Ground**: the flat oat rect above. The app paints the same oat behind the image while it loads, so the ground
   must stay flat and unfiltered.
2. **Background shapes** (1 to 3): big, simple, flat, **no outline**: a sun or moon disc, hills, a sea band with a
   wavy top, an arch, a horizon strip. They may bleed off the left, right and bottom edges. Grain filter on.
3. **Subject fills**: flat fills, the whole group shifted `transform="translate(2.5 2)"` (the misregistered print:
   fill and outline 2-3 px apart). Grain filter on.
4. **Subject ink**: the same geometry again (`<use>`), `fill="none" stroke="#141413" stroke-width="3"
   stroke-linecap="round" stroke-linejoin="round"`. Inner detail lines 2 (never thinner). Optional last: a few ivory
   strokes (2.5) for highlights or wave dashes.

The grain, copied as is (change only `seed`), applied to layers 2 and 3 with `filter="url(#g)"`: ivory specks inside
inked areas, never on the ground.

```svg
<filter id="g" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="n"/>
<feColorMatrix in="n" values="0 0 0 0 .98 0 0 0 0 .976 0 0 0 0 .96 2.6 0 0 0 -1.62" result="s"/>
<feComposite in="s" in2="SourceGraphic" operator="in" result="d"/>
<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="d"/></feMerge>
</filter>
```

## Composition (canvas units, 320 x 140)

```
x 0                    144      180                       320
  +---------------------+--------+--------------------------+  y 0
  | NAME ZONE (x 0-180, y 0-64): ground or flat background   |
  | shapes only; the app prints the name here, 2 lines        |
  |                     :        |   SUBJECT SQUARE           |
  | CALM LEFT (x 0-144): only    |   x 180-320: the subject   |
  | background shapes, full      |   and its props, inked;    |
  | height                       |   essential silhouette     |
  |                     :        |   inside x 196-316         |
  |~~~~ hills / sea / horizon may run the full width ~~~~~~~~~|  y ~112-128
  +---------------------+--------+--------------------------+  y 140
```

- **One subject + at most 3 props** (background shapes do not count). The subject fills at least 60% of the square's
  height and stands on a ground line around y 112-128.
- Every crop the app makes keeps the **right edge**, so the subject must read inside the right square alone:

  | Where | Box | What shows |
  |---|---|---|
  | Sổ tay card (band) | 16:7, 236-375 px wide | everything, name over the left |
  | Hôm nay hero on a phone | 16:7, full width | everything, name over the left |
  | Hôm nay hero column (from sm) | 224 x 168 | x 133-320, no name |
  | "Đang học" shelf row | 80 x 56 | x 120-320 |
  | 64 px square | 64 x 64 | x 180-320 |
  | Sổ tay card on a phone | 72 x 82 (taller with a 2-line title) | x 197-320 |

- Avoid near-tangents: shapes either overlap clearly (6 px or more) or stay apart; no edge 1-5 px from another edge.
- Give a book a **metaphor**, not its logo or a literal UI: an adult, warm, slightly witty object. No two covers share
  a subject; vary the background shapes across the set (not a sun on every cover).

The drawings in the set (a new one takes a subject none of them has):

| Name | Subject |
|---|---|
| abacus | an abacus on a hill |
| balloon | a hot-air balloon among flat cloud shapes |
| blocks | stacked wooden blocks |
| columns | three columns rising like a bar chart before a clay sun |
| easel | an easel holding a framed grid layout |
| hourglass | an hourglass on a stack of books, a moon behind |
| house | a cut-away house: facade in front, pipes in the walls |
| lighthouse | a lighthouse keeping watch at dusk |
| magnifier | a big magnifying glass over a chart on paper |
| megaphone | a vintage megaphone on a crate, its sound as flat arcs |
| mobile | a Calder-style hanging mobile |
| mountain | a mountain with a zig-zag path and flags at the milestones |
| telephone | a rotary desk telephone, ringing |
| water-tower | a water tower with a pipe and a valve |
| wind-up-bird | a wind-up bird with its key |

## Avoid

Clip-art (a padlock on a shield, a brain, a light bulb, a gear, a cloud with an arrow, a rocket, a robot face, a laptop
with code), hairlines (< 2), outlines on background shapes, more than 4 hues, gradients, glows, shadows, purple,
sparkles or 4-point stars, emoji, any letters, numbers or logos, faces with features (a figure may appear only as a
simple silhouette), dense detail that turns to noise at 64 px, symmetrical "icon" compositions centred on the canvas.

## Checklist (every cover)

- [ ] `viewBox="0 0 320 140"`, no width/height, <= 6144 bytes, no text/image/gradient/style/script/external URL.
- [ ] First element is the flat oat ground rect; colours only from the palette; at most 4 hues besides ink/ivory/oat.
- [ ] Exactly one filter (the grain, unchanged but the seed) on background shapes and subject fills only.
- [ ] Subject fills offset `translate(2.5 2)`; ink outline 3, detail 2, round caps and joins.
- [ ] Name zone x 0-180, y 0-64 and the calm left x 0-144 hold only flat background shapes.
- [ ] Subject recognisable in the 64 px crop, the 80x56 shelf row and the 72x82 phone card (contact sheet).
- [ ] The name over the band reads (2 lines at 236 px), and the 224x168 hero column is a good picture on its own.
- [ ] No near-tangents; one subject + at most 3 props; reads warm and adult, not like an icon set.
- [ ] Looks right on the white page and on the dark card (the cover does not change with the theme).

Check with the contact sheet (lints the file and renders every crop above at 2x):
`node web/scripts/cover-sheet.mjs <name> [<name> ...] --out <dir>`, then look at `<dir>/<name>.png` and `<dir>/sheet.png`.
