# DESIGN.md: rubric for the real app UI

Binding for every page in the app shell (`app/(home)/*`, `components/brain/*`, `components/app-shell.tsx`, dialogs,
Cmd+K). Not for Stageshow guides and intro pictures (they follow `.claude/skills/stageshow/`) or lesson prose
(Fumadocs, `#nd-page .prose`). Target: a screen that could sit next to Linear, Raycast or Notion and not look
generated. Space UI (`components/ui`, `components/spaceui`, tokens in `app/global.css`) is the source of truth; a
missing component is added with `npx shadcn@latest add @spaceui/<name>`, never hand-written. Reviews cite rules
by ID (D1...D29, last section).

## 1. Principles

1. **Restraint.** Fewer surfaces, fewer words, fewer colours. Before adding a border, badge, icon or line of help,
   remove something. Detail goes on the record the user is acting on, not on every row.
2. **One focal point per screen.** Decide what the eye lands on first (Hôm nay: "Tiếp tục học"; Inbox: the
   selected entry; Tuần: this week's objectives; Giờ: the running timer) and give it the weight. Everything
   else is quieter.
3. **Hierarchy by type weight and colour, not boxes.** Title vs meta is `foreground`/600 vs
   `muted-foreground`/400, not a new container. Group with whitespace and one divider, not nested cards.
4. **Real product, simplified.** Signature content stays (thumbnails, the week number, the timer, numbers);
   decoration goes (eyebrows, gradients, icon on every heading, sparkle).
5. **Same thing, same look, every page** (DECISIONS 4.4): one row anatomy, one status palette, one tag style.

## 2. Type scale

Inter (`font-sans`) for UI, Geist (`font-heading`) only for titles, JetBrains Mono (`font-mono`) only for code,
URLs, keys and aligned numbers. Weights 400, 500, 600 only (no 700). Sentence case everywhere; no
`uppercase`/`tracking-wide` labels.

| Role | Classes | px / line | Where |
|---|---|---|---|
| Page title | `font-heading text-3xl font-semibold tracking-tight` | 30 / 36 | `PageHeader` h1, one per page |
| Big number | `font-heading text-2xl font-semibold tabular-nums` | 24 / 32 | at most one per screen (timer, count) |
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
  edge aligns with the page title. Top bar `h-16`. No horizontal page scroll at 390 px.
- **Rhythm:** title to its meta 2-4px (`gap-0.5`/`gap-1`); row to row 0 (divider) or 4px; group to group 24-32px
  (`gap-6`/`gap-8`); page header to first content 24px (`pb-6`). A title is always closer to its own meta than to
  the next record.
- **Insets:** words keep 12px from any container edge (`px-3`), 16px in cards and dialogs. Edges either align
  exactly or sit 8px+ apart; 1-3px near-misses are bugs. A button keeps 8px+ from the field above it.
- **Row heights:** 32px menu/sidebar row (`h-8`); 40px one-line list row (`h-10 px-3`); 56px two-line row (title +
  meta). Touch targets reach 44px via the components' own `pointer-coarse` rules; never shrink below them.
- **Columns:** rows of one list share one grid template with fixed tracks (status, title flexible, meta, actions);
  optional content keeps its track empty so columns stay aligned.
- **List row beats card** when items are homogeneous and scanned or triaged (items, notes, projects, time entries,
  skills, opportunities, search results): rows in one container, `rounded-xl border bg-card divide-y`, hover fill
  `hover:bg-accent`, selection `bg-accent` + `aria-selected`. **Card** only when the record carries an image or an
  excerpt worth reading in place (inbox entry, brief story) or it is a dashboard tile on Hôm nay; cards stack with
  `gap-3`. Never a card per row of a list of more than ~5 plain records.
- **Radii:** containers `rounded-xl`, controls `rounded-lg` (Button default), row and hover fills `rounded-md`,
  badges `rounded-sm`, avatars/dots `rounded-full`. `rounded-2xl`/`rounded-3xl` are legacy: do not add more.
  Nested shapes: inner radius = outer radius - padding.

## 4. Colour

Tokens only (`bg-background`, `bg-card`, `bg-muted`, `bg-secondary`, `bg-accent`, `text-foreground`,
`text-muted-foreground`, `border-border`, `ring`, `sidebar-*`); no hex or `zinc-*` in components.

- **Neutrals carry the page.** Five inks at most on a screen: foreground, muted-foreground, border, one fill
  (`secondary`/`muted`), background.
- **Blue `primary` is for the one primary action** of a view (filled `Button` default) and for links/focus. It is
  not a selected-tab colour, not a heading colour, not a decoration.
- **Status colours come from `lib/labels.ts` tones only** (`Tone` -> `Badge` variant): `info` = active/keep,
  `success` = done/build, `warning` = needs attention (Inbox), `error` = failed, `secondary` = planned/undecided,
  `outline` = dropped/archived. The same status has the same colour on every page; a colour never means two things.
- **Highlight:** `bw-red` only for the "now / continue" marker (Tiếp tục học dot, progress). Data colours only
  from `--chart-*` tokens (billable/nonbillable, objective/other).
- **Forbidden:** purple (`bw-purple`, `chart-4` dark) in app UI, gradients, glows, coloured shadows, translucent
  overlapping fills, gradient text.
- **AI output shows what the AI did, not that it is AI.** Suggested tags/destination render as normal
  `outline` badges followed by a small `text-xs text-muted-foreground` label "tự động" (or a "Gợi ý tự động:"
  prefix); an accepted suggestion loses the label. No sparkle, wand, bot or star icon, no purple, no shimmer.
- **Surfaces and contrast** (owner, 03/11/2026: the all-white UI was "too white"; do not whiten it again):
  - The page (`--background`) is a light neutral grey (`neutral-100`, no blue or purple tint); every container
    on it (card, list container, empty state, panel, Hôm nay tile) is a surface: `rounded-xl border bg-card`,
    white with a visible 1px `--border` (black 12%). Dialogs, sheets, menus and popovers are `bg-popover` (white)
    with the same border. The sidebar is white (`--sidebar` = card) with a border, so it reads apart from the page.
  - Dark: the page is the darkest layer (`zinc-950`), surfaces are lighter (`--card` 8%, `--popover` 10%),
    borders white 12%. Depth comes from the lighter surface, not shadows.
  - Fills (`--muted`, `--accent`, `--secondary`) are darker than the page, so tabs, hovers and skeletons still
    show on it. Form controls (Input, Textarea, Select, Checkbox, Radio) are painted `bg-popover` like the
    outline Button, so a filter or search field on the grey page is white too, never a grey box; a surface
    also re-declares `--background` (global.css) for the rest (outline badges, ring offsets).
  - The keyboard cursor on a card list (Inbox) is a darker border (`foreground/40`), not a grey fill: in light
    a selected card stays white; dark adds the lighter `accent` step.
  - Stageshow wells (guides, /gioi-thieu/ tiles) keep their `secondary` ground and add the 1px `--border`.
  - Blue stays the accent for the one primary action, links and focus only; surfaces never get a blue tint.
  - Focus ring (`--ring`) opaque, >= 3:1 against the page and every surface (WCAG 1.4.11): light `#3582ff` is
    3.3:1 on the page and 3.6:1 on white; dark `#6aa5ff` 7:1 or more. Never lower it with `/50` or alpha.
  - Text stays AA on page, surface and fill: `muted-foreground` is >= 5.6:1 on every one of them.
- **Border plus fill:** a surface is border + `bg-card` (the surface rule above), plus at most `shadow-depth-1`
  (the focal block). Inside a surface, a nested element gets a fill or a divider, never another bordered box
  (D12). `shadow-popover` only for things floating above the page (popover, menu, dialog, hovered draggable).
- **Both themes are designed.** Every screen is checked in light and dark.

## 5. Icons

- **lucide-react only**, default stroke (2) everywhere in a screen; the sidebar logo `Brain` (1.75, `size-6`) is
  the one exception. Never mix stroke widths or filled and outline glyphs in one view. No hand-drawn SVG glyphs.
- **One size per context:** 16px (`size-4`) in buttons, nav, toolbars, rows; 14px (`size-3.5`) in badges, meta
  lines and `xs` buttons; 18px only in `EmptyMedia`. Components already size their icons: do not override.
- **Icons earn their place:** nav items, a verb with a standard glyph (Plus, Trash2, ExternalLink, Pencil), a
  state colour alone cannot carry (spinner, error). **No icon beside headings, card titles or section titles.**
  Hôm nay tiles may reuse the destination's nav icon from `lib/app-nav.ts`, nothing else.
- **No emoji as icons** (emoji are user content only). Icon-only buttons have `aria-label` and a `Tooltip`.

## 6. Components (which one for what)

- **Buttons** (`components/ui/button`): `default` (filled blue) = the one primary action per view region (page
  toolbar, dialog footer, empty state); `outline` = secondary actions, at most 2-3 visible together; `ghost` =
  toolbar, row and icon actions; `link` = inline navigation; `destructive-outline`/`DeleteButton` = delete
  entry point; filled `destructive` only as the confirm button inside `confirm-delete.tsx`. Sizes: `default` in
  page toolbars, `sm` in cards and dialogs, `xs` / `icon-sm` in rows. Label = Vietnamese verb + object.
- **Row actions:** at most 3 visible (primary verb first); the rest go in a `Menu` behind a ghost `icon-sm`
  `MoreHorizontal` with `MenuShortcut` for keys. Hover-revealed actions must also show on focus and on touch.
- **Badges:** status via `StatusBadge` + `lib/labels.ts`; tags as `outline` badges or plain muted `#tag` text,
  one style app-wide; at most 3 badges before the title. Badges are labels, never buttons or tabs.
- **View switches:** `Tabs` (`components/ui/tabs`, default segmented or `underline`) for in-page views and for
  route halves (Thư viện Item / Ghi chú). Never filled primary buttons as tabs.
- **Toolbar:** one row, `h-8` controls: filters (`ChoiceSelect`/`Select`) left, the primary action right; wraps
  to two rows at 390 px with the primary action keeping the end of the first row or full width, never orphaned.
- **Overlays:** `Dialog` for create/edit forms (fields via `Field`, errors via `fieldErrors()` under the field);
  `Sheet` for reading or editing one record beside the list; `AlertDialog` (`confirm-delete.tsx`) for every
  delete, never `window.confirm`; `Menu` for overflow; `Tooltip` for icon-only controls; a small `Dialog` for
  the keyboard legend (add `@spaceui/popover` if a non-modal panel is needed).
- **Tables** for numeric or time data (Giờ, thị trường): header `text-xs font-medium text-muted-foreground`,
  rows `h-10` with `divide-y`, no vertical cell borders, numbers right-aligned `tabular-nums`. Add the Space UI
  table component from the registry when first needed rather than styling `<table>` by hand.
- **Keyboard hints:** `Kbd` in the search button, in `MenuShortcut`, and in at most the 1-3 main verbs of a
  keyboard-driven list; hidden on touch / below `sm` (`max-sm:hidden` or `pointer-coarse:hidden`). The full
  legend lives behind one "Phím tắt" control, not as a bar of 10 keys.
- **States:** `LoadingCards`/`Skeleton` at the real row or card geometry; `ApiErrorState` (with "Thử lại") when
  nothing loaded, `ApiStaleAlert` when old rows stay; `EmptyState` for empty lists.

## 7. Density and empty states

- **Density follows the task:** triage and lists are dense (40-56px rows, 12-14px text); reading and writing
  (notes, journal, review questions) get air (`max-w-2xl`, `leading-relaxed`). Enlarge the focal content before
  adding anatomy. No empty bands mid-page, no rows spread to fill height.
- **Help text is not content.** Page description <= 2 lines; setup and how-to text (bookmarklet, PWA, keys)
  goes behind a disclosure, a help popover or `/huong-dan/`, never above the main list.
- **Empty state = one message:** `EmptyMedia` icon, title saying what is missing ("Chưa có cơ hội nào"), one
  sentence on what to do, at most one action, which is then the only primary on the screen (the toolbar
  duplicate drops to `outline` or hides). A guide (`EmptyStateGuide`) under it shows the how; it does not repeat
  the sentence. Size the empty box to its content; no tall dashed void.
- **Filtered empty** ("Không có mục nào khớp bộ lọc") shows a "Xóa bộ lọc" link, no guide, no icon art.

## 8. Motion

- Short and caused by the user: hover/press/colour 150 ms (`transition-colors`), popovers and menus 150-200 ms,
  dialogs and sheets the Base UI defaults (<= 250 ms), ease-out in, ease-in out.
- Nothing animates on page load (no staggered list entrances, no count-ups). Lists insert and remove without
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
4. **Flat.** Everything the same weight. *Hôm nay's three equal tiles with an icon heading each; every block the
   same border and radius; Cơ hội showing two identical blue "Cơ hội mới" buttons; Thư viện's selected tab
   filled blue next to the blue "Thêm item".* Fix: one focal block, one primary, quiet tabs.
5. **Bland / slop.** Could be any AI dashboard. *`Sparkles` as the "AI" or "new" marker (`done-output.tsx`,
   `market-page.tsx`), purple accents, eyebrow caps, the same gray card for every object.* Fix: show the
   object's own content (thumbnail, week number, timer, numbers), say what the AI did in words.

## 10. Review checklist (cite by ID; each is checkable on a screenshot)

Take screenshots at 1440 px and 390 px, light and dark, with data and empty.

Hierarchy
- **D1** The eye lands first on the screen's focal object (§1.2), not on chrome, help text or a guide.
- **D2** At most one filled blue button per view region (page toolbar, dialog footer, empty state); none duplicated.
- **D3** One page title (30px); sections 18px; nothing else above 18px except one big number.
- **D4** Page description <= 2 lines on desktop; no setup/how-to text above the main content.

Type
- **D5** No text under 12px (chart ticks 11px and the Inbox count badge excepted); sizes only from §2.
- **D6** Sentence case; no uppercase or letter-spaced labels; no bold 700.
- **D7** Title vs meta reads by weight and colour (foreground/500-600 vs muted/400), not by an extra box.

Spacing and layout
- **D8** Gutters 16px at 390 px and 32px on desktop; all blocks share the page title's left edge.
- **D9** Title-to-meta gap is smaller than record-to-record gap; rows are 32/40/56px, no fat rows.
- **D10** Words sit >= 12px from container edges; no edges 1-3px apart; no element touching another.
- **D11** At 390 px: no horizontal scroll, no clipped label, no orphaned button on its own line.

Containers
- **D12** No bordered or tinted box inside another box (inputs and code excepted).
- **D13** A homogeneous list of more than ~5 records is rows in one container, not a stack of cards.
- **D14** Radii from §3 (`xl` containers, `lg` controls, `md` fills, `sm` badges); nested radii concentric.
- **D15** A container on the page is a surface (border + `bg-card`, D29); inside it, a fill or a divider, not a
  second border; large shadows only on floating layers.

Colour
- **D16** Only token colours; status colours match `lib/labels.ts`, the same status the same colour everywhere.
- **D17** No purple, gradient, glow or gradient text; `bw-red` only on the continue/now marker.
- **D18** AI results carry a plain "tự động" label or prefix; no sparkle, wand, bot or star as an AI marker.
- **D19** Light and dark both read: muted text legible, no hard-coded white/black surfaces, focus ring visible.
- **D29** Surfaces and contrast (§4): grey page, white bordered surfaces (light) / darker page, lighter surfaces
  (dark); border visible; blue only on the primary action, links and focus; focus ring >= 3:1 on page and
  surfaces; no container left transparent on the page.

Icons
- **D20** lucide only, one stroke width, 16px in controls/rows/nav and 14px in badges/meta; no emoji as icons.
- **D21** No decorative icon beside headings or card titles; icon-only buttons have a tooltip.

Components
- **D22** Row actions: <= 3 visible, the rest in a Menu; delete goes through the confirm dialog.
- **D23** View switches are `Tabs`, not filled buttons; filters left, primary action right in one toolbar.
- **D24** `Kbd` hints hidden on touch / 390 px and limited to the main verbs; full legend behind one control.
- **D25** Badges: <= 3 per record, one tag style app-wide, never used as buttons or tabs.

States and motion
- **D26** Empty state: icon, title, one sentence, <= 1 action (the only primary); box sized to its content;
  a guide below adds the how without repeating the text; filtered-empty offers "Xóa bộ lọc".
- **D27** Loading skeleton matches the real geometry; errors use `ApiErrorState` / `ApiStaleAlert` with "Thử lại".
- **D28** Nothing animates on load; transitions <= 200 ms (overlays <= 250 ms); every looping animation stops
  under reduced motion.
