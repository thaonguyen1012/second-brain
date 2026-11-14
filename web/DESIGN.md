# DESIGN.md: rubric for the real app UI

Binding for every page in the app shell (`app/[lang]/(home)/*`, `components/brain/*`, `components/app-shell.tsx`, dialogs,
Cmd+K). Not for Stageshow guides and intro pictures (they follow `.claude/skills/stageshow/`) or lesson prose
(Fumadocs, `#nd-page .prose`). Target: a screen that could sit next to Linear, Raycast or Notion and not look
generated. Space UI (`components/ui`, `components/spaceui`, tokens in `app/global.css`) is the source of truth; a
missing component is added with `npx shadcn@latest add @spaceui/<name>`, never hand-written. Reviews cite rules
by ID (D1...D34, last section).

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
  the cards are the thing moved, and in Công cụ's grid (§6 "View switches"), whose records each carry a logo or icon
  and a summary; the same records keep their rows in the list view beside it.
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
  still groups the rows. Pages outside the six areas (Inbox, capture, Giới thiệu, Hướng dẫn) get no title
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
    and would vanish on an accent-filled card. The cursor (that border, a Ghi chú row's `bg-accent`) and its
    `aria-current="true"` show only while single-key shortcuts are on (round 3 follow-ups, WCAG 4.1.2): off, no key
    moves it, and "current" would be announced for nothing. The page asks `useSingleKeyShortcuts()` once and hands it
    to its rows; the cursor keeps its place meanwhile (it still scrolls its row into view and follows a click), so
    turning the switch on, here, in another tab or from Cmd+K, shows it there again. One exception: the Inbox entry a
    Cmd+K link opened (`?status=&id=`) keeps the mark while the switch is off (`InboxPage`'s `linkedId`), since
    nothing else says which card the link meant; any move of the cursor (a click on a card, a tab, a capture, J/K)
    ends it and a new link replaces it (Ghi chú's `?id=` opens the note page instead). With the switch on, Del
    deletes the cursor's row, but the focus after a delete never comes from the cursor: it comes from the trigger, on a
    cursor row the control `focusShortcutOpener` focused first (§6 "Focus after a delete"). In forced colours the
    cursor and the linked mark bring their own outline ("Forced colours" below).
  - Stageshow wells (guides, /gioi-thieu/ tiles) keep their `secondary` ground (`--card` in dark) and add the 1px
    `--border`; a guide in an empty panel's slot (`variant="flush"`) has neither: the slot's `bg-well` is its ground.
    Text in a guide or intro picture is text in a picture (accessibility pass 13/11/2026): 4.5:1 in every frame that
    holds still, light and dark, also where the app draws it lighter (a placeholder, a primary not enabled yet, a key
    chip in a filled button, the light filled destructive, a fading tile); the `--ss-*` mapping in `brain-look.ts`
    and the rule in `components/stageshow/README.md`.
  - Blue stays the accent for the primary action, links and focus (plus the data blue of chart marks and a board's
    drop target, which takes the focus ring: like focus, it says where the action lands); surfaces
    never get a blue tint, and area tints appear only as the header band and as marks (§9a); cards and list
    containers stay white. Wells are `bg-well`.
  - Focus ring (`--ring`) opaque, >= 3:1 against the page, the sidebar and every surface (WCAG 1.4.11): light
    `#3582ff` is 3.6:1 on white and 3.3:1 on the grey sidebar; dark `#6aa5ff` 7:1 or more. Never lower it with
    `/50` or alpha. A row a popup highlights takes it too (round 3 checks, WCAG 1.4.11; `app/global.css`), since its
    `--accent` fill is 1.18:1 on the popover in light and 1.12:1 in dark, where a move seemed to change nothing: a
    menu's or a Select's highlighted row while the keyboard moves it (`[data-highlighted]:focus-visible`; a popup the
    pointer opened and walks keeps the fill alone, as before), and the active option of a list driven from a field
    (`[role=option][aria-selected=true]` without `data-slot`: Cmd+K, the `[[` and `/` menus, the Item picker) at all
    times, as the row Enter picks; 2px inside the edge, 3.1:1 on the fill in light.
    Form controls use it too: a focused Input, Textarea or Select gets `border-ring` + a 1px `ring-ring` in light
    (Space UI's default `foreground/10` halo was 1.2:1); dark keeps Space UI's `foreground/70` border. A focused
    invalid one (§6 "Form errors") keeps Space UI's destructive border in light, with the 1px ring outside it in
    `--ring` (`app/global.css`; Space UI's destructive/20 ring there showed no focus).
    Scroll areas (accessibility pass 13/11/2026, round 3, WCAG 2.4.7): a box that scrolls is a tab stop, Base UI's
    `ScrollArea` viewport while it overflows (DialogPanel, SheetPanel, the sidebar) and in Chrome any scroller with no
    control in it (Cmd+K's results, a note's wide code block or table, a lesson table); keep it, the keyboard scrolls
    with it. Its ring is the 2px `--ring` as an outline (forced colours keep outlines, drop box-shadows): inside
    the edge (`-outline-offset-2`) where an outside ring would be cut, for a ScrollArea from its root's `::after` in
    `app/global.css` (square corners; from sm the popup's inner corner, `--radius-2xl` − 4px, where the panel's edge is
    the popup's own); outside the edge where nothing cuts it and the content touches the edge (Cơ hội's "Xem dạng
    bảng", where an inset ring covered the first letters). A tab stop inside a scroller (the topic heatmap) keeps its
    outside ring: the scroller makes room with `-m-1 p-1`, the grid and its cells take `scroll-m-1`, and the arrows
    scroll the cursor's cell into view. A list driven from a field through `aria-activedescendant` (the `[[` picker) is
    never a tab stop (`tabIndex={-1}`). `components/mdx.tsx` copies Fumadocs' table wrapper to add the ring
    (`lib/registry-copies.test.ts` keeps the copy in step). A control the focus scrolls into view stops clear of the
    edge (round 3 checks, WCAG 2.4.11): Chrome left it flush with the bottom, its ring's bottom off the screen or in a
    scroll fade. The page keeps `scroll-padding-bottom: 0.5rem` (and `scroll-padding-top` under the top bar), a
    ScrollArea viewport `scroll-padding-block: 1.5rem` (its fade), the lesson sidebar's list 1rem (its 12px fade).
  - Forced colours (Windows contrast themes; round 3 follow-ups, WCAG 2.4.7): Chrome drops box-shadows there, so
    every `ring-*` goes, and keeps outlines. One `@media (forced-colors: active)` block in `app/global.css` gives an
    element that strips its outline (`outline-none`, `outline-hidden`, `focus-visible:outline-none`, `.note-editor`) a
    2px `Highlight` outline on `:focus-visible` at the offset it already has: outside (0, Chrome's 1px for a link, 2px
    where `focus-visible:outline-hidden` sets it, as in Space UI's Button), inside the edge where its class holds
    `ring-inset`, on the `::after` where it holds `after:ring` (`coverLinkFocus`, stretched card links).
    `tabindex="-1"` targets and the ScrollArea viewport stay bare (its root's `::after` draws its ring); Tailwind's
    `outline-hidden`, which shows there at all times (sidebar rows, group labels), is kept on the focused element only;
    the active option of an `aria-activedescendant` list (`[role=option][aria-selected=true]` without `data-slot`:
    Cmd+K, the `[[` and `/` menus, the Item picker) is outlined inside its edge; outlines the browser or the app draw
    are left alone. The block knows a hand-drawn ring by its class names, so keep them: drop the outline only with
    `outline-none`, `outline-hidden` or `focus-visible:outline-none` (never `focus:outline-none`, `outline-0` or a CSS
    `outline: none`), draw an inside ring with `ring-inset` and a stretched link's with `after:ring-*`, or the control
    shows no focus in a contrast theme; prefer an outline for new focus styles. Forced colours back text with a plate,
    and a flex item or inline-block paints its outline before what follows it, so an outline reaching into the next
    line is cut by that line's text: a control with text 2px under it keeps the outline on its edge (Ghi chú's "Theo
    item" heading links take `forced-colors:outline-offset-0`, its row titles go without `outline-hidden`). A
    Textarea whose control scrolls (`overflow` on its wrapper: the job ad's text) takes it inside its edge, or the
    wrapper cuts it on all four sides (round 3 checks). A mark that shows a position, not the focus, brings its own
    `forced-colors:outline-2 forced-colors:outline-offset-1 forced-colors:outline-[Highlight]`, since a fill or a
    border colour is gone there (every border turns CanvasText): the topic heatmap's cursor cell, like the week
    strip's today, and the Inbox card under the J/K cursor or marked by a Cmd+K link (`BrainCard`'s `data-selected`);
    inside the edge where its list clips (`-outline-offset-2`: Ghi chú's cursor row). A current tab, whose indicator
    is a fill or a filled bar, has its label underlined there, 2px (`[data-slot='tabs-tab'][data-active]` in the
    block, Thư viện's current link in `library-tabs.tsx`), never like the focus's Highlight outline (round 3 checks,
    WCAG 1.4.11, 4.1.2). The topic heatmap keeps its data there (round 3 open items, WCAG 1.4.11): its cells with
    data and the legend's five swatches take `forced-color-adjust-none`, and the heatmap sets
    `forced-colors:[--background:Canvas]`, so `fill()` mixes the data blue with the system ground instead of the
    card's. Fewer stays fainter on a light and on a dark contrast theme, whatever the app's own theme: a full cell is
    4.4:1 on white and 5.8:1 on black; the lightest bin is about 1.1:1 on black, and the caption and the table view
    keep the numbers. Empty cells and the "không có" swatch take the ground. The cursor cell adds
    `forced-colors:ring-0` to its Highlight outline, since a cell with data keeps box-shadows, as on the week strip's
    today. The labels keep system colours. Test with Playwright's `page.emulateMedia({ forcedColors: 'active' })`
    (with `colorScheme: 'dark'` for the black palette).
  - Links in a truncating line (WCAG 2.4.7, 2.4.11): a box that truncates (`overflow: hidden`) clips the ring or
    outline of a link inside it. A link that is the line's only content (Ghi chú's "Theo item" group heading) is itself
    the box that truncates: `inline-block max-w-full align-top`, its text in a `block truncate` span (the span clips,
    so the hover underline keeps its square ends), and its ring goes round what shows, the ellipsis too. A line where
    links share the text (a note's meta line: Item links, commas, the date) takes `has-focus-visible:-m-1
    has-focus-visible:p-1`, 4px of room inside its clip while a link has keyboard focus, taken back by the negative
    margin (the heatmap scroller's `-m-1 p-1`; only while focused, so rest and hover stay as they were). A link that
    line's ellipsis cuts still ran past the clip (Chrome keeps an inline box's full width past the ellipsis), so on
    `:focus-visible` `fitToLine` (`library/notes-page.tsx`) measures it and, if it runs past the line's content box,
    makes it its own truncating box while it keeps that focus (`data-fit`: `inline-block max-w-(--fit) truncate
    align-top`, `--fit` = the room left on its line; the line gets `has-data-fit:text-clip`): its own ellipsis stands
    where the line's was and the ring closes at the line's end. A link with under 48px left (`FIT_MIN`), or one hidden
    after a long first link, first comes to the line's start (the line scrolls sideways). Blur removes `data-fit` and
    `--fit` and resets the line's `scrollLeft`. Measured, not plain CSS: an inline-block at rest would move the line's
    ellipsis, and a link's room depends on what goes before it. A change of the line's width while the link keeps the
    focus (a phone turned, a zoom, the sidebar) fits it again (round 3 checks: a `ResizeObserver` on the line; the old
    room ran the link and its ring up to 416px past the line). A control that truncates itself (a row's title button)
    needs none of this: its own overflow does not clip its own ring. Left as it was: the meta line's `hover:underline`
    never shows (the 16px line clips it); only the colour changes.
  - Lesson pages (Fumadocs; WCAG 2.4.7): the page-tree links of the sidebar (`#nd-sidebar`, the 390 px drawer
    `#nd-sidebar-mobile`) and the TOC's (`#nd-toc`, its popover `[data-toc-popover]` below xl), `a[data-active]`, take
    the 2px `--ring` outline inside their edge on `:focus-visible` (`outline-offset: -2px`), since the TOC's
    `overflow-x-clip` scroller and a folder's collapsible cut an outside one on both sides; the popover's trigger
    (`[data-toc-popover-trigger]`), which Fumadocs gave no focus style, takes the same. The sidebar's list, Fumadocs'
    Base UI ScrollArea (`[data-id$='-viewport']`, a tab stop while it scrolls), is ringed like the app's: its outline
    off, its root's `::after` draws the ring at `outline-offset: -3px` (the list hangs 1px past the layout's start
    edge), above the content and the fade mask. The nav title link and Fumadocs' buttons keep their own focus.
    Unfocused nothing changes, and a click or tap draws no ring. Fumadocs' copy-link button after a heading
    (`[class~='group/heading'] > button`), shown under the pointer only, shows while it has the keyboard focus (round
    3 checks; it was a hidden stop every second Tab; on touch it stays hidden as Fumadocs draws it, open: §6 asks
    hover-revealed actions to show on touch). Its overlays below md and xl, the TOC popover and the sidebar
    drawer, are not modal: each closes as the focus moves on to the page behind it (not to the button that opens the
    drawer), and Escape inside one closes it and focuses its button (`useOverlaysCloseOnFocusOut`,
    `lazy-docs-layout.tsx`, through Fumadocs' own trigger and backdrop; `lib/lesson-landmarks.test.ts` follows that
    markup); the next stops were the links they cover (WCAG 2.4.11). The page behind is Fumadocs' layout root
    `#nd-docs-layout`, which holds the top bar, the sidebar or drawer, the popover and the lesson at every width. A
    popup, menu or dialog in a portal outside it leaves the overlay open, and the overlay gets the focus back when it
    closes (round 3 final checks): the drawer's language chooser and handbook switcher, Base UI popovers that take the
    focus as they open (closing the drawer took them with it: below md, where the drawer holds the lesson's only
    language control, no language or handbook could be picked), and Cmd+K opened inside an overlay (Escape left the
    focus on `<body>`). A Cmd+K pick of a heading of the lesson shown (only the hash changes: Fumadocs closes the
    drawer on a new path only, and the page stays) hands the focus to that heading's link instead (Base UI's
    `finalFocus`, `search-dialog.tsx`; round 3 repair: the overlay stayed open over the heading just jumped to and
    got the focus back), clear of the sticky bars by its scroll margin, and the overlay closes as the focus reaches
    the page; a pick of another page closes the drawer with the path, and the dialog gives no `finalFocus` then (given
    at all, Base UI moves the focus on closing even after it moved on: out of the Item Sheet a result opened). A pick
    of the lesson's own row, the URL unchanged, changes nothing and gives the focus back where it was. Below xl the
    TOC bar (40px) and below md the top bar (56px) stay at the top: a lesson's focusable elements keep them and 0.5rem
    clear (`scroll-margin-top` 3rem, 6.5rem below md; on the elements, so a TOC link's jump to a heading lands where it
    did). Open (round 3 open items, WCAG 2.5.3, low): Fumadocs names the TOC popover's trigger from its content, the
    ProgressCircle's value first, then both labels (`0.235294 1.1. Week 1: … 🔑 Khái niệm cốt lõi · Key concepts`
    while it shows the heading). Its `trigger` props are static and its slot is the whole popover, so only a fork
    would fix it.
  - Lesson pages, landmarks and names (lessons pass 14/11/2026; WCAG 1.3.1, 2.4.1, 4.1.2;
    `app/[lang]/docs/[[...slug]]/page.tsx`): a lesson has the banner only on phones (Fumadocs' top bar `#nd-subnav`,
    below md), the one main, the sidebar aside, nav "Breadcrumb" and the table of contents as a navigation named like
    its heading, "Trên trang này" / "On this page". Beside the lesson (from xl) Fumadocs' `div#nd-toc` takes
    `role="navigation"` and `aria-labelledby="toc-title"` through DocsPage's `tableOfContent.container`; below xl the
    popover's box (Base UI's Collapsible root) is drawn as a `<nav>` with `aria-label` `t('Trên trang này')` through
    `tableOfContentPopover.container` (`render: <nav />`), so the `<header>` Fumadocs draws inside it is no second
    banner beside the phone top bar and no banner at 1024 px. Not `role="navigation"` there: axe scopes a `<header>`
    by native sectioning elements only and reports it as a banner nested in a landmark. One of the two shows at a time,
    so they share the name. `lib/lesson-landmarks.test.ts` fails if Fumadocs stops spreading these props or renames
    `toc-title`.
  - Lesson code blocks: Fumadocs makes a code block's scrolling viewport a `role="region"` tab stop; each is named by
    its place in the lesson, "Khối mã {n}" / "Code block {n}" (`lib/mdx/rehype-code-labels.ts` numbers the `<pre>`s
    after Shiki, in the page's UI language like the placeholders' words; `components/mdx.tsx` copies fumadocs-ui/mdx's
    `pre` to pass the name as CodeBlock's `viewportProps`; `lib/registry-copies.test.ts` follows the original).
    Unnamed, Chrome read the whole code as the focused element's name. Named, every block is a landmark (233 on
    kho-code), the price of Fumadocs' fixed role; the name sits in the lesson's `lang="vi"` like Fumadocs' "Copy Text".
    Table wrappers stay unnamed tab stops (open).
  - Picture placeholders (`lib/mdx/rehype-safe-html.ts`): only the alt line is `role="img"`, named by the alt
    (`lang="vi"`) or "Hình minh họa"; the note and its Coursera link follow it as text, since what is inside an img is
    not read and a link there cannot be reached by a screen reader.
  - Text stays AA on page, sidebar, surface and fill: `muted-foreground` is >= 5.6:1 on every one of them but the
    dark segmented indicator (`--input` over `--muted`, #3e3e3e, the one ground lighter than every surface), where it
    is 4.07:1: muted text there (a tab's count) takes `foreground/70` (6.2:1; §6 "View switches").
  - Lesson colours (lessons pass 14/11/2026, WCAG 1.4.3): where the primary misses 4.5:1 a lesson takes
    `--primary-hover` (the primary 10% darker, `#195bc3`) in light: the sidebar's current page (`#nd-sidebar`,
    `#nd-sidebar-mobile` `a[data-active=true]`, on Fumadocs' 10% primary tint: 5.5:1, was 4.36) and a picture
    placeholder's Coursera link (on the muted fill: 5.3:1, was 4.24). Dark keeps the primary (6.4:1, 6.6:1). Mermaid
    diagrams in dark set `themeVariables.edgeLabelBackground` `#4b4b4b` (edge labels `#ccc` 5.4:1; mermaid's `#585858`
    was 4.43). Code colours are Shiki's github-light / github-dark (Fumadocs' default): light `#e36209` (variables,
    keyword arguments; 3.49:1, 1.5% of code characters) and dark `#6a737d` (comments; 3.83:1, 11.6%) miss 4.5:1 on the
    code block's card; they stay, the owner's choice (14/11/2026, DECISIONS 9.11) over replacing those two colours with
    Shiki `colorReplacements` `#bc4c00` / `#8b949e`, GitHub's `-default` themes or the `-high-contrast` ones.
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
  one layout (Inbox, Tuần) stay text only, and so does Thư viện's Item / Ghi chú switch (a nav drawn like them, §6
  "View switches"). **No icon beside headings, card titles or section titles**,
  except: the title icon of an area page (`PageHeader nav`: the icon of the page's own sidebar row, ink colour, no
  tile, centred on the title's first line, `aria-hidden`; server-rendered, except on /co-hoi/ where the client list
  and detail views render the header) and the heading of a Hôm nay tile, which starts with the icon of where its link
  leads (that row's icon from `lib/app-nav.ts`, or the Inbox glyph), 16px in `muted-foreground`, and the section
  title of a Sổ tay group on the Sổ tay page, which starts with that group's mark (20px, §4), and the section title of
  a stage on Công cụ, which starts with that stage's lucide icon (owner 13/11/2026: "mỗi nhóm bạn làm 1 cái icon tương
  ứng để dễ hình dung"; `lib/tool-icons.ts`, defined once beside the stage list; 20px, ink, the title icon's 1.5 line,
  no tile, no colour per stage; the AI & LLM stage's `Bot` names a kind of tool, not an AI result, so D18 still holds).
  The same icon stands in for a tool's missing logo (§9a "Item images"). An empty state's
  glyph names the missing object (BookPlus, FlaskConical, FolderPlus...), never a nav icon, so it does not repeat the
  title icon. Nothing else.
- **No emoji as icons** (emoji are user content only). Icon-only buttons have `aria-label` and a `Tooltip`. Base UI
  tooltips are for the eye only: a definition that matters also reaches screen readers as the trigger's description
  (`aria-describedby` on a `hidden` copy of the same text; accessibility pass 13/11/2026).

## 6. Components (which one for what)

- **Buttons** (`components/ui/button`): `default` (filled blue) = the one primary action per view region (page
  toolbar, dialog footer, empty state). One exception: "Học ngay" on every Sổ tay book card is filled (owner,
  03/11/2026, knowing it puts one blue button per book on that page); its "Liên kết" stays ghost. `outline` = secondary
  actions, at most 2-3 visible together; `ghost` =
  toolbar, row and icon actions; `link` = inline navigation, blue (`text-primary`, set once in the variant;
  a deliberately quiet jump-link row may override it with `text-muted-foreground`); `destructive-outline`/`DeleteButton` = delete
  entry point; filled `destructive` only as the confirm button inside `confirm-delete.tsx`. Sizes: `default` in
  page toolbars, `sm` in cards and dialogs, `xs` / `icon-sm` in rows. Label = verb + object (Vietnamese; the
  English through `t()`, `lib/i18n/README.md`). Accessibility pass 13/11/2026: a `link` inside or right under
  running text (a sentence, a hint line, a guide's paragraph) is also underlined at rest (`underline`, with the
  variant's `underline-offset-4`), since its blue is 1.5:1 against muted text (1.05:1 dark) and colour alone does
  not mark it (WCAG 1.4.1); a link action standing on its own keeps the hover underline (a section header's
  `… →`, "Trả lời 6 câu" alone in its bar, "Chọn ưu tiên tuần tới" beside a button). A button that waits for the
  server is never natively disabled (`confirm-delete.tsx`'s Hủy and Xóa while the DELETE runs, "Đưa vào Inbox"):
  `aria-disabled` with the disabled look (`aria-disabled:pointer-events-none aria-disabled:opacity-64`) and a
  handler that ignores presses, since a disabled button drops the focus to `<body>`, where it stays after a failure.
- **Row actions:** at most 3 visible (primary verb first); the rest go in a `Menu` behind a ghost `icon-sm`
  `MoreHorizontal` with `MenuShortcut` for keys. Hover-revealed actions must also show on focus and on touch. A row's
  or card's `RowMenu` is named after its record (`Thao tác cho "{title}"`), never a bare "Thao tác khác" repeated
  down the list. So is every other control a list, a card or an open editor repeats (WCAG 2.4.6, 2.5.3;
  accessibility pass 13/11/2026): the name starts with all the control shows, its words and a key hint drawn in it
  (`Đọc sau, L: "{title}"`, `Bắt đầu, T: bấm giờ cho "{title}"`; axe reads the drawn letter, so `aria-hidden` on the
  `Kbd` does not help; a real space before the `Kbd`; with single-key shortcuts off the hint and its letter go,
  `Đọc sau "{title}"`, in English the words, a colon and the record, `Read later: "{title}"`, `Note: "{title}"`), or
  for an icon-only control its tooltip's words unbroken
  (`Mở {site} (tab mới): "{title}"`), then the record (`Chấm "{title}"`, `Xong ghi chú “{title}”`, `Hữu ích:
  {title}`). Where records share a title it adds what the row shows that tells them apart: a time entry's day and
  duration (`Sửa giờ của {title} ngày {day} (45 phút)`, "(đang chạy)" for the running one), the date line of a note
  that only repeats its Item's title, a kept new note's own title, else its Item's, else "Ghi chú mới". Shared parts
  take the record as an optional `name` (`RecoveredDraft`, `SaveStatus`, `UnsavedCopyHint`, `FrameControl`); an
  Item's step keeps it beside its label (`itemNextStep().name`). Any name set over visible text holds that text in
  reading order, the visible words first and the context after; a comma is fine, since axe and speech input drop
  punctuation ("EN, Switch to English", "Inbox, 5 mục chưa xử lý", `Xem mục giờ của {title} trong tuần này`; round 3,
  WCAG 2.5.3). So does a Fumadocs control's: the lesson sidebar's language chooser shows the page's language and is
  `Tiếng Việt, chọn ngôn ngữ` / `English, choose a language`, set in both languages by `app/[lang]/layout.tsx` as its
  `'Choose a language(language switcher)(aria-label)'` (English pages get a Fumadocs dictionary of that key alone; the
  popover's heading stays "Chọn ngôn ngữ"). A name or a line whose subject is a view state (the week, a filter) says
  that state, never a fixed "this" (WCAG 2.4.6): Giờ's week summary says `tuần này` only for the current week
  (`data.weekStart === mondayOf(todayPrague())`, Prague as the server counts it) and the heading's dates for any other,
  in its "Xem mục" names (`Xem mục giờ của {title} trong tuần {range}`) and its empty line (`Chưa có giờ nào trong tuần
  {range}.`). So does Tuần's review (round 3 open items and checks): the time chart's empty line
  (`tuan/time-chart.tsx`, `start === mondayOf(todayPrague())`): `Chưa có giờ nào tuần này` / `No time logged this
  week`, else `Chưa có giờ nào trong tuần {range}` with the heading's dates in one `whitespace-nowrap` span (at 390 px
  the line broke after the en dash), and the empty objectives line, `Không có mục tiêu nào cho {week}.` with the plan
  tab's week name, built once in `week-page.tsx` ("tuần này", "tuần tới", "tuần {range}"), its dates in one
  `whitespace-nowrap` span too (`weekNameInLine`, the name as a node for a line of text; round 3 final checks: at
  320-360 px the line broke after the en dash). The ritual's own words (the six questions, "Có ghi chú mới tuần
  này?", "Có thêm bằng chứng tuần này") speak of the week under review and stay (DECISIONS 9.2). Where two spans show
  separate words (a title and its count, a label and a badge or `Kbd`), the DOM keeps a real space between them
  (`{' '}`; a flex box does not draw it): axe and speech input read "Item" + "13" as "Item13", which no name holds.
- **Notices and loading** (accessibility pass 13/11/2026, the `fixing-accessibility` skill in
  `.claude/skills/`): a page's notice line is one `<p role="status">` that stays mounted, `empty:sr-only` while it
  is empty (out of the flow, so nothing moves), so the first notice of a visit is read out too; a loading
  placeholder named "Đang tải" carries `role="status"` (a name on a plain div is never read); a form field's hint has
  an id the field names in `aria-describedby`.
- **Form errors** (accessibility pass 13/11/2026; `components/brain/invalid-fields.tsx`): a failed save keeps its one
  `role="alert"` summary under the fields, naming each field as its label does (`fieldErrors()` with the form's
  names, never the API key; on a tool "Dùng để làm gì" and "Tag khác"). Each field the failure is about gets
  `aria-invalid` and its own message as its description, a `hidden` copy named in `aria-describedby` after the
  field's hint: `useInvalidFields()`, with `mark()` for a check in the browser, `fromError()` for a DRF 400
  (`errorsByField()`), `field(key, hintId)` on the control and `copies` rendered once in the form. A save asked for
  (submit, Cmd/Ctrl+Enter, the save button) moves the focus to the first such field in page order (in a radio group,
  its tab-stop radio); a save on blur never moves it. A message about two fields marks only the empty ones. Required
  fields carry `aria-required` (native `required` only where a form already relies on native validation) and no
  visible marker; optional labels keep their "(không bắt buộc)". On screen only the control changes: Space UI's
  destructive border (light only; dark shows none) and, focused, the app's ring outside it (§4). A radio group takes
  `aria-invalid` on the radiogroup and each radio names the message too, since the focus lands on a radio; a
  `role="group"` of chips takes no state (the summary names it); a button that picks a file ("Tải ảnh lên") takes the
  message as its description only. A form whose fields save one by one (Tuần's six review answers) keeps a refused
  field marked, with the alert, until it is sent again or put back as saved (`fromError(…, { keep })`,
  `clear(...keys)`); a save asked for while a save on blur runs waits with its focus request, and its save button
  keeps the focus in the field on press (`onMouseDown` preventDefault), or the blur save would disable it first.
- **Focus after a delete** (accessibility pass 13/11/2026, WCAG 2.4.3; `confirm-delete.tsx`): after a confirmed
  delete the focus goes to the deleted row's neighbour, never to `<body>`: the first control of the next row, else of
  the previous one, else the heading of the list's section (a board lane, a panel; given `tabindex="-1"`), else the
  page's h1; back to the control the dialog came from when its row stays (Del on a cursor row). The row is found
  from the trigger, or for a controlled dialog from what held the focus as it opened (a `RowMenu` item stands for
  that menu's trigger, `lastRowMenuTrigger()`). A list split into groups that go with their last row (Giờ's days,
  Ghi chú "Theo item", Công cụ's stages) marks their container `data-row-groups`. A dialog or Sheet that deletes its
  own record (ItemDialog, the Item Sheet) calls `focusCandidates(row)` before the row goes and returns
  `focusTarget(...)` from its `finalFocus`; a deleted row leaves the list at once (mutate, then reload). A page that
  places the focus itself (Tuần's objectives, the Item page's notes) is left alone; Cancel and Escape return it to
  the trigger. A row that leaves its list another way while it holds the focus goes the same way (round 3 checks): an
  Inbox card triaged with its own "Đọc sau", "Lưu trữ" or "Về inbox" (or a key pressed on one of its controls) hands
  the focus to `focusCandidates(card)` as it goes (`flushSync`, then the focus); a picker whose pick takes away the
  card that opened it (the Inbox's opportunity picker, which archives the entry) gives it to that card's neighbour
  from its `finalFocus`.
- **Focus into and out of a dialog** (accessibility pass 13/11/2026, round 3, WCAG 2.4.3): a Dialog, AlertDialog or
  Sheet opens on its first field through Base UI's `initialFocus`, a ref the form puts on that field (the Item
  dialog's rating with `focusRating`, a time entry's note when editing). Never React's `autoFocus` inside one: the
  field focuses itself before Base UI notes what held the focus, and Escape, Hủy and ✕ then dropped it on `<body>`.
  Closing gives the focus back to the opener (a `RowMenu` item stands for that menu's trigger; the Item Sheet's
  "Sửa"); a page's `finalFocus` that names the record's row (Thư viện, Công cụ, Dự án) still wins. An inline form
  that takes its opener's place (the skill sheet's evidence form, from "Thêm bằng chứng" or a row menu's "Sửa")
  focuses that control again as Escape, Hủy or a save closes it, in the same commit, or the Sheet takes the focus. A
  single key that opens a dialog first calls `focusShortcutOpener(key, scope?, fallback?)` (`lib/shortcut-opener.ts`):
  when nothing holds the focus (a page load, J/K on a cursor list), the control showing that key (its `Kbd` or
  `aria-keyshortcuts`; in the cursor's row, else the row's `RowMenu` trigger) takes it first, so the dialog gives it
  back there and a delete confirmed with Del knows its row. So a shortcut that opens a dialog shows its key on its
  control.
- **Badges:** status via `StatusBadge` + `lib/labels.ts`; tags as `outline` badges or plain muted `#tag` text,
  one style app-wide; at most 3 badges before the title. Badges are labels, never buttons or tabs.
- **View switches:** `Tabs` (`components/ui/tabs`, default segmented or `underline`) for in-page views, tied to the
  region they switch (ARIA APG tabs; accessibility pass 13/11/2026): Base UI's `TabsPanel` where it fits (Tuần),
  given `tabIndex={undefined}`: Base UI puts `tabindex="0"` on the open panel and lays our props over its own as
  Object.assign does, so the undefined leaves no tabindex (never `-1`, which Chrome still focuses on a click in the
  panel's text);
  otherwise `tabProps(panel, value)` on each tab and `tabPanelProps(panel, view)` on the region below the toolbar
  (`lib/tab-panel.ts`: `aria-controls` on the tabs, `role="tabpanel"` named by the selected tab, a wrapper keeping the
  page's own `gap-6`, a panel only while the switch shows). So it goes for the view switches of Thư viện, Dự án and
  Công cụ, Ghi chú's Danh sách / Theo item, Inbox's status tabs and the evidence filter on /co-hoi/?id=. The region
  gets no tab stop (round 3 open items, WCAG 2.4.7): Tab goes from the switch on to the region's first control (on
  Tuần through "Phím tắt"); a tabindex on a large region, `-1` too, makes Chrome focus it on a click in its text, and
  the next Tab jumps back to its top. Links to two routes are not tabs: Thư viện's Item / Ghi chú is a
  `<nav>` named "Thư viện" whose links carry `aria-current="page"` on the half shown, drawn with TabsList's and
  TabsTab's classes and the indicator's colours (`library/library-tabs.tsx`; `lib/registry-copies.test.ts` fails
  when the registry's classes change). A tab's count (those links, Inbox's "Inbox" tab) is `tabCountClass(current)`:
  `text-xs` muted, `foreground/70` on the current tab in dark (§4), never louder than its label, at rest or hovered.
  Every tab list keeps the current label in `foreground` under the pointer (round 3 open items, WCAG 1.4.3):
  TabsTab's `hover:text-muted-foreground` outweighs its `data-active:text-foreground` (4.08:1 on the dark
  indicator), so one unlayered rule in `app/global.css`, `[data-slot='tabs-tab'][data-active]:hover { color:
  var(--foreground) }`, holds it for every Base UI tab, present and future, with no class at the call sites: 10.7:1
  dark, 19.9:1 light; on the underline variant's hover fill 15.5:1 / 16.8:1. Other tabs keep their hover. Thư viện's
  links, which copy TabsTab's classes and are no tabs, take `aria-[current=page]:hover:text-foreground` themselves.
  Never filled primary buttons as tabs. A view switch sits first in the
  toolbar; the filters that belong to one view follow it only in that view. The view lives in the URL
  (`?view=board`, the default view has no parameter), the last choice in localStorage (the URL wins), switched with
  `router.replace` without scrolling. Ghi chú's switch is "Danh sách" / "Theo item" (`?view=items`, DECISIONS 9.8;
  text only, since the rows stay rows): every matching note under each Item it is linked to, one container per group
  whose first row is the heading (the Item's picture flush at its start, its title a link to the Item page, type and
  note count as meta), "Ghi chú rời" (notes without an Item) last. Công cụ's switch is "Danh sách" / "Lưới"
  (`?view=grid`, owner 13/11/2026: "tools dạng list và dạng grid nữa", after haidave-com.vercel.app/resources;
  `ViewSwitch alt="grid"`, LayoutGrid icon): the same stage sections, headings and filters, each section a grid of
  cards (`repeat(auto-fill, minmax(15rem, 1fr))`, `gap-3`: one column at 390 px, four beside the sidebar at 1440 px).
  A card is the board card's surface (`rounded-lg border bg-card p-3 gap-2`) with the row's hover fill: the logo or
  the section's icon in the 40px place before the title (2 lines, opens the Item page in the Sheet) and the `RowMenu`
  at its end, the summary (up to 2 lines; without one, the site's host), then a foot with the `StatusBadge` and the
  site link (`mt-auto`, so the cards of a grid row end on one line); a click anywhere else on the card opens the Item
  too. Its toolbar keeps the switch and "Thêm công cụ" on the first row below 48rem; below 28rem the switch drops
  its icons (`textOnlyWhenNarrow`), or the button would wrap alone at 390 px.
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
- **Overlays:** `Dialog` for create/edit forms (fields via `Field`; errors: the summary under the fields and the
  marked fields, "Form errors" above);
  `Sheet` for reading or editing one record beside the list (the Item page beside Thư viện, below);
  `AlertDialog` (`confirm-delete.tsx`) for every
  delete, never `window.confirm`; `Menu` for overflow; `Tooltip` for icon-only controls; a small `Dialog` for
  the keyboard legend (add `@spaceui/popover` if a non-modal panel is needed). Their focus: "Focus into and out of a
  dialog" above. A button whose visible text is a key is named from that key first, then what it does: Cmd+K's close
  button shows "ESC" and is "ESC, đóng tìm kiếm" (WCAG 2.5.3); Enter on it closes the dialog (round 3 checks: it
  stops Enter before Fumadocs' handler on the whole dialog, which picked the highlighted row). A tooltip drawn by
  hand (the week
  chart's day columns, `tuan/time-chart.tsx`) behaves like `Tooltip` (WCAG 1.4.13; accessibility pass 13/11/2026):
  it sits inside its trigger, above a transparent padding instead of a gap, so the pointer can move onto it and rest
  there; it stays while the pointer or the focus is on the trigger or on it (hover and focus tracked apart, the
  latest trigger wins); Escape hides it without moving the focus; its values are also in the trigger's name. Use
  `Tooltip` wherever it fits.
- **Item page** (owner 07/11/2026: "ấn vào item thì hiện ra các ghi chú của item đó"; DECISIONS 9.8;
  `library/item-detail.tsx`, one component for the right-side `Sheet` beside Thư viện, `max-w-2xl`, and the full page
  `/thu-vien/item/?id=N`, `max-w-3xl` under a "Thư viện" back link like /co-hoi/?id=N). A List row, a row's title, a
  Board card's title, `?item=N` and the Cmd+K item results open the Sheet; the List and the Board stay visible behind
  it, Escape closes it and the focus goes back to the row or card (`recordFocusTarget`). From the top: the picture
  (§9a) and the title (the Sheet's 20px title, the page's 30px h1; without a picture the page shows the Thư viện title
  icon); the properties as AFFiNE shows them, a two-column `dl` (muted `text-xs` labels, values in `text-sm`: status
  badge, type, the one-line summary ("Tóm tắt"; on a tool "Dùng để làm gì"), rating, source, tags, dates; an empty one is
  left out; a tool's status reads as its use: Muốn thử, Đang dùng, Đã thành thạo, Bỏ); one row of `sm` buttons: the
  List row's next step (outline "Bắt đầu"/"Xong"; a tool's "Bắt đầu dùng"/"Đã thành thạo"), outline "Sửa" (the existing `ItemDialog`, the one way to edit properties and the
  picture), "Công việc" for a project and, in the Sheet only, a ghost "Mở trang đầy đủ" at the end; the
  done-needs-an-output warning (DECISIONS 4.2); then "Ghi chú" (h2, its count, an outline "Viết ghi chú") and every
  note of the Item, newest first, joined like one page: no card per note, `divide-y` with 20px above and below each,
  a note's own title as a 15px heading (left out when it only repeats the Item's title), the date and the other
  Items it is linked to as meta (`break-words`: an Item title may be one long word), a ghost pencil and a `RowMenu` (Mở ở trang Ghi chú, Xóa) at the end, then its
  markdown as reading text (`note-markdown.tsx`, lazy: headings at most 15px, body 14/23 in the foreground colour,
  code and tables scroll inside themselves (a table spans the width), task boxes drawn with lucide squares at the
  list's edge and read out in words, a done task muted and struck through, the other items of a list with tasks keep
  their bullets, links in the link blue, raw HTML shown as text, only local images; a picture from another site is a link). Writing happens in
  place with the block editor (below): the composer (title, optional, prefilled with the Item's title; the type's
  template, `noteTemplates` in `done-output.tsx`) shows on an Item without notes without taking the focus, and opens
  with the caret in the template's first blank line from every "Viết ghi chú"; a note's pencil turns it into the same
  form with the caret at the end. The form is an `Input` for the title, the editor in its field-like frame, then the
  save state at the start and an outline `sm` "Xong" at the end (Escape and Cmd/Ctrl+Enter do the same). There is no
  "Lưu" and no "Hủy": everything saves by itself (`use-note-autosave.ts`, AFFiNE's way): "Đang lưu…" with a spinner
  while a change waits (0.8 s) or goes, "Đã lưu" once the server has it, and a failure in `text-error-foreground`
  (AA on the page) with its reason and an outline `xs` "Thử lại" (none when the text itself cannot be saved; an
  emptied note gets an outline `xs` "Xóa ghi chú" there instead, which opens `ConfirmDelete`). A save with no answer
  in 15 s fails the same way ("Máy chủ không trả lời."), also one sent with `keepalive` as an editor closes or the tab hides. "Xong" goes back to reading once the server has
  everything: a failed save keeps the form open with its reason. Closing the Sheet, a link, hiding or closing the tab
  send what is left at once (with `keepalive` when the page goes), and until the server has it each editor keeps its
  own copy in this browser (`lib/note-copies.ts`; never written over by another editor, another tab or a save).
  A copy whose writer is gone is offered back: an `Alert` ("Có bản nháp chưa lưu trong trình duyệt này", "Khôi phục"
  / "Bỏ bản nháp", the buttons under the text at every width) above the form. A copy written over a version the note
  has been saved after (elsewhere, or by that copy's own save as the tab closed) is never called unsaved: "Có bản nháp
  viết trên bản cũ hơn của ghi chú", saying "Khôi phục sẽ thay bản mới hơn đang hiện.", and "Mở để xem" in the reading
  view. A copy of an editor open in another tab is never offered or dropped there. Such a copy stays until it is restored
  or dropped, and the reading view says one is kept: a muted `text-xs` line with a History icon and a link-style "Mở
  để khôi phục" under the note's meta, under the "Ghi chú" heading for a new note's copy, and above the notes list
  for each new note started on its own page or for an Item (a new note's copy whose create may have arrived is first
  looked up, and then belongs to that note). A note saved elsewhere since the edit began (another tab or device) is
  never written over: the form starts again from the newer note with the caret in it, and the `Alert` says so
  (role `alert`: "Ghi chú vừa được lưu ở nơi khác", this text kept as the copy to restore; with nothing unsaved, a
  muted status line). Nothing asks before closing; only a copy whose save failed makes the browser ask before the
  tab goes (also after its form closed), until it is saved, restored or dropped. An untouched template is not saved; a new note is created by its first save and the composer goes
  on editing it (it joins the list when "Xong" closes the composer). Last comes "Được nhắc tới ở" (h2, `library/item-mentions.tsx`, from
  `GET /api/items/{id}/mentions`): under a muted `text-xs` label per kind ("Cơ hội", "Kỹ năng", "Ghi chú"), rows in one
  container each, a row's title a link to its page; an opportunity's meta says each evidence row's stance in words
  (`font-medium`) and date, its decision badge at the end; a skill starts with its freshness dot and says the
  freshness word and the evidence dates; a note (one whose text links the Item with `[[ ]]`) says when it changed;
  with none of them, one muted line.
- **Note page** (`/thu-vien/ghi-chu/?id=N`, `library/note-page.tsx`, in place of the old edit dialog; DECISIONS 9.8):
  a notes row, a note's "Mở ở trang Ghi chú", a `[[ ]]` link, a backlink and the Cmd+K note results open it; the
  notes list's header is not shown. `max-w-3xl` reading width with the PageHeader's gutters; a "Ghi chú" back link and,
  at the end of that row, the save state and a `RowMenu` (Xóa); the title as a bare 30px field that wraps like a
  heading (a one-row textarea that grows with its lines; Enter goes on to the text; placeholder "Không có tiêu đề";
  an `sr-only` h1 names the page); AFFiNE's properties as a two-column `dl` (Item: the `ItemPicker`, saved at once,
  its chips shrinking to the column with the title cut by an ellipsis and a 44px touch target on the ✕; an Item the
  text links stays linked, and a muted status line says why when it is unlinked; Ngày); the editor without a frame (headings up to 18px here); then "Được nhắc tới ở"
  with the notes that link this one. `?id=new` (with `&item=` and `&template=`, from "Ghi chú mới", the empty page's
  template buttons and `n`) is a new note with the caret in it; its first save puts its id in the address
  (`router.replace`) without reopening the editor, only in the page that sent the create, while it still shows (a create that answers after the
  user left navigates nowhere). A version saved elsewhere replaces the page's editor as on the Item page (the `Alert`
  or the status line, the caret back in the text). A quick note from an Inbox entry stays a dialog (`note-dialog.tsx`).
- **Note editor** (`library/note-editor.tsx`, Milkdown 7: commonmark + gfm, owner's choice 08/11/2026; lazy with its
  CSS, `note-editor-lazy.tsx`, never on Hôm nay): blocks as they will read (`note-editor.css` follows
  `note-markdown.tsx`: body 14/23, 16px on phones so iOS does not zoom, headings 15px inline), saved as markdown.
  Inline it sits in the `Textarea`'s frame (`border-input`, `bg-popover`, focus ring); on the note page it has none.
  `/` at the start of a line or after a space opens the block menu (Văn bản, Tiêu đề 1-3, Danh sách, Danh sách số,
  Việc cần làm, Trích dẫn, Khối mã, Đường kẻ, Bảng; typing filters without accents: `/tieu de 2`); `#`, `-`, `1.`, `>`,
  "```" and `[]` turn the line into that block as they are typed; a task has a real checkbox (Cmd/Ctrl+Enter ticks
  it), named "Đã xong: {task}" from its own line and renamed as it is typed ("Đã xong" while empty); `[[` opens
  the link picker (Item, Ghi chú, Cơ hội, Kỹ năng, each a muted group heading) and a pick writes the
  record's title as a link. Both menus are one popover surface under the caret (`--popover`, border, Depth/Popover
  shadow, 8px radius, the highlighted row in `--accent`, 44px rows on touch), driven from the keyboard (arrows, Enter,
  Escape closes the menu only) with the caret staying in the text (`aria-activedescendant`); only the menu's own list
  scrolls to the highlighted row (never the page, the Sheet or a phone's visual viewport), and a menu is never wider
  than the room it has (the Sheet at 390 px; the `[[` list is placed from the editor's left edge, so a phone page never
  widens). On a list line `/` offers every block: another list kind changes the whole list in place, the line's own kind changes
  nothing, any other block takes the line out of its list (nothing is saved while the menu is open), and one Cmd/Ctrl+Z
  gives the typed "/…" back. Đường kẻ goes after the line with the caret on a line below it. Links in the editor are not followed; the
  reading view follows them. The placeholder ("Gõ / để chèn khối, hoặc viết luôn") shows in an empty note and in the
  empty line holding the caret. Until the editor's chunk arrives the note shows as it reads (`NoteBody`, pictures
  loaded at once) in the editor's frame and cannot be used; the reading view draws every block at the editor's size
  and spacing (headings per variant, task rows, tables, quotes, lists nested in tight and loose items, pictures inline
  and middle-aligned), so nothing jumps when it comes (0 px at 1280 and 390, page and Sheet). A done task mutes and
  strikes only its own text, never the list under it. Keys typed from the moment the editor is asked for with the caret
  (while its chunk loads, while it is made, or after a version saved elsewhere replaces it) go to a hidden keeper field
  ("Đang mở trình soạn thảo", IME included) and are typed into it; when ready it takes the focus only from that field or
  where nothing holds it, never from the title or the Item picker. Pages that can open an editor fetch its chunk when
  idle. A picture from another site inside a link shows as the link's text "[Ảnh: alt]" in both views.
- **Công cụ** (`/phat-trien/cong-cu/`, owner 13/11/2026: the tools senior engineers use at each stage, and tools to
  learn by dissecting codebases and by doing; `components/brain/tools/tools-page.tsx`): tools are Items of type tool,
  their stages are tags (`lib/tools.ts`: learning first, Đọc & mổ xẻ codebase and Học qua thực hành, then the stages
  of the work). The toolbar has two filters, "Trạng thái" (a tool's words: Muốn thử, Đang dùng, Đã thành thạo, Bỏ)
  and "Công đoạn", and the primary "Thêm công cụ" (the Item dialog with the tool type, and the chosen stage, picked);
  below 36rem the filters share the first row and the button takes the second. Then one section per stage in the
  list's order and "Khác" (no stage) last, 32px apart: an 18px h2 with the stage icon (§5) and the tool count in muted
  `text-sm`, over the rows in one container; a tool with several stages is a row in each. A row: the picture track
  (its logo, or its first stage's icon), the status badge from md (in the meta line below md, as on Thư viện), the
  title over its summary ("dùng để làm gì", two lines on phones, one from sm; the host when there is none), then the
  site as an icon-only ghost link (new tab, `rel="noopener noreferrer"`, tooltipped "Mở <host> (tab mới)" and named
  those words, then the tool, "Mở <host> (tab mới): "<tool>"", since many tools share github.com)
  and the `RowMenu` (the Item entries, then "Chuyển sang ..." for each other status). A row or its title opens the
  Item page in the Sheet (`?item=N` too), as on Thư viện. Groups sort by title. First run: the §9a panel
  (`ToolCase` glyph, the `manage.py seed_tools` hint, ghost rows); filtered empty: "Xóa bộ lọc".
- **Tables** for numeric or time data (Giờ, thị trường): header `text-xs font-medium text-muted-foreground`,
  rows `h-10` with `divide-y`, no vertical cell borders, numbers right-aligned `tabular-nums`. Add the Space UI
  table component from the registry when first needed rather than styling `<table>` by hand.
- **Keyboard hints:** `Kbd` in the search button, in `MenuShortcut`, and in at most the 1-3 main verbs of a
  keyboard-driven list; hidden on touch / below `sm` (`max-sm:hidden` or `pointer-coarse:hidden`). The full
  legend lives behind one "Phím tắt" control, not as a bar of 10 keys. Single-key shortcuts can be turned off
  (WCAG 2.1.4; accessibility pass 13/11/2026): every page-wide handler of a key pressed without ⌘/Ctrl/Alt (J/K, N,
  `/`, `?`, `[`, 1-9...) asks `singleKeyShortcut(e)` (`lib/single-key-shortcuts.ts`) first, or
  `singleKeyShortcutsOn()` after its own modifier and typing checks; never a copy of these checks of its own. A
  focused row's letters (an objective's D/X/O) follow the switch; its arrows, Enter and Del act on the row and always
  work, as do ⌘K, Ctrl/⌘+Enter and Alt+↑/↓. The switch ends every `KeyLegend`, under a hairline (`mt-4 border-t
  pt-4`): a `Checkbox` "Phím tắt một phím" (`text-sm font-medium`) with its hint under the label (`text-xs` muted,
  in `aria-describedby`), on by default and remembered in this browser (localStorage
  `alex-brain:single-key-shortcuts`, '0' = off, every access in try/catch; other tabs follow). The legend opens with
  the focus on "Đóng", so Space after "?" never flips it; while it is off the legend button drops its `?` chip.
  While it is off no single key is advertised (round 3): what a page draws asks `useSingleKeyShortcuts()` (live in
  this tab and others, on in the server render; a list asks once and hands it to its rows) and leaves out the `Kbd`
  chip (in a button, a tooltip, a picker's digits), the menu key (`MenuSingleKey` in `row-menu.tsx`; a focused row's
  own keys keep `MenuShortcut`), `aria-keyshortcuts`, the key in a name (`Đọc sau "{title}"`, `Bắt đầu bấm giờ cho
  "{title}"`) and the key sentence of a notice or error ("Nhấn A để lưu trữ mục."; what is left keeps its period,
  `Đã tạo ghi chú "{title}".`). A menu shows a key only where that key acts (round 3 follow-ups): `MenuSingleKey`
  is for keys a page answers on any of its rows (the Inbox's O, T, N, Del); Ghi chú's E and Del act on the list
  view's cursor, so `NoteRow` takes the switch and the view as one `keys` prop over a plain `MenuShortcut`, and
  "Theo item", which has no cursor, shows none, on or off. A legend keeps its `'always'` lines (`KeyLine`: a focused
  row's arrows, Enter, Alt+↑/↓, Del); with none left the switch stands alone, without the hairline. Keys with ⌘, Ctrl
  or Alt and a dialog's ESC keep their hints. The switch is also Cmd+K's one command, so every page and phones reach
  it: the destinations list ends with a "Cài đặt" group holding "Tắt phím tắt một phím" / "Bật phím tắt một phím" (a
  result row: Keyboard icon, the state as meta, "Đang bật trong trình duyệt này"). A command that changes a setting
  in place never takes the top or Enter from a search (round 3 follow-ups, WCAG 3.2, 2.4.3; `lib/search-command.ts`,
  tested in `search-command.test.ts` per state and language). `matchCommand()` reads the query, accents (decomposed
  ones too), case, hyphens and spaces aside: `strong` when it holds one of the command's phrases as whole words
  (`SHORTCUTS_WORDS`, through `shortcutsCommandTerms(t, on)` with the switch's state now: its whole object in either
  state, vi "phím tắt một phím", en "single key shortcut(s)", or the verb of what the row does now with it, "tắt phím
  tắt" / "turn off shortcuts" while the shortcuts are on, "bật phím tắt" / "turn on shortcuts" while off), none of the
  other verb's words (`against`: "bật" / "on" while on, "tắt phím tắt" / "off" while off, since "tắt" alone is also
  in "phím tắt") and its other words are the command's own, the last maybe half-typed ("tắt phím tắt m"); `weak` when
  each word only starts or is one ("ta", "mo", "một", "on", "turn off"), and so for "phím tắt", "một phím",
  "shortcuts", "keyboard shortcuts" and "single key", the words of the handbook pages about keyboard shortcuts (89
  pages say "phím tắt", 80 "keyboard shortcut"; round 3 checks), and for a query with the other verb, which asks for
  the state the switch is already in (round 3 final checks: "tắt phím tắt" with the shortcuts off led with "Bật phím
  tắt một phím", and Enter turned them on); else `none`. The dialog reads the query composed (`normalize('NFC')`
  where it enters and in each row), so the second brain's `?q=` (Django's `icontains` has no NFC step), the command,
  the highlight and `MIN_QUERY` count the letters on screen. `placeCommand()` puts a strong match first, the row Enter
  picks, even alone; a weak one last, after the results under "Cài đặt", and leaves it out while nothing else is
  listed (no index, nothing found, the brain hits not back: alone it would be the first row, which Fumadocs makes
  active; the list says "Đang tìm…" or "Không tìm thấy kết quả" and Enter does nothing), unless it was just picked
  (below); the destinations (nothing typed, or this query's first results still coming) end with it; any other query
  leaves it out. The active row is the one Enter picks (round 3 checks, WCAG 3.2.2): while the query is the same it
  stays where it is as long as it is listed, whatever lands around it (the brain group, then the handbook results;
  Fumadocs moved it back to the first row each time, away from a row arrowed to), and when it leaves the list (a
  destination, as the results land) the first row takes it, never the command the user had moved off; a new query
  text starts at the first row, with none active while the query's own rows do not lead the list (`waiting`): the
  destinations standing in for its first results, or another query's rows kept until its own land, the brain hits of
  a query it extends or shortens and the handbook results of the last one (fumadocs-core's `useSearch` keeps them;
  round 3 final checks: Enter right after typing over a query opened a result of the old one). Enter and the arrows
  wait for them (it opened "Hôm nay"; round 3 repair: from no active row Fumadocs' ArrowDown and ArrowUp both
  highlight the first row on screen, so ↓ then Enter still opened the old query's result), the first of them takes it
  as they land, and a row pointed at meanwhile keeps it; so a command arrowed to at the end of a weak query is never
  Enter's after another letter (`ActiveBefore` notes the row, `ActiveAfter` sets it; the dialog's capture handler
  stops the arrows before Fumadocs' listener). The arrows wait at most 3 s of the dialog open after the last key
  (`WAIT_MS`), and not once the query's own handbook search failed (round 3 recheck, WCAG 2.1.1: fumadocs-core keeps
  the last results with only an `error`, shown as "Tìm kiếm lỗi, đang hiện kết quả cho …", and the second brain's
  requests have no time limit, so the arrows waited for good while the pointer could open the rows shown; an error
  from before the query last changed is not its own, it stays while the query is asked again). No row is made active
  while the rows on top are not the query's own (`stale`, ActiveAfter), even once the arrows stop waiting: an arrow or
  the pointer picks one (with the bounded wait there, a late row landing or the dialog reopened made the first row
  active, a result of the query typed over). At the end only the arrows (from the first row ArrowUp wraps to it) or
  the pointer highlight the command. "Bộ não thứ hai", "Cài đặt" and "Đi đến" always head their groups (the
  destinations under early brain rows too); "Sổ tay" heads the handbook results whenever another group, the command
  included, shares the list. A pick flips the switch and keeps the dialog open, read out by a polite `role="status"`
  in the dialog's header; the row cancels mousedown (`ResultRow keepFocus`), so a click or tap leaves the focus in the
  search field. After a pick the command's place follows the new state: the whole name alone keeps it first and
  highlighted (a toggle: Enter again turns it back, no verb was typed), and a query that named what the row did,
  "tắt phím tắt", now asks for the state the switch is in, so the command goes after the results, scrolled into view
  with its "Cài đặt" label and new action, and no row is highlighted until an arrow, the pointer or the next letter,
  also as later results land (round 3 repair: the highlight stayed on it, and a second Enter turned the switch back
  against the words typed); a pick that turns it back makes the query name it again: first and highlighted. It stays
  listed until the query changes (Escape clears it), even alone (`placeCommand`'s `picked`: it vanished under "Không
  tìm thấy kết quả", read out after "Đã tắt phím tắt một phím").
  Another tab flipping the switch under such a query takes the highlight off it too. A held Enter picks once: its
  repeats stop in the dialog's capture handler (Fumadocs picked the active row on each, flipping the switch until the
  key was let go). The field is a combobox expanded whenever the list shows rows, the command, the results or the
  destinations (`aria-expanded` from the rows: Fumadocs reads "a row is active", so while waiting and after a pick it
  said collapsed over a listbox of rows; WCAG 4.1.2). The dialog fits the screen at any zoom (round 3 checks,
  WCAG 1.4.10): from md its top keeps 1rem (`md:top-[max(1rem,calc(50%-250px))]`), and its list is at most
  `min(460px, 100dvh - 7rem)` (at 200% on a 1280x800 screen it ran 90-170px below the screen, the command and an
  ArrowUp to it out of sight). The dialog and its list are named "Tìm mọi thứ" / "Search everything", as the top bar
  names the search (Fumadocs' `'Search(search dialog)'`, set in `app/[lang]/layout.tsx`), and a hidden comma parts a
  row's title from its meta in the option's name.
- **States:** `LoadingCards`/`Skeleton` at the real row or card geometry; `ApiErrorState` (with "Thử lại") when
  nothing loaded, `ApiStaleAlert` when old rows stay; `EmptyPanel` for a list's first run (§9a), `EmptyState` for
  filtered-empty. A reload of the same list (useApi reloads on a return to the browser tab) keeps its rows on screen,
  and the focus in them, never the skeleton: a list shows `data` while `dataKey` is its key (Thư viện, Inbox, Ghi
  chú; round 3 checks, WCAG 2.4.3); another filter, search or view starts from the skeleton.
- **Sidebar** (`components/app-shell.tsx`, `lib/app-nav.ts`; owner's references, 04/11 and 06/11/2026): a 64px header
  (the `Brain` tile, "Alex's Brain" alone, no tagline (owner), a ghost `icon-sm` "Ẩn menu" button; its border
  continues the top bar's), then three tiers parted by hairlines (`TierLine`: a `border-t` in `--sidebar-border`,
  inset to the icons' edge, so it stays in forced colours): the daily pages (Hôm nay, Tuần) without a label; the areas
  Phát triển, Thư viện, Cơ hội and Công việc, each under a `text-xs` semibold muted uppercase label (`h-7`,
  `tracking-wide`) with more space above a label than between rows; and Khác (Giới thiệu, Hướng dẫn) pushed to the
  bottom (`mt-auto`; on a short screen it scrolls with the rest), muted until hovered or current, without a label (its
  list is named "Khác"). The header (the mark, "Ẩn menu") and every row (an icon + title in the text colour) sit in
  one `<nav aria-label="Menu">`, `aria-current` on the current row (darker grey fill, medium weight). A row may end
  in its count (`text-xs` muted `tabular-nums`, 99+, nothing for 0; the row is named "Tuần, 2 mục tiêu còn mở": the
  title, then the count as shown, 99+ too, then what it counts, so the name holds the visible "Tuần 2", WCAG 2.5.3;
  every count label starts with `{n}`, `lib/app-nav.test.ts`) from `GET /api/counts`: the number the page lists with
  its default filters, except Tuần (open objectives of this week); refreshed on every navigation, on tab focus and
  after every API write. Giờ ends in the `bw-red` "now" dot while a timer runs. The top
  bar's menu trigger shows only while the sidebar is hidden (and on phones). Inbox and search stay in the top bar
  (DECISIONS 9.3): the Inbox link is named "Inbox, 5 mục chưa xử lý" over its "Inbox 5", and the search button
  "Tìm mọi thứ, ⌘ K" at every width (its words, then the key hint drawn in it; the hint and the name share
  `SEARCH_KEY`), keeping the key where the hint is hidden (touch, below sm), as the Inbox verbs keep their letters.
  The top bar ends with the language switch (a ghost button: the Languages glyph and the other
  language's code, "EN" or "VI", named and tooltipped in that language; DECISIONS 9.9) and the theme toggle.
  Below sm the search button's label is the short "Tìm…", shown whole or not at all, never cut into a stub ("Se…")
  or run past its border: the span is `flex h-6 min-w-0 flex-1 flex-wrap overflow-clip` and its empty `before:h-6`
  holds the first line (24 px, the button's text-base line below sm; not `h-lh`, which Firefox before 120 drops), so
  a label that does not fit wraps to the clipped second line (`overflow-clip`, not `overflow-hidden`: a hidden box
  scrolls, and find in page or a `#:~:text=` link would scroll the cut line into view). On a phone it shows from
  about 325 px (Vietnamese) and 345 px (English), beside an Inbox count from about 355 and 375 px, 360 and 380 px with
  a 3-digit count (the count arrives after load, so between those widths the label goes a moment after the page
  shows); narrower, the button is the outlined field with the magnifier alone, still named "Tìm mọi thứ, ⌘ K",
  without a tooltip (one would also show from sm, beside the whole label). Check the top bar at 320 px in both
  languages with a 3-digit count.
  English UI copy is sentence case like the Vietnamese and must fit the same boxes: check the 390 px layouts in
  both languages (English runs about 10% shorter, some labels longer).
- **Landmarks and skip link** (accessibility pass 13/11/2026, WCAG 2.4.1; `components/app-shell.tsx`,
  `components/skip-link.tsx`): the sidebar is the `nav "Menu"`, the top bar a top-level `<header>` (the banner) and
  the page the one `<main id="main-content">`; a page adds no `<main>` and no top-level `<header>`. The column beside
  the sidebar is SidebarInset's box as a div (the registry's is a `<main>` and would hold the top bar;
  `lib/registry-copies.test.ts` keeps the copied classes in step). "Bỏ qua tới nội dung" is the first tab stop of
  every page, lessons too (to `article#nd-page`): `sr-only` until focused (`not-focus:sr-only`), then a popover-like
  button at `fixed start-4 top-4 z-50` (border, `rounded-lg`, `bg-popover`, `shadow-popover`, the Button's
  `h-9`/`sm:h-8` and its 2px ring). It moves the focus with `focus({ preventScroll: true })`, never with a #hash (a
  hash entry carries no App Router state, so Back would show the wrong page). Its target is focusable only while it
  holds that focus (`tabindex="-1"` until its blur or the next pointer press), never with a lasting tabindex: Chrome
  focuses such a region on a click in its text and the next Tab jumps back to its top. It shows no ring: it is not a
  control. Lesson pages are Fumadocs': the banner only on phones, the table of contents a navigation (§4 "Lesson
  pages, landmarks and names").

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
  area (no hue per area, §4). Hôm nay, Inbox, capture, Giới thiệu and Hướng dẫn have none.
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
  9.6). One picture per Item: its own image (uploaded; the OG image of its link; for a tool, the icon of its official
  site, which the server fetches (DECISIONS 9.10); a small local webp from
  `/api/items/{id}/image`; `ownPicture()`, `lib/item-picture.ts`), else on Thư viện the Sổ tay cover of a handbook
  course (`BookCover`; `itemPicture()`, `lib/handbook-picture.ts`, the only one that ships the registry), else nothing.
  The shape follows the type: a 2:3 **poster** for books and films, a **logo** for projects and tools, a landscape **cover** for
  the rest. Pictures follow the split-card rule above: flush, clipped by the container's radius, no frame, no text or
  scrim, never dimmed by status (`opacity-50` means "being dragged"). Where (`library/item-image.tsx`): a Thư viện row
  gets one flush 56px square track at its start (`RowPicture`), shown only when a listed row has a picture, and then
  the status leaves its badge for the meta line below `md` so the title keeps its room at 390 px; a Công việc row gets
  the track from `md` only (its status is already in the meta line on phones, so the track would only take the
  title's room); a board card shows a cover or a handbook band flush on top (16:7), a poster as a flush 4rem start
  column (2:3 at the card's minimum height), a logo as a 40px square before the title (a Công cụ grid card the
  same, through `boardMedia`). On the Item page (the Sheet
  and /thu-vien/item/, §6) no container holds the picture, so it stands beside the title as the record's own object
  (`DetailPicture`): a 2:3 poster 4rem wide (5rem from sm), a 16:7 cover 7rem (9rem), the handbook's cover thumb in
  a 4rem (5rem) square, a 48px (56px) logo on its ground, `rounded-md`, no frame or shadow. A logo is the one inset
  picture: `object-contain` on `--logo-ground`, white in both themes and kept under forced colours (a sticker; the logo
  keeps its transparency and most logos are drawn for a light page), `rounded-md` on cards. A fetched tool logo is
  the site's own icon file, 32-256 px, never enlarged (under 64 px only when the site has nothing bigger), on the same
  white ground; a drawing on a wide white or transparent margin (under 80% of the icon) is cut to a square around it
  with a 6% margin so padded app icons fill the place like the others, and an icon on a coloured tile is kept as it is.
  Nothing is added to make icons match (no frame, tile or padding); a 32-48 px icon shows slightly soft at 2x. No picture: the row keeps
  an empty track and the card stays text-only; never a placeholder drawing, with one exception: a **tool without a
  logo** shows the lucide icon of its first stage (`stagePicture()`, the Công cụ page's order in `lib/tools.ts`, the
  Wrench without a stage; owner 13/11/2026, "nếu mình không kịp tải logo lên"; also while its logo is being fetched,
  and for good when its site gives none: about 1 tool in 5 of the starter list) in the place its logo would take, in
  every place a tool's picture shows (rows, board cards, the Item page): centred, `muted-foreground`, the title icon's
  1.5 line, nothing behind it (no logo ground, no tile, no colour per stage); 24px in a row's 56px track, 20px in a
  card's 40px place, 28px in the Item page's 48/56px place. Skeletons take the picture geometry the
  page had last time (D27). Pictures are decorative (`alt=""`, `aria-hidden`): the row or card names the record. The
  dialogs' "Ảnh bìa" / "Logo" field (`library/item-image-field.tsx`) is a labelled group: a preview at the card's
  shape, "Tải ảnh lên" / "Đổi ảnh", a fetch toggle (`aria-pressed`, an http(s) source): "Lấy ảnh từ link" (the page's
  image), or for a tool "Lấy logo từ trang" (the icon of its official site, never its OG banner); never for a project,
  whose logo is only uploaded (a client's site is not the project's logo); not offered when saving will fetch anyway: a
  new Item or a new link without a picture, which the status line says ("Khi lưu, logo sẽ được lấy từ trang; nó hiện
  sau vài phút." for a tool) and ghost "Bỏ ảnh"; the buttons stay put when used and "Bỏ ảnh" hands the focus
  to "Đổi ảnh"; the status line is a polite live region, worded by `imageStatusText()` in `lib/item-picture.ts`.
  When the last fetch of the saved link found no usable picture (`imageMissing`), it says so and asks for an upload
  ("Trang không có logo dùng được; hãy tải logo lên." for a tool, "Link không có ảnh dùng được; hãy tải ảnh lên."
  otherwise), only while the field's link is the saved one; an empty logo field reads "Chưa có logo.", a cover or
  poster "Chưa có ảnh.". Every change waits for "Lưu" and "Hủy" drops it, so no
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
  line; so are a Công cụ stage's icon, 20px before its section title, and a tool's stage icon in its logo's place, 24px
  in a row, 20px on a card, 28px on the Item page); no emoji as icons.
- **D21** No decorative icon beside headings or card titles (an area page's title icon, the icon of a Hôm nay
  tile heading, the group mark before a Sổ tay group's section title and the stage icon before a Công cụ stage's
  section title excepted, §5); no nav icon as an empty state glyph; icon-only buttons have a
  tooltip; icons in tabs only on a view switch that changes the layout (List / Board, §5).

Components
- **D22** Row actions: <= 3 visible, the rest in a Menu; delete goes through the confirm dialog.
- **D23** View switches are `Tabs` tied to the region they switch, not filled buttons; links to two routes are a nav
  drawn like tabs (`aria-current`); filters left, primary action right in one toolbar.
- **D24** `Kbd` hints hidden on touch / 390 px and limited to the main verbs; full legend behind one control, ending
  with the "Phím tắt một phím" switch (also a Cmd+K command, first only for a query that names it: its whole name or
  the verb of what its row does now, never the other verb, whose state the switch is already in, nor "phím tắt" or
  "shortcuts" alone; after a pick under its verb it goes last, still listed and unhighlighted, so a second or held
  Enter never turns it back); with it off no single-key chip, menu key, legend line or list cursor shows (the Inbox
  entry a Cmd+K link opened keeps its mark), only keys with ⌘, Ctrl or Alt and the focused row's own.
- **D25** Badges: <= 3 per record, one tag style app-wide, never used as buttons or tabs.
- **D33** A link inside or right under running text is underlined at rest; a link action standing on its own (a
  section header's `… →`, a jump alone in its bar) may underline on hover only.

Keyboard and focus (screenshots taken while using the keyboard)
- **D34** The first Tab of a page shows "Bỏ qua tới nội dung" at the top left; after a failed save the focus is on
  the first invalid field (light: its red border kept, the blue ring outside it); after a confirmed delete it is on
  the next row, the previous one or the list's heading, never lost; after Escape, Hủy or ✕ it is back on the control
  that opened the dialog; after a Cmd+K pick of a heading of the lesson shown it is on that heading, the lesson's
  popover or drawer closed; a focused scroll area (a Sheet, Cmd+K's results, a wide table) shows the whole 2px ring, and
  so does a link in a truncated line (Ghi chú) and the highlighted row of a menu, a Select or Cmd+K; a focused control
  is never under a sticky bar, flush with the bottom edge or behind a lesson's open popover or drawer; after a triage
  button takes its card away the focus is on the next card; in forced colours every focus, the J/K cursor and the
  current tab still show.

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
