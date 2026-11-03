# Stageshow guides

Animated how-tos for the brain pages: the app's own screens, simplified, played as a short loop with
keycaps or a cursor. Built with the Stageshow kit (MIT, Benji Taylor). The skill that teaches how to build
them is `.claude/skills/stageshow/` (SKILL.md and `references/`). Read it before making a guide; this file
only covers how the kit lives in this repo.

```
components/stageshow/
  kit/              the Stageshow kit, copied from .claude/skills/stageshow/kit/ (LICENSE, NOTICE.md beside it)
  brain-look.ts     the Alex's Brain look: Space UI tokens (app/global.css) -> --ss-* tokens, light and dark
  guides/<name>.tsx one guide per file ('use client', default export), its CSS beside it (<name>.css)
  lazy.tsx          the only thing pages import: one next/dynamic wrapper per guide (ssr: false)
  intro/            the pictures of /gioi-thieu/ (page hero + six bento tiles, pictures.tsx/.css scoped under
                    .ssg-intro); the page imports only intro/lazy.tsx (one shared chunk, ssr: false)
```

Guides today (all 600 x 452 wide, 358 x 470 compact below 560 px):

| Guide | Story | Plays | Shown in |
|---|---|---|---|
| `inbox-triage` | capture a link, the card unfurls, j/k/l/a/o triage to inbox zero | loop, ~15 s | Inbox empty state (tab Inbox) |
| `week-ritual` | carry 2 objectives over, add a third (3-5 hint), R: time chart + the six questions | once, ~12 s | Tuần: a week never opened, or a blank opened week |
| `opportunity-evidence` | create a hypothesis, evidence for (conversation) and against (link), S: 4 scores | once, ~15 s | Cơ hội list empty, no filter |
| `work-timer` | start the timer on a project, time-lapse, T stops, the week summary fills | once, ~10 s | Dự án (no status filter) and Giờ (no filter) empty |
| `skill-freshness` | add evidence to a faded skill, it turns fresh, then 3 and 6 months later it fades | once, ~12 s | Kỹ năng matrix empty |
| `library-item` | add a book, Xong asks for an output, write the note, the reminder leaves | once, ~12 s | Thư viện empty, no filter |

Pages use `EmptyStateGuide guide="..."` from `lazy.tsx`: it wraps the guide in `guides/guide-frame.tsx`, a header
with "Xem lại" (guides that play once) and "Ẩn hướng dẫn" / "Hiện hướng dẫn", remembered per guide in
localStorage (`alex-brain:guide-hidden:<guide>`, every access in try/catch, in-memory fallback). Render it only
when the list is loaded, has no error and is empty without a filter. `/huong-dan/` shows every guide, the Inbox
one too, each through the same frame (so the looping Inbox guide can be hidden there, WCAG 2.2.2); the sidebar
footer and `/gioi-thieu/` link to it. The lazy placeholder switches on its container's width like the Stage
(compact 358 x 470 below 560 px), so the page does not jump when a guide arrives.

Guides and intro pictures import each kit part from its own file (`../kit/stage`, `../kit/motion/Collapse`,
`../kit/controls/Field`...), never from the `kit/index.ts` barrel: the barrel pulls in the CSS of every part
(phone, messages, keyboard, code, chart...), which the bundler does not tree-shake.

The page guides share `guides/parts.tsx` (the app's Badge, Button, Kbd, section card, select, dialog, menu as
faux pieces) and `guides/base.css` (scoped under `.ssg-brain`; each Stage gets `ssg-brain ssg-<name>`). A guide's
own selectors start with `.ssg-<name> .ss-stage` so they beat base.css regardless of CSS order. Notes outside the
product (a time-lapse, "3 tháng sau") are `.g-note` pills, never app UI.

## Adding a guide

1. Write the plan first (SKILL.md, Workflow): where it sits and how wide, the focal object, 3 to 5 beats and
   the payoff, the poster frame. Pick the closest gold example in `.claude/skills/stageshow/examples/`, copy
   its structure (stage size, crop, row and type sizes, beats), then replace look and content.
2. Create `guides/<name>.tsx` with `'use client'`, a default export, and a Stage that spreads the look:
   `<Stage {...useBrainLook()} className="ssg-<name>" ...>`. Import the kit from `../kit`.
3. Put its CSS in `guides/<name>.css` and scope every selector under `.ssg-<name>` (the Stage's className lands
   on the `.ss-fit` wrapper; the stage itself is `.ssg-<name> .ss-stage`, compact is
   `.ssg-<name> .ss-stage[data-layout='compact']`). Keyframes get a `ssg-<name>-` prefix.
4. Add a `dynamic(() => import('./guides/<name>'), { ssr: false, loading })` wrapper to `lazy.tsx` with a
   placeholder of the stage's aspect ratio, and use only that wrapper from pages.
5. `npx tsc --noEmit -p .` and `npx eslint components/stageshow` from `web/`; then look at it in a browser at
   desktop width and at 390 px, in light and dark, and with reduced motion on (System Settings or DevTools
   rendering emulation). Filming with `scripts/film.mjs` needs playwright-core, which this repo does not
   install.

## Rules that matter here

* **Real screens only.** Show what the app does (components/brain/ is the reference): its real labels, its real
  lucide icons, its keys. Never an invented feature, never made-up numbers about the owner's results. Example
  content (a link, an opportunity title) is neutral and obviously an example.
* **Vietnamese on screen,** English in code and comments (CLAUDE.md).
* **Off the home first load.** Pages import guides only through `lazy.tsx`; never import `kit/` or a guide
  from a server component or from anything the home page loads (make check's 220 kB budget).
* **No runtime requests.** No images or fonts from other domains; thumbnails are drawn in CSS, fonts are the
  app's next/font variables (`--font-inter`, `--font-geist`) through the look.
* **Scoped CSS.** The kit's CSS is in `@layer stageshow` and every kit selector starts at an `.ss-*` class; a
  guide's own CSS is unlayered (it beats the kit) and scoped under its `.ssg-<name>` class. Nothing restyles
  the app outside a stage.
* **Every guide has a poster** (`poster` prop): the frame that tells the story on its own. It is what reduced
  motion shows (the kit's `reduced-motion.ts`) and what most people see.
* **Compact design.** Every guide ships a `compact` layout for a 358 px column (a redesign, not a squeeze).
* **Accessible.** Wrap the stage in `role="img"` with a Vietnamese `aria-label` that says what the loop shows.
* **The look comes from `brain-look.ts`.** Tokens point at the app's CSS variables, so a change in
  `app/global.css` reaches the guides. Use `--ss-*` tokens in guide CSS, not raw colors (a drawn thumbnail is
  the exception).

## How the kit was adapted (and what to redo when updating it)

Copy `.claude/skills/stageshow/kit/` again, then reapply:

* Left out: `kit/brands/` and `parts/BrandMark.*` (third-party logos, not needed); their exports are removed
  from `kit/index.ts`, `kit/parts/index.ts` and `kit/stageshow.css`.
* `'use client'` at the top of every kit file that uses hooks or context (all `.tsx` with hooks, `looks.ts`,
  `reduced-motion.ts`).
* A file-level `eslint-disable` for `react-hooks/refs`, `react-hooks/set-state-in-effect`,
  `react-hooks/exhaustive-deps` and `@next/next/no-img-element` where eslint-config-next 16 flags them: the
  kit's latest-value refs and measure-then-set layout effects are deliberate animation patterns. No logic was
  changed.
* lucide-react 1.x has every icon `parts/Icon.tsx` imports; no change was needed.
