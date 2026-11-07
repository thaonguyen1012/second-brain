# DESIGN.md: rubric for the real app UI

Binding for every page in the app shell (`app/(home)/*`, `components/brain/*`, `components/app-shell.tsx`, dialogs,
Cmd+K). Not for Stageshow guides and intro pictures (they follow `.claude/skills/stageshow/`) or lesson prose
(Fumadocs, `#nd-page .prose`). Target: a screen that could sit next to Linear, Raycast or Notion and not look
generated. Space UI (`components/ui`, `components/spaceui`, tokens in `app/global.css`) is the source of truth; a
missing component is added with `npx shadcn@latest add @spaceui/<name>`, never hand-written. Reviews cite rules
by ID (D1...D32, last section).

## 1. Principles

1. **Restraint.** Fewer surfaces, fewer words; no colour without a meaning (§4). Before adding a border, badge, icon
   or line of help, remove something. Detail goes on the record the user is acting on, not on every row.
2. **One focal point per screen.** Decide what the eye lands on first (Hôm nay: "Tiếp tục học"; Inbox: the
   selected entry; Tuần: this week's objectives; Giờ: the running timer) and give it the weight. Everything
   else is quieter.
3. **Hierarchy by type weight and colour, not boxes.** Title vs meta is `foreground`/600 vs
   `muted-foreground`/400, not a new container. Group with whitespace and one divider, not nested cards.
4. **Real product, simplified.** Signature content stays (thumbnails, the week number, the timer, numbers);
   decoration goes (eyebrows, gradients, an icon on every heading, sparkle; §5 names the few headings that carry
   one).
5. **Same thing, same look, every page** (DECISIONS 4.4): one row anatomy, one status palette, one tag style.

## 2. Type scale

Inter (`font-sans`) for UI, Geist (`font-heading`) only for titles, JetBrains Mono (`font-mono`) only for code,
URLs, keys and aligned numbers. Weights 400, 500, 600 only (no 700). Sentence case everywhere; no
`uppercase`/`tracking-wide` labels.

| Role | Classes | px / line | Where |
|---|---|---|---|
| Page title | `font-heading text-3xl font-semibold tracking-tight` | 30 / 36 | `PageHeader` h1, one per page |
| Big number | `font-heading text-2xl font-semibold tabular-nums` | 24 / 32 | at most one per screen (timer, count, week rhythm) |
| Cover name | `font-heading font-semibold leading-tight tracking-tight text-cover-ink`, `clamp(14px, 5.5cqw, 18px)` | 14-18 / 1.25 | printed on a handbook cover only (`BookCover`, §9a), sized by the cover's width, 2 lines |
| Section | `font-heading text-lg font-semibold tracking-tight` | 18 / 28 | h2 inside a page |
| Card title | `font-heading text-[15px] font-semibold leading-5` | 15 / 20 | `BrainCard` title only |
| Group / row title | `text-sm font-medium` (group heading: `font-semibold`) | 14 / 20 | list rows, card headers, dialog fields |
| Body | `text-sm leading-relaxed text-muted-foreground` | 14 / 23 | page description (`max-w-2xl`), paragraphs |
| Dense body | `text-[13px] leading-relaxed` | 13 / 21 | excerpts inside a card or row |
| Meta / label | `text-xs text-muted-foreground` (label: `font-medium`) | 12 / 16 | dates, hosts, counts, field hints |

Floor: **12px**. Exceptions: chart axis ticks 11px; a numeric count `Badge size="sm"` on a button (Inbox count).
Numbers that line up or change in place get `tabular-nums`. Dates are `formatDate()` (vi-VN), meta joins with ` · `.

## 3. Spacing and alignment

- **Steps:** 4px grid only: `1` (4), `1.5` (6), `2` (8), `3` (12), `4` (16), `6` (24), `8` (32), `10`/`12` (40/48).
  No odd arbitrary values (`mt-[7px]`).
- **Gutters:** `px-4` (16px) at 390 px, `sm:px-8` (32px) from 640 px, the same as `PageHeader`; every block's left
  edge aligns with the title row's left edge (the title icon when there is one, §5). Top bar `h-16`. No horizontal
  page scroll at 390 px.
- **Widths:** content `max-w-7xl`; Hôm nay main + `20rem` rail from `xl`; reading views `max-w-2xl`/`3xl`.
- **Rhythm:** title to its meta 2-4px (`gap-0.5`/`gap-1`); row to row 0 (divider) or 4px; group to group 24-32px
  (`gap-6`/`gap-8`); page header to first content 24px (`pb-6`). A title is always closer to its own meta than to
  the next record.
- **Insets:** words keep 12px from any container edge (`px-3`), 16px in cards and dialogs. Edges either align
  exactly or sit 8px+ apart; 1-3px near-misses are bugs. A button keeps 8px+ from the field above it.
- **Row heights:** 32px menu/sidebar row (`h-8`; a sidebar group label is 28px, `h-7`, so it sits close to its rows);
  40px one-line list row (`h-10 px-3`); 56px two-line row (title + meta). Touch targets reach 44px via the
  components' own `pointer-coarse` rules; never shrink below them.
- **Columns:** rows of one list share one grid template with fixed tracks (status, title flexible, meta, actions);
  optional content keeps its track empty so columns stay aligned.
- **List row beats card** when items are homogeneous and scanned or triaged (items, notes, projects, time entries,
  skills, opportunities, search results): rows in one container, `rounded-xl border bg-card divide-y`, hover fill
  `hover:bg-accent`, selection `bg-accent` + `aria-selected`. **Card** only when the record carries an image or an
  excerpt worth reading in place (inbox entry, brief story) or it is a dashboard tile on Hôm nay; cards stack with
  `gap-3`. Never a card per row of a list of more than ~5 plain records, except in a board view (§6 "Board"), where
  the cards are the thing moved; the same records keep their rows in the list view beside it.
- **Radii:** containers `rounded-xl`, controls `rounded-lg` (Button default), row and hover fills `rounded-md`,
  badges `rounded-sm`, avatars/dots `rounded-full`. `rounded-2xl`/`rounded-3xl` are legacy: do not add more.
  Nested shapes: inner radius = outer radius - padding.

## 4. Colour

Tokens only (`bg-background`, `bg-card`, `bg-muted`, `bg-secondary`, `bg-accent`, `text-foreground`,
`text-muted-foreground`, `border-border`, `ring`, `sidebar-*`, `area-*`, `track-*`, `chart-*`); no hex, `zinc-*` or
`orange-*` utilities in components; a new colour is a token in `:root` and `.dark` with an `@theme` mapping.

Owner, 03/11/2026 ("app chỉ có màu đen trắng vậy?"): colour by area, by Sổ tay group, a filled "Học ngay", and data
colours as data arrives. Every hue names one thing: an area (with the Sổ tay group that feeds it), a status, the
data, the primary action or the "now" marker. Without purple there are more meanings than hues that stay far apart,
so the near pairs that remain are listed under the palette, not hidden.

- **Neutrals carry the page.** Text, surfaces, borders and fills stay neutral; body text is never coloured.
  Colour sits on marks (icons, the group marks, tiles, dots, bars, chips, chart marks), the handbook covers'
  illustrations (§9a), the area header band and the blue primary.
- **Blue `primary` is for the one primary action** of a view (filled `Button` default; hover and press darken it to
  `--primary-hover`, 10% toward black, so its label keeps >= 6:1) and for links/focus. It is not a selected-tab
  colour, not a heading colour, not a decoration, never an area or group colour. Sidebar row icons are not blue
  either: they take the row's text colour (owner, 06/11/2026, "icon cùng đen với chữ"; one area hue per icon was
  messy, 04/11, and the one blue that followed was dropped too).
