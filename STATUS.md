# STATUS.md: where the project is right now

Several coding-agent sessions can work on this repo at the same time. CLAUDE.md is only loaded when a session
starts, so read this file and `git log --oneline -20` **before starting any piece of work and before saying what
exists**. Update it in the same commit as the work (rules in CLAUDE.md).

## In progress

Add a line before you start: date, session or branch, what you are doing, the files you will touch. Remove the line
in the commit that finishes the work.

## Done

* Tool logos (13/11/2026, DECISIONS 9.10, DESIGN.md §9a): the `item_image` job takes a tool's logo from its official
  site's icon (`backend/core/services/site_icon.py`), GitHub links through the repository's homepage or the avatar of
  an organisation that is the tool (`backend/library/logos.py`); at GitHub's hourly limit only those jobs wait.
  `manage.py fetch_tool_logos` queues existing tools, `seed_tools` new ones; "Lấy logo từ trang" in the dialog;
  `imageMissing` says when a link gave no picture. A live run on the 111 starter tools gave 87 logos.
* Accessibility, two passes (13/11/2026, DECISIONS 9.11, DESIGN.md §4-§6): the `fixing-accessibility` skill in
  `.claude/skills/`; controls named after their record, loading states and notices read out, form errors tied to
  their fields, a skip link and landmarks, view switches tied to their tabpanel, a switch for single-key shortcuts,
  the week chart tooltip, links in text underlined, guide picture contrast, focus after deletes. axe over 63 page
  states: 384 → 336 nodes, no new ones. Open: label-content-name-mismatch on the sidebar count rows and a few
  buttons, the destructive red at 3.8:1, focus after Escape in four dialogs, the Item Sheet's scroll area focus ring.
* Tools page, grid view and UI stage (13/11/2026, DECISIONS 9.10): a List / Grid switch; an "Interfaces & UI
  libraries" stage; 111 seed tools, each new one checked against its current state.
* Tools page (13/11/2026): tools engineers use at each stage of the work, and tools to learn by reading code and by
  doing, as Items of type `tool` on `/phat-trien/cong-cu/` (DECISIONS 9.10): a section per stage with its icon,
  status and stage filters, a one-line `summary` on every Item, `manage.py seed_tools` with 86 tools. Commits: Add the
  tool Item type and a one-line summary on every Item; Add manage.py seed_tools with 86 well-known engineering
  tools; Show tools in the library with their own status words, stages and summary; Add the Cong cu page under
  Growth, tools grouped by stage; Show the icon of the row's group on the Cong cu page.
* Security fixes (11/11/2026): the findings of a full audit, fixed with tests: raw HTML inside admonitions and code
  is sanitised and only Shiki styles are lifted; background fetches and jobs have time limits and map every parser
  error; week GETs write nothing (`id: null` until the first write); `Cross-Origin-Resource-Policy`, a login for
  `/api/schema/`, a Host check and `/files/` routing in the dev proxy; unknown `/docs/` paths answer 404 before
  rendering (`web/proxy.ts`); the importer stays inside the book folder; stale writes and a shared-image race are
  fixed; KaTeX 0.19 throughout; the systemd example runs the release from a root-owned copy with secrets in
  `/etc/brain` and own users. SECURITY.md has the threat model.

* Public MIT version (10/11/2026, branch `claude/nice-meitner-4s7b3q`, published as `public-history`): the app runs
  with no handbooks (first-run states, the roadmap as `content/roadmap.json`, programs in `content/courses.json`), one
  original sample handbook (`web/examples/sample-handbook/`) and a sample roadmap, import from a markdown folder, the
  LLM prompts read the reader from `READER_PROFILE`, public docs (README, LICENSE, CONTRIBUTING, SECURITY, NOTICE),
  generic deploy examples (Docker, systemd, launchd). Commits: Make the app run with no handbooks and remove the
  private content; Add an original sample handbook and a sample roadmap; Import a handbook from a folder of markdown;
  Write the public docs: README, licence, contributing, security, notices; Use neutral examples for the tags, feeds
  and golden sets; Read the roadmap from ROADMAP_FILE, set by npm start and the deploy examples.
* Phase 1, the study site: Fumadocs in server mode, the importer (GitBook zip, single HTML, markdown folder; merge
  rules m2 / module / m1), SQLite FTS5 search, lazy sidebar trees, progress per lesson, the roadmap page.
* Phase 2, the second brain (DECISIONS 9.4, all six steps): Inbox + Item, Week, Projects + time, Opportunities,
  Skills + Market, the morning brief; notes with the Milkdown editor, autosave and `[[ ]]` links; the Item page;
  List/Board views; pictures per Item; export and backups; English UI (DECISIONS 9.9).

## Not done yet / open

* Tool logos: about 1 starter tool in 5 gets none (a person's repository, a site that blocks robots, only tiny or
  SVG icons): upload those by hand. The GitHub API is called without a token (60 requests an hour).
* English follow-ups: on English lesson pages the book's name in the frame (breadcrumb, book switcher, footer, the
  root page's h1 and `<title>`) is the Vietnamese meta.json title; Fumadocs' sr-only "Copy Anchor Link"/"Copy Text"
  sit inside the lesson's `lang="vi"` body; at 320 px or 125 % text the top bar can scroll sideways.
* e2e `boards.spec.ts` can be flaky: it checks the answered PATCHes right after the drag; `expect.poll` would fix it.
* Opportunity and skill pages do not list the notes that link them yet (NoteLink has them).
* Item images: no prune command for files orphaned by deletes outside the services (admin, `queryset.delete()`);
  set one absolute `THUMBS_DIR` when several checkouts share a database.
* Light-mode error text (`--destructive-foreground`) is 3.8:1 on white, under 4.5:1.
* Dev Postgres can reach `max_connections` with many `runserver` threads (`CONN_MAX_AGE=60`): restart Django.
* Deploy: config exists in `deploy/` (Docker and systemd variants), neither has been run end to end. Encrypted dumps
  on object storage are not done (DECISIONS 10.1).
* `LLM_PROVIDER=anthropic` is not implemented yet (DECISIONS 10.4); Gemini is the only provider.
* Telegram / MCP server (DECISIONS 10.8): not started. Learning-streak heatmap: needs dated progress (9.5).

## Dev servers (usual ports)

Next :3000 (`npm run dev`), Django :8000 (`make backend-dev`), dev proxy :8080 (`node web/scripts/dev-proxy.mjs`), or
everything at once with `make dev` (http://localhost:8080). A Django started before a backend change keeps serving
the old routes: restart it.
