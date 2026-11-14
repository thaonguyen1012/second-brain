# Decisions

The product and engineering decisions behind Alex's Brain, in the order they were taken (31/10 to 09/11/2026). They
work as ADRs: code comments cite them by number ("DECISIONS 9.4"), and a session that changes something they settle
reads them first. The author's private notes (personal goals, finances, career plans, quotes) are not part of the
public version; the numbering is kept so the references in the code still point at the right section.

## 1. Goal

* Turn a folder of course handbooks (markdown and HTML notes, in Vietnamese) into one place to study: shared
  navigation, full-text search, a home dashboard, progress per lesson.
* Then grow it into a second brain: books, films, courses, notes, projects, a morning brief, in one place, with a
  structure, not a pile.
* Behind a login; the data belongs to its owner and can be exported at any time.

## 2. Architecture

### 2.1 Settled

* Name: **Alex's Brain**, on one host name of the owner's domain behind Cloudflare Access.
* One monorepo. `web/`: Fumadocs (Next.js App Router, TypeScript, Tailwind). UI in Vietnamese (English added in 9.9),
  code and commits in English, ASCII slugs. `backend/`: Django, for phase 2 (user, progress, notes, inbox, brief).
* Design reference for polish: the Fumadocs site (layout, sidebar, typography, code blocks, search box) in light and
  dark, not its branding.
* UI foundation (01/11/2026): **Space UI** (Community, MIT; Base UI + Tailwind 4), components added with
  `npx shadcn@latest add @spaceui/<name>` into `web/components/ui` and `web/components/spaceui` (`web/components.json`).
  Layout: sidebar + top bar, large-radius cards, two shadow depths. Primary blue #1F6AE0 (dark #6AA5FF), a red-orange
  accent for progress. Fonts through next/font only (Inter for UI, Geist for headings, JetBrains Mono for code),
  never Google Fonts at runtime. Fumadocs reads the same tokens through its `--color-fd-*` map in `web/app/global.css`.
* Handbook text is kept as it is: structure and format change, the words never (no rewriting, no summarising).
* Sources are never deleted or edited by scripts (`raw/` is gitignored; originals stay where they are).
* `ProgressStore`: one interface; localStorage in phase 1, an API store in phase 2 (`API_CONTRACT.md`: same origin,
  session cookie, `X-CSRFToken`).

### 2.2 What the pilot showed