- **No colour per area** (owner, 07/11/2026, after seeing the per-area header bands: "không để mỗi mảng một màu
  nữa"; title icons "không có nền", "cùng màu sắc"): the six sidebar areas share one look. The page title's icon is
  its sidebar row's lucide icon in the ink colour, without a tile (§5); every area page sits on the same neutral band
  (§9a); a Hôm nay tile heading's icon and a first-run empty panel's glyph are `muted-foreground`. The `--area-<key>`
  hues live on only as the handbook group hues below (and inside Stageshow pictures); `AreaKey` in `lib/app-nav.ts`
  still groups the rows. Pages outside the six areas (Inbox, capture, Giới thiệu, Hướng dẫn, personal page) get no title
  icon; the Inbox's colour stays the `warning` tone of its count.
- **Group colours** (`--track-<slug>`; `trackFill` in `lib/track-colors.ts`): a Sổ tay group wears
  the hue of the area its handbooks feed, so the hue keeps one meaning: Kinh doanh -> Cơ hội (orange: business
  ideas), IT -> Công việc (teal: paid technical work), Kỹ năng -> Tuần (pink: học cách học and project management
  are practised in the weekly plan and review). Blue is the "Học ngay" button, so no group is blue. The hue appears
  in two forms only: as the main fill of the group's mark (below; since 07/11/2026 in place of every group dot: the
  Sổ tay jump row, the group section titles, the Hôm nay hero's "Sổ tay khác đang học" rows) and as the solid
  progress indicator wherever one handbook or group is shown (Sổ tay cards and "Đang học" rows, the Hôm nay hero,
  the Sổ tay tile, the roadmap rows). Never on text, never as a dot, and never on the cover: since 07/11/2026 a
  cover is an illustration in the fixed cover palette, the same for every group (owner: "illustration kiểu retro ...
  thay vì để màu", §9a).
- **Status colours come from `lib/labels.ts` tones only** (`Tone` -> `Badge` variant): `info` = active/keep,
  `success` = done/build, `warning` = needs attention (Inbox), `error` = failed, `secondary` = planned/undecided,
  `outline` = dropped/archived. The same status has the same colour on every page; a colour never means two things.
- **Data colours arrive with data and stay coloured.** One data hue, the dataviz blue `--chart-data` (slot 1), is the
  first or only series of every chart (billable hours, hours for objectives, market frequency, score history, the
  topic heatmap); a second series is a weaker step of it (`--chart-nonbillable`) or gray (`--chart-other`). Status
  chips and the skill freshness dots (`bw-green`/`bw-yellow`) keep their colours. No chart takes an area or group
  hue, and no area hue sits in the blue, green, yellow or red that the data and the statuses use.
- **Highlight:** `bw-red` only for the "now / continue" marker (Tiếp tục học dot, a running timer). Book progress
  takes the group colour.
- **Brand mark** (`components/brand-mark.tsx`; owner, 07/11/2026: "không có border bao quanh", colourful, in the
  manner of Anthropic's warm palette): an open handbook, orange `#d97757` and blue `#6a9bcc` pages, with a green
  `#788c5d` sprout from its spine; spine and stem in `currentColor`. With the handbook covers (§9a) and the group
  marks (below) one of the three kinds of drawing in the app: its three hues belong to the cover palette and, like
  it, are fixed hex values inside the drawing, not tokens, naming nothing. Only in the sidebar header
  (28px), the Fumadocs nav (24px), the /gioi-thieu/ hero and the icons in `public/icons/` (PNGs rendered by
  `scripts/make-icons.mjs` from `icon.svg`). Never on a tile, border, ground or shadow in the app; only the opaque OS
  icons (apple-touch, maskable) stand on a full-bleed ivory `#faf9f5` that the OS rounds or masks.
- **Group marks** (`components/group-mark.tsx`, `GroupMark`; owner, 07/11/2026, about the dots of the jump row:
  "thay mấy chấm bằng illustrations tự vẽ theo style của illustration trong app đi, như logo ấy"): a Sổ tay group
  is drawn, not dotted. One original drawing per group, each a different silhouette: Kinh doanh a little shop under
  a striped awning, IT a terminal window with a prompt, Kỹ năng a graduation cap with its tassel. Never a sprout or
  an open book (the brand mark's) and never the glyph of a sidebar row (a light bulb is Cơ hội, a briefcase Dự án,
  a clock Giờ, a trophy Nhật ký thành tựu: `lib/app-nav.ts`), so a drawing never names another place. Built like a
  cover in miniature, on a 24 grid: the ink outline in `currentColor`, 1.75 with round caps and joins, so it follows
  the text in both themes and in forced colours as the brand mark's spine does; the main flat fill is the group's
  `--track-<slug>` token, the hue its progress bars wear, so the mark keeps the meaning the dot had; at most one
  light tone, the covers' ivory `#faf9f5` (an awning stripe, a title bar, the prompt's strokes), a fixed hex inside
  the drawing like the brand mark's hues (manilla `#ebdbbc` is the one other allowed); the fills printed off register
  by `translate(1.5 1.2)`, the covers' 2.5/2 offset scaled to the thinner line. In dark the ink turns white, so no
  inner detail is ink over a fill (it would vanish on the light dark-theme hues): details are holes (the door), fill
  edges or ivory strokes; the only ink over colour is an outline between two parts of one silhouette (the cap's board
  over its crown). No tile, border, ground, text, gradient, glow, shadow, purple, sparkle or emoji. Sizes: 18px on
  the Sổ tay jump row (`opacity-100`: the Button dims its icons to 80%; the first link's `-ms-2` puts its mark on the
  column edge, in line with the section titles' marks), 20px before a group's section title (`SectionHeader mark`,
  centred on the title's line, the h2 keeps the text baseline for the meta), 16px on the Hôm nay hero's other-book
  rows; each drawing reads at 16, 18 and 20px. Server-rendered, except in the hero, where it ships in the Hôm nay
  bundle (home First Load JS budget, DECISIONS 10.2: keep the component small). Decorative (`aria-hidden`): the
  group's name always sits next to it. Progress bars keep their solid group fill; the skill freshness dots on Kỹ năng
  are statuses, not groups, and stay dots. A new group gets a new drawing under the same rules, never a dot.
- **Forbidden:** purple (`bw-purple`, `chart-4` dark) in app UI, gradients, glows, coloured shadows, translucent
  overlapping fills, gradient text, sparkle or other AI decoration, emoji as icons; an area or group hue that reads
  as the primary blue, `bw-red`, destructive red or a status colour.
- **Palette** (WCAG contrast of the mark on each ground; `-soft` = `color-mix(in oklab, hue 14%, card)` light, 22%
  dark). Light: white = the page and every surface; sidebar = `neutral-100`; hover = the sidebar hover fill
  (`zinc-200` until 06/11/2026; now a lighter `neutral-200`/`neutral-100` mix, so these are lower bounds). Dark: card = surfaces; page = the page and the sidebar (`zinc-950`); hover = `zinc-800`. The sidebar
  and hover columns are kept from when the sidebar icons wore these hues (until 04/11/2026); since 07/11/2026 the
  hues mark handbook groups only. Light marks are >= 3:1 everywhere, dark >= 4:1.

  | Token | Where | Light | white / sidebar / hover / soft | Dark | card / page / hover / soft |
  |---|---|---|---|---|---|
  | `--area-today` | Hôm nay | `--foreground` on `--muted` | 19.9 / 18.2 / 15.7 / 16.8 | `--foreground` on `--muted` | 18.4 / 19.9 / 14.9 / 16.5 |
  | `--area-week` = `--track-ky-nang` | Tuần, Kỹ năng | `#c85088` | 4.2 / 3.9 / 3.3 / 3.6 | `#ffb5d2` | 11.2 / 12.1 / 9.1 / 7.3 |
  | `--area-growth` | Phát triển | `#658300` | 4.4 / 4.0 / 3.4 / 3.7 | `#afd34c` | 10.7 / 11.6 / 8.7 / 7.1 |
  | `--area-library` | Thư viện | `#764f1a` | 7.2 / 6.6 / 5.7 / 5.8 | `#b28c5c` | 6.0 / 6.4 / 4.8 / 4.5 |
  | `--area-opportunity` = `--track-kinh-doanh` | Cơ hội, Kinh doanh | `#cf5d03` | 4.0 / 3.7 / 3.2 / 3.4 | `#fd9149` | 8.2 / 8.8 / 6.6 / 5.8 |
  | `--area-work` = `--track-it` | Công việc, IT | `#00635d` | 7.1 / 6.5 / 5.6 / 5.7 | `#1db9ad` | 7.5 / 8.1 / 6.1 / 5.4 |
  | `--chart-data` (= billable, objective) | every chart | `#2a78d6` | 4.4 on card | `#3987e5` | 5.1 on card |
  | `--chart-nonbillable` | Công việc | `#86b6ef` | 2.1 on card (labelled) | `#1c5cab` | 2.8 on card (labelled) |
  | `--cover-ground` / `--cover-ink` | handbook covers (§9a) | `#e3dacc` / `#141413` | name 13.3:1 on the ground; ground 1.38 on white (the drawing and the card edge carry it) | the same (a printed object) | ground 13.3 on the card |
  | `--well` | wells (§9a) | `oklch(0.977 0 0)` ≈ `#f7f7f7` | muted text 7.2 · area hues 3.8-6.8 · data 4.1 · nonbillable 2.0 · muted fill 1.11 | `hsl(0 0% 6%)` = `#0f0f0f` | muted text 7.3 · area hues 6.2-11.7 · data 5.3 · nonbillable 2.9 · muted fill 1.16 |

  The header band is the well tone. On a band or a well the link blue stays >= 4.55:1 (light) / 7.1:1 (dark) and the
  focus ring >= 3.3:1 / 7.1:1. Near miss: the `bw-red` today ring on the week strip is 2.9:1 on the light well (3.1 on white);
  today is also the last solid cell before the dashed ones, and named in the cell's title ("Hôm nay, ...") and the
  strip's label. The strip's other near misses (nonbillable 2.0, muted cell 1.1, dashed future 1.3) are named too:
  `StripLegend` beside every strip, and the label lists the days of each level in words. Under forced colours the
  cells switch to system colours (outlined, half-filled, filled; Highlight outline for today).

  Distance (OKLab ΔE ×100, normal / the lower of protan and deutan; dataviz validator), light | dark:
  - Sidebar neighbours >= 15.4 / 10.7 | 12.8 / 6.8 (Thư viện and Cơ hội: the brown stays darker than the orange).
  - The three groups >= 14.9 / 7.6 | 16.0 / 7.0 (the teal is darker than the pink for colour-blind readers), and
    >= 17.2 from the Phát triển tile above them.
  - Every area and group hue >= 18.4 from `--chart-data`, >= 26 from `--chart-nonbillable`, >= 15.8 from the
    primary, >= 9.5 from `bw-red` and destructive red.
  - Against the statuses on the area's own pages: Phát triển >= 15.2 | 11.0 from the success and warning text and
    the freshness dots; Cơ hội >= 20.3 | 9.5 from the warning and error text (stale, overdue) and `bw-yellow`
    (the freshness of fit skills).
  - Near pairs kept because every free hue is taken: Thư viện's brown and the warning text of the Inbox count (6.8
    light; the chip reads as its pale yellow fill), Công việc's teal and the success text (7.7 light; a word in a
    chip next to a title icon), Tuần's pink and the error text (6.4 dark; on Tuần only in an error alert). The brown
    is the one hue below chroma 0.10 (0.08): a stronger brown turns into the Cơ hội orange. Labels and glyphs carry
    identity; colour helps.
- **AI output shows what the AI did, not that it is AI.** Suggested tags/destination render as normal
  `outline` badges followed by a small `text-xs text-muted-foreground` label "tự động" (or a "Gợi ý tự động:"
  prefix); an accepted suggestion loses the label. No sparkle, wand, bot or star icon, no purple, no shimmer.
- **Surfaces and contrast** (owner, 04/11/2026, from their reference sidebar: "đổi nền trang sang trắng"; this
  replaces the grey page of 03/11/2026. Current row from a second reference, 06/11/2026: "lúc active tab thì đậm hơn
  chút ... chứ không active tab màu trắng nữa"):
  - The page (`--background`) is white; every container on it (card, list container, empty state, panel, Hôm nay
    tile) is still a surface: `rounded-xl border bg-card`, white with a visible 1px `--border` (black 12%), so
    the border alone carries its edge. Dialogs, sheets, menus and popovers are `bg-popover` (white) with the same
    border.
  - The sidebar is the grey layer: `--sidebar` = `neutral-100` (no blue or purple tint) with its right border;
    hover is a slightly darker fill (`--sidebar-accent`, `neutral-200` 50% over `neutral-100`); the current row is
    one step darker again (`--sidebar-current` = `neutral-200`, 1.16:1 on the sidebar) in medium weight, no border
    or shadow (`app-shell.tsx`). Text and icons on it 15.8:1, muted text 6:1. The focus ring is drawn outside
    the row, on the sidebar (3.3:1).
  - Dark: the page and the sidebar are the darkest layer (`zinc-950`), surfaces are lighter (`--card` 8%,
    `--popover` 10%), borders white 12%. In the sidebar the hover is the faint popover step and the current row
    the zinc-800 fill, so the current row stays the strongest step. Depth comes from the lighter surface, not
    shadows.
  - Fills (`--muted`, `--accent`, `--secondary`) are darker than the page and the sidebar, so tabs, hovers and
    skeletons still show. Form controls (Input, Textarea, Select, Checkbox, Radio) are painted `bg-popover` like
    the outline Button, white on the page and on a surface alike; a surface also re-declares `--background`
    (global.css) for the rest (outline badges, ring offsets).
  - The keyboard cursor on a card list (Inbox) is a stronger border (`foreground/40` light, `foreground/50`
    dark), never a fill: the selected card keeps `bg-card` in both themes, because `Kbd` chips are `bg-accent`
    and would vanish on an accent-filled card.
  - Stageshow wells (guides, /gioi-thieu/ tiles) keep their `secondary` ground (`--card` in dark) and add the 1px
    `--border`; a guide in an empty panel's slot (`variant="flush"`) has neither: the slot's `bg-well` is its ground.
  - Blue stays the accent for the primary action, links and focus (plus the data blue of chart marks and a board's
    drop target, which takes the focus ring: like focus, it says where the action lands); surfaces
    never get a blue tint, and area tints appear only as the header band and as marks (§9a); cards and list
    containers stay white. Wells are `bg-well`.
  - Focus ring (`--ring`) opaque, >= 3:1 against the page, the sidebar and every surface (WCAG 1.4.11): light
    `#3582ff` is 3.6:1 on white and 3.3:1 on the grey sidebar; dark `#6aa5ff` 7:1 or more. Never lower it with
    `/50` or alpha.
    Form controls use it too: a focused Input, Textarea or Select gets `border-ring` + a 1px `ring-ring` in light
    (Space UI's default `foreground/10` halo was 1.2:1); dark keeps Space UI's `foreground/70` border.
  - Text stays AA on page, sidebar, surface and fill: `muted-foreground` is >= 5.6:1 on every one of them.
- **Border plus fill:** a surface is border + `bg-card` (the surface rule above), plus at most `shadow-depth-1`
  (the focal block). Inside a surface, a nested element gets a fill or a divider, never another bordered box
  (D12). `shadow-popover` only for things floating above the page (popover, menu, dialog, hovered draggable).
- **Both themes are designed.** Every screen is checked in light and dark.

## 5. Icons

- **lucide-react only**, default stroke (2) everywhere in a screen. Never mix stroke widths or filled and outline
  glyphs in one view. No hand-drawn SVG glyphs; the brand mark and the three Sổ tay group marks (§4) are the only
  drawings that are not lucide (their 1.75 ink on a 24 grid is their own line, not a lucide stroke to match). The
  handbook covers (§9a) are illustrations loaded as images, not icons.
- **One size per context:** 16px (`size-4`) in buttons, nav, toolbars, rows; 14px (`size-3.5`) in badges, meta
  lines and `xs` buttons; 28px (`size-7`, `strokeWidth={1.5} absoluteStrokeWidth`, so its line matches the 16px
  icons) for the page title icon; 32px (same line) for the glyph of a first-run empty panel; 16px in other empty
  states. Components
  already size their icons: do not override.
- **Icons earn their place:** nav items, a verb with a standard glyph (Plus, Trash2, ExternalLink, Pencil), a
  state colour alone cannot carry (spinner, error), and the tabs of a view switch that changes the layout (Dự án and
  Thư viện: `List` "Danh sách", `SquareKanban` "Bảng"; the Tabs' own icon size, 16px from `sm`). Tabs that filter
  one layout (Inbox, Tuần, the Item / Ghi chú route halves) stay text only. **No icon beside headings, card titles or section titles**,
  except: the title icon of an area page (`PageHeader nav`: the icon of the page's own sidebar row, ink colour, no
  tile, centred on the title's first line, `aria-hidden`; server-rendered, except on /co-hoi/ where the client list
  and detail views render the header) and the heading of a Hôm nay tile, which starts with the icon of where its link
  leads (that row's icon from `lib/app-nav.ts`, or the Inbox glyph), 16px in `muted-foreground`, and the section
  title of a Sổ tay group on the Sổ tay page, which starts with that group's mark (20px, §4). An empty state's
  glyph names the missing object (BookPlus, FlaskConical, FolderPlus...), never a nav icon, so it does not repeat the
  title icon. Nothing else.
- **No emoji as icons** (emoji are user content only). Icon-only buttons have `aria-label` and a `Tooltip`.

## 6. Components (which one for what)

- **Buttons** (`components/ui/button`): `default` (filled blue) = the one primary action per view region (page
  toolbar, dialog footer, empty state). One exception: "Học ngay" on every Sổ tay book card is filled (owner,
  03/11/2026, knowing it puts 15 blue buttons on that page); its "Liên kết" stays ghost. `outline` = secondary
  actions, at most 2-3 visible together; `ghost` =
  toolbar, row and icon actions; `link` = inline navigation, blue (`text-primary`, set once in the variant;
  a deliberately quiet jump-link row may override it with `text-muted-foreground`); `destructive-outline`/`DeleteButton` = delete
  entry point; filled `destructive` only as the confirm button inside `confirm-delete.tsx`. Sizes: `default` in
  page toolbars, `sm` in cards and dialogs, `xs` / `icon-sm` in rows. Label = Vietnamese verb + object.
- **Row actions:** at most 3 visible (primary verb first); the rest go in a `Menu` behind a ghost `icon-sm`
  `MoreHorizontal` with `MenuShortcut` for keys. Hover-revealed actions must also show on focus and on touch.
- **Badges:** status via `StatusBadge` + `lib/labels.ts`; tags as `outline` badges or plain muted `#tag` text,
  one style app-wide; at most 3 badges before the title. Badges are labels, never buttons or tabs.
- **View switches:** `Tabs` (`components/ui/tabs`, default segmented or `underline`) for in-page views and for
  route halves (Thư viện Item / Ghi chú). Never filled primary buttons as tabs. A view switch sits first in the
  toolbar; the filters that belong to one view follow it only in that view. The view lives in the URL
  (`?view=board`, the default view has no parameter), the last choice in localStorage (the URL wins), switched with
  `router.replace` without scrolling. Ghi chú's switch is "Danh sách" / "Theo item" (`?view=items`, DECISIONS 9.8;
  text only, since the rows stay rows): every matching note under each Item it is linked to, one container per group
  whose first row is the heading (the Item's picture flush at its start, its title a link to the Item page, type and
  note count as meta), "Ghi chú rời" (notes without an Item) last.
- **Board** (Dự án, owner 07/11/2026: "như page All task trên ClickUp, có dạng list và board"; Thư viện the same
  day, DECISIONS 9.6; the shared `components/brain/status-board.tsx`, card parts in `work/project-card.tsx` and
  `library/item-parts.tsx`, pure logic in `lib/status-board.ts`, the view in `lib/use-board-view.ts`): one lane per
  status in `lib/labels.ts` order. Each board names its records with its own noun (`BoardKind`: "dự án", "item") in
  every lane and card text below. A lane is a well (`rounded-xl
  bg-well p-2 gap-2 min-h-40`) headed by its `StatusBadge` and count (`text-xs` muted `tabular-nums`), ending in a
  ghost `xs` "+ Thêm dự án" that opens the dialog with that status; empty, it says "Chưa có dự án" quietly. A card is
  a white surface (`rounded-lg border bg-card p-3 gap-2`): title (`text-sm font-medium`, 2 lines, a button that
  opens the record: Dự án's edit dialog, Thư viện's Item page in the Sheet) with the `RowMenu` at its end, the row's meta text (up to 2 lines, so a long client never
  cuts the price), then a footer only when there is something to say (Dự án: the `bw-red` now dot, hours with
  `MiniBillableBar`, "thực tế" rate; Thư viện: the rating, the note count, and on a done Item without its output
  (DECISIONS 4.2) the warning words with one outline `xs` "Viết ghi chú" or "Chấm điểm"; a drop into Xong is never
  blocked). A Thư viện card's meta is the type (only without a type filter), the source ("Sổ tay" for a handbook,
  the host of a link) and the lane's date (xong / bắt đầu / thêm); no tags on cards. The type filter applies to both
  views, the status filter only to the List. Lanes are the one place a card sits in a well (§9a). Moving: native
  HTML5 drag and drop (no library); the dragged card dims to `opacity-50`,
  the lane under the pointer takes `ring-2 ring-inset ring-ring` (counted dragenter/dragleave, no flicker), an empty
  lane shows a dashed "Thả dự án vào đây" box of the same size while a drag runs; drops of files or text from
  elsewhere, and cards of the other board, are ignored. The card menu's "Chuyển sang ..." (one item per other status) is the keyboard and touch
  way, the same code path. A move is optimistic (the card lands on top of its new lane at once), then the server's
  record replaces it; a refused move puts it back where it was and shows one error `Alert` "Không đổi được trạng
  thái: ..." with "Đóng". Every move is read out in a polite live region, never as a visible line that would push
  the board down. From a 56rem board (`@4xl` container query: on a 1024px screen the sidebar takes the rest) the
  lanes are a 4-column grid; narrower, they keep `w-72` and scroll sideways inside the board (`snap-x`), which
  bleeds into the page gutters so the next lane peeks in; the page never scrolls sideways.
- **Toolbar:** one row, `h-8` controls: filters (`ChoiceSelect`/`Select`) left, the primary action right; wraps
  to two rows at 390 px with the primary action keeping the end of the first row or full width, never orphaned.
- **Overlays:** `Dialog` for create/edit forms (fields via `Field`, errors via `fieldErrors()` under the field);
  `Sheet` for reading or editing one record beside the list (the Item page beside Thư viện, below);
  `AlertDialog` (`confirm-delete.tsx`) for every
  delete, never `window.confirm`; `Menu` for overflow; `Tooltip` for icon-only controls; a small `Dialog` for
  the keyboard legend (add `@spaceui/popover` if a non-modal panel is needed).
- **Item page** (owner 07/11/2026: "ấn vào item thì hiện ra các ghi chú của item đó"; DECISIONS 9.8;
  `library/item-detail.tsx`, one component for the right-side `Sheet` beside Thư viện, `max-w-2xl`, and the full page
  `/thu-vien/item/?id=N`, `max-w-3xl` under a "Thư viện" back link like /co-hoi/?id=N). A List row, a row's title, a
  Board card's title, `?item=N` and the Cmd+K item results open the Sheet; the List and the Board stay visible behind
  it, Escape closes it and the focus goes back to the row or card (`recordFocusTarget`). From the top: the picture
  (§9a) and the title (the Sheet's 20px title, the page's 30px h1; without a picture the page shows the Thư viện title
  icon); the properties as AFFiNE shows them, a two-column `dl` (muted `text-xs` labels, values in `text-sm`: status
  badge, type, rating, source, tags, dates; an empty one is left out); one row of `sm` buttons: the List row's next
  step (outline "Bắt đầu"/"Xong"), outline "Sửa" (the existing `ItemDialog`, the one way to edit properties and the
  picture), "Công việc" for a project and, in the Sheet only, a ghost "Mở trang đầy đủ" at the end; the
  done-needs-an-output warning (DECISIONS 4.2); then "Ghi chú" (h2, its count, an outline "Viết ghi chú") and every
  note of the Item, newest first, joined like one page: no card per note, `divide-y` with 20px above and below each,
  a note's own title as a 15px heading (left out when it only repeats the Item's title), the date and the other
  Items it is linked to as meta, a ghost pencil and a `RowMenu` (Mở ở trang Ghi chú, Xóa) at the end, then its
  markdown as reading text (`note-markdown.tsx`, lazy: headings at most 15px, body 14/23 in the foreground colour,
  code and tables scroll inside themselves, task boxes drawn with lucide squares and read out in words, links in the
  link blue, raw HTML shown as text, only local images; a picture from another site is a link). Writing happens in
  place: the composer (title, optional, prefilled with the Item's title; the type's template, `noteTemplates` in
  `done-output.tsx`) opens by default on an Item without notes and from every "Viết ghi chú"; a note's pencil turns it
  into the same form. The form is an `Input` and the autosized textarea of `note-text-editor.tsx` (the part the block
  editor replaces), then the save keys hint, ghost "Hủy" and a filled `sm` "Lưu" (Cmd/Ctrl+Enter saves, Escape
  cancels); an untouched template is not saved. Unsaved text is never dropped silently: Hủy, Escape, closing the
  Sheet and leaving the page by a link ask "Bỏ các thay đổi chưa lưu?" (`discard-changes.tsx`, "Tiếp tục sửa" first),
  a reload asks through the browser. Last comes "Được nhắc tới ở" (h2, `library/item-mentions.tsx`, from
  `GET /api/items/{id}/mentions`): under a muted `text-xs` label per kind ("Cơ hội", "Kỹ năng"), rows in one container
  each, a row's title a link to its page; an opportunity's meta says each evidence row's stance in words (`font-medium`)
  and date, its decision badge at the end; a skill starts with its freshness dot and says the freshness word and the
  evidence dates; with neither, one muted line.
- **Tables** for numeric or time data (Giờ, thị trường): header `text-xs font-medium text-muted-foreground`,
  rows `h-10` with `divide-y`, no vertical cell borders, numbers right-aligned `tabular-nums`. Add the Space UI
  table component from the registry when first needed rather than styling `<table>` by hand.
- **Keyboard hints:** `Kbd` in the search button, in `MenuShortcut`, and in at most the 1-3 main verbs of a
  keyboard-driven list; hidden on touch / below `sm` (`max-sm:hidden` or `pointer-coarse:hidden`). The full
  legend lives behind one "Phím tắt" control, not as a bar of 10 keys.
- **States:** `LoadingCards`/`Skeleton` at the real row or card geometry; `ApiErrorState` (with "Thử lại") when
  nothing loaded, `ApiStaleAlert` when old rows stay; `EmptyPanel` for a list's first run (§9a), `EmptyState` for
  filtered-empty.
- **Sidebar** (`components/app-shell.tsx`, `lib/app-nav.ts`; owner's references, 04/11 and 06/11/2026): a 64px header
  (the `Brain` tile, "Alex's Brain" alone, no tagline (owner), a ghost `icon-sm` "Ẩn menu" button; its border
  continues the top bar's), then three tiers parted by hairlines (`TierLine`: a `border-t` in `--sidebar-border`,
  inset to the icons' edge, so it stays in forced colours): the daily pages (Hôm nay, Tuần) without a label; the areas
  Phát triển, Thư viện, Cơ hội and Công việc, each under a `text-xs` semibold muted uppercase label (`h-7`,
  `tracking-wide`) with more space above a label than between rows; and Khác (Giới thiệu, Hướng dẫn) pushed to the
  bottom (`mt-auto`; on a short screen it scrolls with the rest), muted until hovered or current, without a label (its
  list is named "Khác"). Every row is an icon + title in the text colour in one `<nav aria-label="Menu">`,
  `aria-current` on the current one (darker grey fill, medium weight). A row may end in its count (`text-xs` muted
  `tabular-nums`, 99+, nothing for 0; read out after the title as "Tuần, còn 2 mục tiêu") from `GET /api/counts`: the
  number the page lists with its default filters, except Tuần (open objectives of this week); refreshed on every
  navigation, on tab focus and after every API write. Giờ ends in the `bw-red` "now" dot while a timer runs. The top
  bar's menu trigger shows only while the sidebar is hidden (and on phones). Inbox and search stay in the top bar
  (DECISIONS 9.3).

## 7. Density and empty states

- **Density follows the task:** triage and lists are dense (40-56px rows, 12-14px text); reading and writing
  (notes, journal, review questions) get air (`max-w-2xl`, `leading-relaxed`). Enlarge the focal content before
  adding anatomy. No empty bands mid-page, no rows spread to fill height.
- **Help text is not content.** Page description <= 2 lines; setup and how-to text (bookmarklet, PWA, keys)
  goes behind a disclosure, a help popover or `/huong-dan/`, never above the main list, except the Hôm nay setup
  checklist (§9a), placed under the hero.
- **Empty state:** First-run: the empty panel (§9a). Filtered: "Xóa bộ lọc". Cleared: one line.
- **Filtered empty** ("Không có mục nào khớp bộ lọc") shows a "Xóa bộ lọc" link, no guide, no icon art.

## 8. Motion

- Short and caused by the user: hover/press/colour 150 ms (`transition-colors`), popovers and menus 150-200 ms,
  dialogs and sheets the Base UI defaults (<= 250 ms), ease-out in, ease-in out.
- Nothing animates on page load (no staggered list entrances, no count-ups; the one exception is the guide in a
  first-run panel's slot, §9a). Lists insert and remove without
  shoving: either reserve the space or animate height with the row.
- Infinite animations only for real live state (spinner while saving, running timer dot) and always with
  `motion-reduce:animate-none`; respect `prefers-reduced-motion` everywhere.
- The Stageshow kit never loads on Hôm nay (First Load JS budget 220 kB); guides only via `lazy.tsx`.

## 9. Five ways it fails (with this app's examples)

1. **Too much.** Every action, key and badge on every record. *Inbox card: eight outline buttons, each with a
   `Kbd`, plus delete; five lines of bookmarklet/PWA help above the capture field; a 10-key legend bar.* Fix:
   3 visible verbs, the rest in a Menu; help behind a disclosure.
2. **Wireframe.** Undersized, under-built UI. *10-11px labels, giant dashed empty boxes with one small glyph,
   skeletons that do not match the real rows.* Fix: the type floor, empty states sized to content, skeletons
   at real geometry.
3. **Boxed.** Containers inside containers. *`BrainCard`'s tinted `bg-secondary rounded-2xl` header panel inside
   a bordered `rounded-3xl` card; tinted info boxes inside sections (market "Công cụ mới"); a card per row.*
   Fix: one container per record; hierarchy from weight, colour and spacing.
4. **Flat.** Everything the same weight. *Hôm nay's three equal tiles and no focal block; every block the
   same border and radius; Cơ hội showing two identical blue "Cơ hội mới" buttons; Thư viện's selected tab
   filled blue next to the blue "Thêm item".* Fix: one focal block, one primary, quiet tabs.
5. **Bland / slop.** Could be any AI dashboard. *`Sparkles` as the "AI" or "new" marker (`done-output.tsx`,
   `market-page.tsx`), purple accents, eyebrow caps, the same gray card for every object.* Fix: show the
   object's own content (thumbnail, week number, timer, numbers), say what the AI did in words.

## 9a. Owner 07/11/2026: fuller and warmer

Owner ("hơi trống và trắng"): the page stays white and the sidebar grey; colour may now come from content (the
handbook covers), every area page gets a room of its own (one neutral band, the same for all areas since the owner's
second note the same day), and empty pages show what they will become. Where this section and §2–§7 differ, this section
wins.

- **Header band.** An area page's `PageHeader` sits on a full-bleed `bg-well` band with `border-b`, the same on every
  area (no hue per area, §4). Hôm nay, Inbox, capture, Giới thiệu, Hướng dẫn and personal page have none.
- **Well.** The second container type: `rounded-xl bg-well`, no border, only for secondary, passive regions (Hôm
  nay rail tiles, the right slot of a first-run empty panel, help rails). Never inside a card, and no card inside a
  well, except a board's lanes (§6 "Board"): the lane is the grey ground the white cards are moved across, so the
  cards stay surfaces and the lane stays borderless.
- **Cover** (owner 07/11/2026: retro illustrations "kiểu như Anthropic" instead of the group tint, the book's name
  instead of 1-5 or a monogram, and on Hôm nay "chia hẳn 1 phần là ảnh của sổ tay, một bên là title thay vì div lồng
  div"). A handbook's cover is an original retro illustration, `public/covers/<slug>.svg` (16:7, rules and checklist
  in `components/book-cover.md`), shown only through `BookCover` (`components/book-cover.tsx`) as a plain `<img>`,
  never inline SVG. Like the brand mark's three hues, its palette is a fixed set of hex values inside the SVG files
  (ink, ivory, oat ground, manilla, kraft, clay, book cloth, sky, olive), naming nothing; components use only the
  `--cover-ground` and `--cover-ink` tokens. The cover is a printed object: the same in light and dark. The book's
  name is HTML over the drawing's calm top-left (`coverName()` in `lib/book-marks.ts`: the registry title without
  "Sổ tay N –"; the "Cover name" role in §2), never text in the SVG. Variants: `band` (16:7, full-bleed top of the
  Sổ tay card, with the name), `side` (the Hôm nay hero: a 16:7 band with the name on top below sm, a 14rem column
  from sm, the picture's right part edge to edge, no name, because the text beside it names the book), `thumb` (no
  name: the "Đang học" shelf rows, a 5rem column; the phone Sổ tay card, a 4.5rem column). Every crop keeps the right
  edge, where the subject is drawn. A card that shows a cover is a **split card**: the cover is flush with the card's
  edges, the full height of the card or the full width of its top, clipped only by the card's own radius, and the
  text sits beside or below it; never a tile, a rounded picture or a padded box inside the card. A book with no
  drawing yet shows the ground with its name. No gradients, glows, shadows, purple, sparkles, emoji or text in a
  drawing.
- **Item images** (owner 07/11/2026: "Item có thể thêm ảnh bìa để dễ hình dung", "Dự án có thể thêm logo"; DECISIONS
  9.6). One picture per Item: its own image (uploaded, or the OG image of its link; a small local webp from
  `/api/items/{id}/image`; `ownPicture()`, `lib/item-picture.ts`), else on Thư viện the Sổ tay cover of a handbook
  course (`BookCover`; `itemPicture()`, `lib/handbook-picture.ts`, the only one that ships the registry), else nothing.
  The shape follows the type: a 2:3 **poster** for books and films, a **logo** for projects, a landscape **cover** for
  the rest. Pictures follow the split-card rule above: flush, clipped by the container's radius, no frame, no text or
  scrim, never dimmed by status (`opacity-50` means "being dragged"). Where (`library/item-image.tsx`): a Thư viện row
  gets one flush 56px square track at its start (`RowPicture`), shown only when a listed row has a picture, and then
  the status leaves its badge for the meta line below `md` so the title keeps its room at 390 px; a Công việc row gets
  the track from `md` only (its status is already in the meta line on phones, so the track would only take the
  title's room); a board card shows a cover or a handbook band flush on top (16:7), a poster as a flush 4rem start
  column (2:3 at the card's minimum height), a logo as a 40px square before the title. On the Item page (the Sheet
  and /thu-vien/item/, §6) no container holds the picture, so it stands beside the title as the record's own object
  (`DetailPicture`): a 2:3 poster 4rem wide (5rem from sm), a 16:7 cover 7rem (9rem), the handbook's cover thumb in
  a 4rem (5rem) square, a 48px (56px) logo on its ground, `rounded-md`, no frame or shadow. A logo is the one inset
  picture: `object-contain` on `--logo-ground`, white in both themes and kept under forced colours (a sticker; the logo
  keeps its transparency and most logos are drawn for a light page), `rounded-md` on cards. No picture: the row keeps
  an empty track and the card stays text-only; never a placeholder drawing. Skeletons take the picture geometry the
  page had last time (D27). Pictures are decorative (`alt=""`, `aria-hidden`): the row or card names the record. The
  dialogs' "Ảnh bìa" / "Logo" field (`library/item-image-field.tsx`) is a labelled group: a preview at the card's
  shape, "Tải ảnh lên" / "Đổi ảnh", a "Lấy ảnh từ link" toggle (`aria-pressed`; an http(s) source, never for projects,
  whose OG image is a banner; not offered when saving will fetch it anyway: a new Item or a new link without a
  picture, which the status line says) and ghost "Bỏ ảnh"; the buttons stay put when used and "Bỏ ảnh" hands the focus
  to "Đổi ảnh"; the status line is a polite live region. Every change waits for "Lưu" and "Hủy" drops it, so no
  confirm dialog; a wrong file is refused before any upload, under the field; a big photo is shrunk in the browser
  (1600 px) before the upload. A handbook course has no field, unless it still has a picture of its own to remove.
- **Width.** App content is capped at `max-w-7xl`, left-aligned with the title; bands stay full-bleed. Hôm nay has
  a 320px rail from `xl`.
- **First-run empty panel.** The missing object's glyph (32px, muted ink, no tile), title ("Chưa có <object> nào"),
  one sentence, one primary (with its `Kbd` where the page has a shortcut); optionally up to 6 outline `sm` quick
  actions with a + icon, or one inline form under a one-line caption, built from the owner's own content; beside it
  (vertically centred against it), the area's guide (open until hidden) or up to 3 static ghost rows / one ghost
  chart in the real geometry. The toolbar is hidden until the list has a record or a filter is set; while the list
  loads, the sidebar count decides, one rule for every page (`useToolbarState`, `empty-panel.tsx`). A cleared list
  is one line with no action.
- **The guide in the slot.** The panel's slot is the one place a guide starts open and plays (once, when it comes
  into view; a still poster under reduced motion; "Ẩn hướng dẫn" stops it and is remembered). It is a picture of the
  page in use, so its faux buttons, the blue one included, are not buttons of the view (D2), the slot is a divided
  half of the panel rather than a box inside it (D12), and its one play is the exception to D28. Pages whose empty
  state is not a list's first run keep the closed "Xem hướng dẫn" line under it: Giờ (the timer stays the focal
  object, with or without projects) and Tuần (the plan form is the focal object). The Inbox shows no guide in its
  empty state: its how-to is the bookmarklet box and `/huong-dan/`.
- **Week strip.** 7 cells T2–CN: `chart-data` = a lesson done, `chart-nonbillable` = other activity only, `muted` =
  nothing, dashed = future, `bw-red` ring = today.
- **Setup checklist.** Hôm nay may show one dismissible card under the hero: at most 5 steps, ticked only from real
  data, gone at 5/5.
- **No gamification.** No streaks, flames, XP, badges, confetti or progress rings; a missed day is a muted cell,
  never red. No seeded sample rows.

Shared pieces: `PageHeader` (the band, `components/brain/page-header.tsx`), `components/brain/layout.tsx`
(`PAGE_WIDTH`, `wellClass`, `SectionHeader`), `week-strip.tsx` (`WeekStrip`, `dayLevel`),
`ghost-rows.tsx`, `empty-panel.tsx` (client; never imported on Hôm nay), `EmptyStateGuide variant="flush"`,
`components/book-cover.tsx` (`BookCover`, server and client alike; the drawings in `public/covers/`),
`components/brain/library/item-image.tsx` (`RowPicture`, `boardMedia`; the dialogs' field in `item-image-field.tsx`) and
`components/group-mark.tsx` (`GroupMark`, server and client alike, §4).

## 10. Review checklist (cite by ID; each is checkable on a screenshot)

Take screenshots at 1440 px and 390 px, light and dark, with data and empty.

Hierarchy
- **D1** The eye lands first on the screen's focal object (§1.2), not on chrome, help text or a guide.
- **D2** At most one filled blue button per view region (page toolbar, dialog footer, empty state); none duplicated.
  A guide's faux UI is a picture, not a region (§9a).
  Exception: "Học ngay" on each Sổ tay book card (§6).
- **D3** One page title (30px); sections 18px; nothing else above 18px except one 24px big number (a cover name is
  at most 18px).
- **D4** Page description <= 2 lines on desktop; no setup/how-to text above the main content (the Hôm nay setup
  checklist sits under the hero).

Type
- **D5** No text under 12px (chart ticks 11px and the Inbox count badge excepted); sizes only from §2.
- **D6** Sentence case; no uppercase or letter-spaced labels; no bold 700.
- **D7** Title vs meta reads by weight and colour (foreground/500-600 vs muted/400), not by an extra box.

Spacing and layout
- **D8** Gutters 16px at 390 px and 32px on desktop; all blocks share the title row's left edge (the title icon when
  there is one).
- **D9** Title-to-meta gap is smaller than record-to-record gap; rows are 32/40/56px, no fat rows.
- **D10** Words sit >= 12px from container edges; no edges 1-3px apart; no element touching another.
- **D11** At 390 px: no horizontal scroll, no clipped label, no orphaned button on its own line.
- **D30** Content is capped at `max-w-7xl` and left-aligned; no single column stretched across ultra-wide screens.

Containers
- **D12** No bordered or tinted box inside another box (inputs and code excepted; a handbook cover or an Item image is
  not a box in the card but a flush part of it, D32; a project logo on its white ground is the one inset picture,
  §9a "Item images"); no card in a well, no well in a card (the first-run panel's slot, a full-bleed half parted by the
  panel's own divider, and the cards in a board's lanes excepted, §6 "Board", §9a).
- **D13** A homogeneous list of more than ~5 records is rows in one container, not a stack of cards (a board view's
  lanes excepted; its list view keeps the rows).
- **D14** Radii from §3 (`xl` containers, `lg` controls, `md` fills, `sm` badges); nested radii concentric.
- **D15** A container is a surface (border + `bg-card`) or, for secondary content only, a well (`bg-well`, no
  border); inside it, a fill or a divider. A board lane is a well holding card surfaces (§6 "Board").

Colour
- **D16** Only token colours (the hex palette inside the brand mark and the cover SVGs, and the ivory/manilla light
  tone inside the group marks, excepted, §4, §9a); status colours match `lib/labels.ts`, the same status the same colour everywhere;
  no colour per area (title icons, bands, Hôm nay tile icons and empty glyphs are neutral); a group colour only
  as the fill of its group mark or a progress indicator (never a dot, never the cover); no coloured body text;
  data colours (`--chart-*`, statuses, progress) never greyed out, every chart in the data blue, never in an area
  or group hue.
- **D17** No purple, gradient, glow, coloured shadow or gradient text; `bw-red` only on the continue/now marker; no
  area or group hue that reads as the primary blue, `bw-red`, destructive red or a status colour.
- **D18** AI results carry a plain "tự động" label or prefix; no sparkle, wand, bot or star as an AI marker.
- **D19** Light and dark both read: muted text legible, no hard-coded white/black surfaces, focus ring visible. The
  printed objects are the documented exceptions, the same in both themes: the handbook covers (`--cover-ground`) and
  the project logos' ground (`--logo-ground`, §9a "Item images").
- **D29** Surfaces and contrast (§4, §9a): white page; white bordered surfaces; borderless grey wells for secondary
  regions; one neutral band (the well) behind area headers; grey sidebar with a darker current row (light) / darkest page and
  sidebar, lighter surfaces (dark); border visible; blue only on the primary action, links, focus, chart marks and a
  board's drop target;
  focus ring >= 3:1 on page, sidebar, surfaces, wells and bands; no container left transparent on the page.

Icons
- **D20** lucide only (the brand mark excepted: 28px in the sidebar header, no tile; the group marks excepted: 18px
  on the Sổ tay jump row, 20px before a group's section title, 16px in the Hôm nay hero's rows, no tile, ink in
  `currentColor`, §4; covers are images, not icons), one stroke width, 16px in
  controls/rows/nav, 14px in badges/meta, 28px for the title icon and 32px for the empty-panel glyph (both with a 1.5px absolute
  line); no emoji as icons.
- **D21** No decorative icon beside headings or card titles (an area page's title icon, the icon of a Hôm nay
  tile heading and the group mark before a Sổ tay group's section title excepted, §5); no nav icon as an empty state glyph; icon-only buttons have a
  tooltip; icons in tabs only on a view switch that changes the layout (List / Board, §5).

Components
- **D22** Row actions: <= 3 visible, the rest in a Menu; delete goes through the confirm dialog.
- **D23** View switches are `Tabs`, not filled buttons; filters left, primary action right in one toolbar.
- **D24** `Kbd` hints hidden on touch / 390 px and limited to the main verbs; full legend behind one control.
- **D25** Badges: <= 3 per record, one tag style app-wide, never used as buttons or tabs.

States and motion
- **D26** First-run empty = the §9a panel (one primary, ≤ 6 quick actions or one inline form, a guide or ≤ 3 ghost
  rows beside it, toolbar hidden); cleared = one line; filtered = "Xóa bộ lọc".
- **D27** Loading skeleton matches the real geometry; errors use `ApiErrorState` / `ApiStaleAlert` with "Thử lại".
- **D28** Nothing animates on load (the first-run panel's guide excepted: it plays once in view, §9a); transitions
  <= 200 ms (overlays <= 250 ms); every looping animation stops under reduced motion.
- **D31** Week strip and checklist follow §9a; no streaks, XP, badges, rings or confetti; missed days are muted.

Covers
- **D32** A handbook shows its illustrated cover only through `BookCover` (§9a): the name in HTML in `--cover-ink`, no
  text in the drawing, the same in both themes; a card or row with a cover is split, the cover flush with its edges
  (Sổ tay card band and phone column, Hôm nay hero column, "Đang học" rows), never a tile inside it; no group tint
  or monogram on a cover; every drawing passes the `components/book-cover.md` checklist.