* Course exports are not condensed notes but whole courses: one page per video, reading and quiz. The author's
  corpus was about 18,800 pages for 15 books (video transcripts in `<details>`, many near-empty "do it on the course
  site" pages).
* A pilot static export of one book (2,434 pages): 96 s build, 1.95 GB RAM, 1.9 GB of output (about 640 KB a page,
  the sidebar 75 % of it, repeated in 4 RSC files). Extrapolated: 14 GB, or 1.3 to 1.6 GB after every optimisation.
* Pagefind over everything: about 120 MB of index; the dev server's first page took 40 s.
* Images pointed at signed course-site URLs that had expired: they render as placeholders (2.4).

### 2.3 Architecture changes after the pilot

Static export does not fit tens of thousands of pages, and Cloudflare Pages takes at most 20,000 files a deploy.

* **Next.js in server mode** (`output: 'standalone'`): markdown stays on disk and compiles on request, cached. The
  build no longer grows with the page count.
* Search moved to SQLite FTS5 (`web/data/search.sqlite`, built at import time), later possibly Postgres full text.
* `BUILD_SUBSET=slug,slug` limits the books loaded in dev and UI work.
* Deploy: the Node server on a VPS beside Django, reachable only through a **Cloudflare Tunnel** with **Cloudflare
  Access** in front. Static export stays an optional script, never the deploy target.

### 2.4 Pilot follow-ups

1. **R1**: the sidebar tree of a book loads lazily from `/trees/<book>.json`.
2. **R2**: items are merged into learning units: one page per lesson group (`m2`), per module with parts (`module`),
   or near-empty pages folded into the previous one (`m1`). "Done" is per learning unit, not per video. These merge
   rules are a settled decision: change them only on purpose.
3. **R3**: no client fetch of `index.txt` files (moot in server mode).
4. **R4**: Shiki colours through CSS classes, not inline styles.
5. Images: placeholders that keep the alt text; `backfill-images.mjs` downloads fresh URLs into `web/public/img/<book>/`
   when they exist. Images never block progress.

## 3. Infrastructure, cost, security

* **Cloudflare (free)**: DNS, Access (one-time PIN by e-mail or an identity provider), Tunnel (`cloudflared`) so the
  server opens no port. Access puts a JWT on every request; Django verifies it and needs no password form.
* **One small VPS** for Node, Django and Postgres; a free tier works but can be reclaimed, a paid one is steadier.
  Avoid sleeping free PaaS for an app used every day (cold starts, expiring databases).
* Security principles: private data never in git or on the site (`raw/`, `.env`), no secrets in the build, Access
  in front of everything, no open port, `noindex` and security headers.

## 4. Second brain: model and use

Few types, clear states, one inbox, one search box, an output required.

1. **One data model**: Item (type course, book, film, article, project; status; tags; source; created, started and
   finished dates; rating). A Note is markdown linked to any Items. No deep folder tree: status and tags organise.
2. **Clear life cycle, "done" needs an output**: a film gets a one-line review and a rating, a book highlights and
   three key ideas, a course its lesson progress. Without a note it is not done.
3. **Capture in one touch, process weekly**: one Inbox, the only place allowed to be messy; a bookmarklet and the
   phone's share sheet (PWA) feed it. Fifteen minutes a week: inbox to zero, three priorities for the next week.
4. **UI**: Home is "Hôm nay" (Today: continue learning, the week's priorities, the inbox count, today's brief). One
   page per type with status filters. Cmd+K finds everything. One card style, one set of status colours and tags.
   **At most six areas in the sidebar.**
5. **Build for real needs**: a new type only after 10 real items; until then Item + tag.
6. Build pace: originally one session a week; from 02/11/2026 the remaining steps of 9.4 were built in one go.
7. **The data is the owner's**: export as markdown and JSON at any time (`manage.py export`, `GET /api/export`).
8. Also in the second brain: a brag document updated weekly, predictions re-scored after 6 months.

## 5. Morning brief

* A feed of 15 to 25 hand-picked RSS sources, fetched a few times a day, deduplicated, tagged and summarised in the
  background, built into one brief per morning (5 to 8 stories) on Home. A "useful / not useful" button per story
  feeds the evaluation set. One tap sends a story to the Inbox or makes it evidence for an opportunity.

## 6. Personal growth (what the app supports)

### 6.1 Frame

When AI makes producing text, code and analysis cheap, judgement, taste, trust, distribution, private context and
the ability to combine fields gain value. A test for what to learn: is it still worth it if AI stops improving next
year, and if it improves twice as fast?

### 6.2 Areas

Two deep areas (applied AI; business and practical economics) and four reading areas (psychology and communication;
history and geopolitics; science and data about the world; health). They are the default topics of the morning
brief (`backend/brief/`, `backend/prompts/news_tag.md`); the feeds are configurable (`manage.py brief_sources`).

### 6.5 Portable value

Four assets that move with a person: lasting fundamentals, verifiable evidence (shipped work, case studies with
numbers, public writing), reputation, a personal operating system (habits of learning, writing, health). The app's
rhythm follows it: weekly a note and the brag document; monthly a book; quarterly something shipped and a case
study. The week review counts these (notes, achievements, predictions due; `rhythm` in the review API).

## 7. and 8. (private)

The author's checklist and the prompt of the next session; not part of the public version.

## 9. The all-in-one app (01/11/2026, extends 4 to 6)

### 9.1 Principles

* **The weekly review (15 minutes) is the app's backbone.** Everything feeds it or comes out of it; a feature that
  cannot change a decision in that review is not built. It asks: is the inbox at zero, are last week's priorities
  done, what changed my mind, which opportunity gained evidence, what are next week's priorities.
* **"Not falling behind" is not a number.** It is a mirror: a skill matrix whose evidence fades with time, compared
  with the real market (job ads, new AI tools).
* **No calendar, no task manager.** Daily tasks live in the owner's own tools; the app holds the week's plan and
  review.
* A project has a client and a price; a finished project is a case study with numbers.

### 9.2 New objects (beyond Item, Note, Inbox, DailyBrief)

* **Opportunity**: a one-sentence hypothesis (who, what hurts, what they pay for), why now, evidence for and
  against (brief stories, notes, real conversations, links), four self-scores 1 to 10 (opportunity, pain,
  feasibility, timing) with history, fit (Skills), next action, a decide-by date (keep, drop, build). An opportunity
  without new evidence for 4 weeks is flagged stale. Topic counts in the brief per week replace a trend tool.
* **Week**: two rituals. Planning: last week's objectives, carry over the unfinished, 3 to 5 objectives, an
  expectations journal; no tasks. Review: objective progress, hours on objectives against other hours, the body of
  work per day, six fixed questions (biggest win, what pulled time away, what I learned, am I satisfied, what changed
  my mind, which opportunity gained evidence).
* **Project** (an Item type) + **TimeEntry**: client, fixed or hourly price; time entries by hand or timer. Gives the
  effective hourly rate (non-billable hours included), non-billable hours this week, the week chart. No invoices, no
  CRM.
* **Skill**: evidence links (shipped work, case study, article) with dates; no new evidence for 6 months and the
  skill fades. Staleness shows as colour, never as a self-rating.
* **Market**: paste the job ads of the target role monthly; the LLM extracts the skills asked for, counted per month,
  compared with Skill: "what the market asks that I have no evidence for". New-tool stories of the brief land here.
* **Inbox**: each entry gets tags, a one-line summary and a suggested destination from the LLM; the review walks it
  by keyboard, one key one decision.
* **AI in one place** (phase 3): a review assistant reading the week's notes, items and brief.

### 9.3 Six areas in the sidebar

Hôm nay · Tuần · Phát triển (handbooks, roadmap, skills, market, achievements) · Thư viện (items, notes) · Cơ hội ·
Công việc (projects, time). The Inbox is a top bar button with a count; the brief lives on Hôm nay. Layout (04 and
06/11/2026): labelled groups, one icon per row in the text colour, row counts from `GET /api/counts`, a grey sidebar
with a darker grey current row, three tiers parted by hairlines, "Khác" (About, Guides) at the bottom.

### 9.4 Build order (settled 01/11/2026, all built)

1. Inbox + minimal Item (AI tags and summary from the start)
2. Week: planning + review
3. Work: Project + TimeEntry
4. Opportunity
5. Growth: Skill + Market
6. Morning brief in the app

### 9.5 Open

* A study-streak heatmap needs dated progress; today the store keeps `true`. Changing it changes API_CONTRACT.md.
* Code references: prefer open-source apps whose source can be read (Karakeep for the inbox and AI tags, Kimai for
  time and rates, Miniflux for RSS, Plane for projects, AFFiNE for the note editor ideas, 9.6).

### 9.6 Notes, pictures and boards (07/11/2026)

AFFiNE's UX ideas, not its code: its editor stores Yjs, not markdown (against 4.1 and 4.7), the npm package lags the
app, it is heavy and themed, and running it beside the app splits the data. Its enterprise-licensed packages are not
copied from.

Built: note templates per Item type; one shared board for Projects and Library (lanes by status, drag and drop, a
"move to" menu); one picture per Item (upload shrunk to webp, or fetched from the link's OpenGraph image by a job,
or the inbox thumbnail reused; never a runtime request to another domain); a logo for projects (uploaded) and
tools (their site's icon, 9.10); pictures in the
export (`images/`) and the backup (`backups/thumbs/`, never deleted). Status changes set `started_at`/`finished_at`.

### 9.7 Home hierarchy (07/11/2026)

Three tiers: the resume hero is the one heavy block with the page's one filled button; "this week" (the 7-day strip,
the page's one big number, the priorities) second; inbox, handbooks, roadmap, brief and predictions as light rows
third. Empty tiles are one line; the setup checklist never pushes content when it loads; progress bars only where
they carry the meaning. Acceptance: blurred at 1280 px the hero is the heaviest area; one filled button above the
fold at 1280x720 and 390x844; no layout shift; `make check` and the JS budget hold.

### 9.8 Item page and notes, AFFiNE style (07 to 09/11/2026)

* Clicking an Item opens a peek view (a Sheet beside the list) with a button to the full page
  (`/thu-vien/item/?id=N`). The Item page: picture and properties, the "done but no output" hint, **every note of the
  Item inline**, newest first, editable in place, a composer prefilled with the type's template, and "Mentioned in"
  (opportunities and skills that use the Item as evidence, notes that link it).
* Editor: block editing like AFFiNE (`/` menu, markdown shortcuts, task boxes) with **Milkdown 7**, still saving
  **markdown** (light normalisation accepted, content never changed). Loaded only where used, never on Home.
* Autosave like AFFiNE: after a pause, "Saved"; at once when leaving (keepalive); each editor keeps its own copy in
  the browser until the server has it; a new note carries a `clientId` (no duplicate on retry); each edit carries
  `baseUpdatedAt` (409 when it was saved elsewhere: the newer note shows, the typed text becomes a recoverable copy).
* `[[` links to items, notes, opportunities and skills, stored as readable markdown links
  (`[Title](/thu-vien/item/?id=12)`); the backend reads them into a NoteLink table on every save, exactly where the
  reading view shows a link (CommonMark + GFM; never in code, HTML or images). A link to an Item attaches the Item.
* The notes page has a "by Item" view. Notes are never sent to an LLM.

### 9.9 English version (08/11/2026)

* Two UI languages: Vietnamese (default, the language in the code) and English; an EN/VI switch in the top bar.
* Same URLs: the cookie `lang` picks the language; rewrites in `web/next.config.mjs` send `/x/` to the prerendered
  `/vi/x/` or `/en/x/` (`web/app/[lang]/`); `/en/...` opens English directly.
* Not translated: handbook content, the owner's data, LLM output, the PWA manifest.
* Convention: the Vietnamese text in code is the key (`t('Lưu')`), the English lives in `web/lib/i18n/en/`
  (`web/lib/i18n/README.md`); `lib/i18n/coverage.test.ts` fails on any UI text without English. British English.
* Django answers in the page's language (`X-UI-Lang`, else the cookie); background jobs stay Vietnamese.

### 9.10 Tools page (13/11/2026)

* A tool is an Item of type `tool` (no new model), so notes, Cmd+K, `[[ ]]` links, the logo and the status come with
  it. The page `/phat-trien/cong-cu/` sits in the Growth group of the sidebar; the Library still lists every type.
* Every Item gains `summary`: one line on what it is, for a tool "what it is for"; in the API, `?q=` and the export.
* Stages are tags from one fixed list (`web/lib/tools.ts`, the same slugs in `backend/library/tools.py`), learning
  first: reading and dissecting codebases, learning by doing, then plan, code, interfaces and UI libraries, review,
  test, security, dependencies, git, CI/CD, observability, data, AI and docs. A tool shows under each of its stages,
  "Other" without one.
* A tool's statuses read Want to try / In use / Mastered / Dropped (the shared four statuses of an Item).
* A tool's picture is a logo, which the server fetches from the tool's official site (13/11/2026; it was uploaded
  by hand before). Never the site's OG image, which is a banner.
  - The `item_image` job (run by `run_jobs`, every request through `safe_fetch`) reads the page's apple-touch-icon
    and icon links (inline `data:` icons too), the raster icons of its web manifest, then `/apple-touch-icon.png`
    and `/favicon.ico`. It takes the first of 64 px or more, else the largest of at least 32 px; with none, a square
    og:image or an `<img>` the page names as its logo. No SVG, no dark-scheme icons, not Read the Docs' or mdBook's
    default icons. Stored as webp of at most 256 px, never enlarged, transparency kept, wide margins trimmed.
  - GitHub links: the GitHub API (no token, 60 requests an hour) gives the repository's homepage, whose icon is
    taken (a person's repository only when the homepage names it); else the avatar of an organisation that is the
    tool itself (its login is the repository's name). An umbrella organisation's mark or a person's face is never
    a tool's logo. At the hourly limit only the GitHub jobs wait for the reset; other pictures go on.
  - Stores: the VS Code Marketplace, the Chrome Web Store and GitLab give the item's own icon; npm, PyPI and similar
    stores give none.
* When: creating a tool with an http(s) link, or a new link while it has no logo, so `seed_tools` queues one per new
  tool; `manage.py fetch_tool_logos [--owner EMAIL] [--again]` queues the tools that have a link and no logo, and
  skips those whose site had none last time unless `--again`. The dialog offers "Lấy logo từ trang" (fetch the logo
  from the site); an upload always wins; when a fetch found nothing, the field says so and asks for an upload
  (`imageMissing`, every type). A project's logo is still only uploaded. Until there is a logo, the row shows its
  stage's lucide icon: ink colour, no colour per stage, no tile.
* Two views: the list of rows, and a grid of cards (`?view=grid`, remembered per browser) with the logo or the
  section's icon, the name, the summary, the status and the site link; the same sections and filters in both.
* An "Interfaces & UI libraries" stage (`ui`, after code) holds UI and animation libraries and UI references; UI
  courses sit under learning by doing. Entries taken from a curated list written around 2023 were checked against
  their state in November 2026: renamed ones under their current name (Framer Motion is Motion, Godly is Recent),
  dead, unmaintained or CSS-replaced ones left out (Fig, Vaul, React Wrap Balancer, Tremor).
* `manage.py seed_tools` adds 111 well-known tools (summary, official link, stages) for the owner when they choose to
  run it; it never overwrites a tool they already have, so running it again only adds the new ones.

### 9.11 Accessibility (13/11/2026)

* The rules of the `fixing-accessibility` skill (ibelick/ui-skills, MIT, a copy in `.claude/skills/`) apply on top
  of `web/DESIGN.md`; the patterns they settled are in DESIGN.md §4-§6.
* Two passes, each checked with axe-core (WCAG 2.2 AA) on fixtures and by keyboard: names for every control (row
  menus and repeated row buttons named after their record), loading states and notices read out, form errors tied to
  their fields, a skip link with one `<main>`, a banner and a whole nav, view switches tied to their tabpanel, a
  switch that turns single-key shortcuts off (WCAG 2.1.4), a hoverable and dismissible chart tooltip, links in text
  underlined, text in the guide pictures at 4.5:1, and the focus kept on a row after a delete.
* The third pass (13-14/11/2026): accessible names start with their visible text (WCAG 2.5.3), Escape from an add
  dialog gives the focus back to its opener, focusable scroll areas and links in truncated lines show their whole
  ring, the focus shows in forced colours (Windows contrast themes), and while single-key shortcuts are off the key
  hints and the list cursor are hidden; the switch is also a Cmd+K command, first only when the query names it.
* The destructive red #fb2c36 (error text, the filled "Xóa") stays at 3.8:1 on white, under WCAG's 4.5:1: the
  owner's decision (13/11/2026); its 4 axe nodes are accepted and the token is unchanged. Help content that teaches
  single keys (the guides, /huong-dan/, /gioi-thieu/) keeps showing them while the switch is off, on purpose.
* The lesson code colours stay as they are (Shiki's github-light / github-dark, Fumadocs' default), although two miss
  4.5:1: the orange #e36209 in light (3.49:1) and the comment grey #6a737d in dark (3.83:1). The owner chose this
  after comparing three options (replace those two colours, GitHub's -default themes, its -high-contrast themes) on
  14/11/2026; their axe nodes on lesson pages are accepted and the themes are unchanged.
* Colour tokens and the registry components are not changed by these passes.

## 10. Engineering standards for phase 2 (01/11/2026)

### 10.1 Foundations

* **Postgres from the start** (SQLite only for the handbook search index). Nightly `pg_dump`, encrypted to object
  storage on a server, a monthly restore drill (`make backup`, `make restore-check`).
* A conversation agent (Telegram, MCP) may come later as a surface only: pipelines run in Django with direct LLM
  calls so they can be tested and costed; the agent owns no data.
* **A hard API budget: 5 USD a month** (`LLM_MONTHLY_BUDGET_USD`); past it, background AI jobs stop.
* TypeScript pinned to 5.9 in `web/` until typescript-eslint supports the next major; lint must run.

### 10.2 Performance

* Django: indexes on `(type, status)` and `(created_at)`; `select_related`/`prefetch_related` in list views; cursor
  pagination.
* Next: server components for content, client code only in the shell and interactive parts; **home First Load JS
  at most 220 kB gzip** (checked by `make check`, `web/scripts/check-budget.mjs`); build under 5 minutes.
* **No LLM call inside a user's request.** Background work is a `Job` table plus a management command run by cron;
  no Celery or Redis yet.
* Link thumbnails stored locally as webp of at most 200 KB at ingest; files through nginx `X-Accel-Redirect`.

### 10.3 Harness

* One command, `make check` = typecheck + lint + unit tests + backend checks + smoke + JS budget, run by the lefthook
  pre-commit hook.
* Tests: Vitest for `web/lib/` (and `web/scripts/`), Playwright flows in `web/e2e/` (home, lesson, search, dark mode,
  language, boards; `make e2e`, needs the running stack); pytest-django with a test per API_CONTRACT.md endpoint.
* One source of truth for the API: drf-spectacular -> OpenAPI -> TypeScript types in `web/lib/api/` (the only backend
  caller).
* AI harness: prompts are versioned files in `backend/prompts/`; every LLM output is JSON validated by pydantic;
  golden sets of real inputs asserted in code (`manage.py eval tag|jd|brief`) before any prompt or model change; every
  call logged in `LlmCall` (purpose, model, tokens, cost, latency, ok).
* Operations: `/healthz`, JSON logs, reversible migrations, idempotency keys for cron jobs.

### 10.4 API cost

* Cheap models for tagging, summaries, job ads and the brief; no top-tier model by default.
* Deduplicate RSS by a hash of title + URL before the LLM; cache results by content hash; send only the title and
  the first 500 characters; count tokens before sending.
* **Provider (02/11/2026): the Gemini API free tier for now**, Claude later. Every call goes through
  `backend/core/services/llm.py`; `LLM_PROVIDER=gemini|anthropic` picks the provider, so switching is one branch in
  that file. The budget guard always counts paid prices, so a project that silently becomes billed stays capped. The
  free tier may use what is sent to improve its products: only titles and the first 500 characters are sent, never a
  private note; jobs survive 429s (retried on the next run).

### 10.5 Security

* Only cloudflared reaches nginx; no public port. Django verifies `Cf-Access-Jwt-Assertion` and maps it to one user.
  Cookies `Secure`, `HttpOnly`, `SameSite=Lax`; CSRF as in API_CONTRACT; CSP from nginx, report-only first.
* URL ingest: SSRF guard (public IPs only, limited redirects, timeout, size cap), HTML sanitised with `nh3`, rendered
  through `rehype-safe-html`. Uploads: size limit, content sniffing, stored outside the web root.
* Prompt injection: web, RSS and chat content is data; LLM output is never executed; agent tools on an allowlist.
* `.env` outside git, pinned lockfiles, `npm audit` and `pip-audit` monthly, encrypted backups.

### 10.6 Clean code

* Boundaries: Next only renders; Django owns the data; `web/lib/api/` is the only backend caller.
* Django: logic in `services/`, thin views; `ruff` + `mypy --strict`. TypeScript `strict`. UI from the Space UI
  registry rather than hand-written.
* No premature abstraction. ADRs = this file. Small commits, one thing each.

### 10.7 OpenGraph

The site sits behind Access, so it needs no OpenGraph of its own. OpenGraph is read the other way: Django reads
`og:title`, `og:description`, `og:image`, `og:site_name` of links dropped in the Inbox to build their cards.

### 10.8 Conversation agent (later)

Django would expose an MCP server with an allowlist (`inbox.add`, `items.search`, `brief.today`, `week.current`,
`opportunity.add_evidence`); a chat agent and coding agents would be its clients. Not built.

### 10.9 Coding-agent skills per step

Review and security review before each phase 2 commit; simplify after each step; the project's Stageshow skill for
the animated guides (`.claude/skills/stageshow/`).
