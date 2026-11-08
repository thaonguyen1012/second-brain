# Architecture

## Phase 1 (now): Fumadocs app in server mode

```
browser ──> Next.js (standalone, Node)          web/
              ├─ /                 home dashboard (static)
              ├─ /lo-trinh/        roadmap (static)
              ├─ /docs/**          lesson pages: markdown read from CONTENT_DIR, compiled on request
              │                    (@fumadocs/mdx-remote), cached in memory + Next ISR cache
              ├─ /trees/<book>.json  full sidebar tree of one book (lazy sidebar)
              ├─ /api/search       SQLite FTS5 (node:sqlite, read-only) at SEARCH_DB
              ├─ /original/*.html  original single-file handbooks
              └─ /files/**         attachments (dev only; production: nginx, see below)
```

* Content: `web/content/docs/<track>/<book>/` plain markdown + `meta.json`, produced by
  `web/scripts/import-gitbook.mjs`. The server scans frontmatter at start; bodies compile on demand.
* Search index: `web/data/search.sqlite`, built at import time or by `npm run search:rebuild`, never at start.
* Progress: `web/lib/progress/` — `ProgressStore` interface, phase 1 implementation in localStorage.
* No runtime request leaves the origin: fonts self-hosted by next/font, Mermaid served from `/vendor/`,
  KaTeX CSS bundled, images from expired Coursera URLs replaced by server-rendered placeholders.

## UI languages (Vietnamese, English; DECISIONS 9.9)

```
browser /thu-vien/  (cookie lang=en)
   └─ next.config.mjs rewrites (afterFiles) ─> /en/thu-vien/  app/[lang]/(home)/thu-vien/page.tsx, prerendered
      (no cookie or another value ─> /vi/...; /en/... and /vi/... open directly; /api/, /trees/, /files/ and
       public/ files are not rewritten)
```

* Every page lives under `web/app/[lang]/` (the root layout is `app/[lang]/layout.tsx`, `<html lang>`); both
  languages are prerendered, lesson pages render on request once per language (the MDX compile cache is keyed by
  language, only the image and embed placeholders differ). Not a `proxy.ts`: with `HOSTNAME=127.0.0.1` Next 16
  takes a proxy's rewrite for an external URL.
* `web/lib/i18n/`: the Vietnamese text in the code is its own key, `t('Lưu')`; server components read the language
  from `next/root-params` (`getT()`), client components from a context (`useT()`). The root layout sends the
  English dictionary inside the RSC payload of English pages only, so no JS bundle carries English and Vietnamese
  pages carry no dictionary; the lazily loaded Stageshow guides and intro pictures import their own. Paths come
  from `useAppPathname()` (the language stripped), so server and browser render the same sidebar; a page that
  writes its own URL (`router.replace`/`push`) uses `useRoutePathname()`, the browser's path, so `/en/...` stays
  English.
* The switch (top bar; Fumadocs' language select on lesson pages) sets the cookie and reloads the page.
* Django answers in the page's language: `lib/api/client.ts` sends the page's `<html lang>` as `X-UI-Lang`, and
  `core.middleware.LanguageMiddleware` activates `en` when that header (else the cookie) says so (Django's and
  DRF's messages); the app's own messages go through `core.i18n.tr`.
* `lib/i18n/coverage.test.ts` (Vitest) and `core/tests/test_i18n.py` (pytest) keep both catalogues complete.

## Phase 2: Django + deployment

Status: `backend/` scaffolded (Django 5.2, DRF, drf-spectacular, psycopg 3, django-environ; uv). Dev: Postgres 16
on localhost:5432 (Homebrew or `backend/docker-compose.yml`), `make backend-dev` on :8000. `/healthz` checks the
database; logs are one JSON object per line on stdout. Auth: `core.middleware.AccessAuthMiddleware` maps every
request to the single owner and keeps a Django session; `AUTH_MODE=dev` (refused unless `DEBUG=true`) trusts
`DEV_USER_EMAIL`, `AUTH_MODE=cf_access` verifies `Cf-Access-Jwt-Assertion`. DRF answers 401 when anonymous and
enforces CSRF (`X-CSRFToken`) on unsafe methods.

Progress API (API_CONTRACT.md) is implemented in `backend/progress/` (models `PageProgress`, `LastVisited`;
unknown books = not a directory under `CONTENT_DIR/<track>/`). drf-spectacular serves OpenAPI at `/api/schema/`;
`make api-types` writes `web/lib/api/openapi.yaml` and `schema.ts`. Build the web app with
`NEXT_PUBLIC_PROGRESS_STORE=api` to use `ApiProgressStore` (optimistic writes, last-visited debounced 1.5 s,
reload on tab focus). The old localStorage progress is never copied silently: `lib/progress/migration.ts` +
`components/progress-migration.tsx` (see "Switching your own dev server to the API store" below).
Second brain, step 1 (DECISIONS 9.4): `backend/library/` has `Item` (course/book/film/article/project, status
planned/active/done/dropped, tags as a Postgres array, rating 1-10) and `Note` (markdown, M2M to Item; API since
the UI step: `GET/POST /api/notes` with `?q=` (icontains on title or markdown) and `?item=`, `GET/PATCH
/api/notes/{id}`, `items` = ids of the owner's Items; note bodies are never sent to an LLM);
`backend/inbox/` has `InboxEntry` (url or text, triage status inbox/later/archived, optional linked Item, OG unfurl
fields, LLM suggestions, `processed` + `error`). Endpoints `GET/POST /api/items`, `PATCH /api/items/{id}`,
`GET/POST /api/inbox`, `PATCH /api/inbox/{id}` (cursor pagination, newest first). Django admin is the first UI.
Ingest returns at once; `POST /api/inbox` with a URL enqueues an `unfurl` Job. `manage.py run_jobs` (cron; the
`jobs` service in deploy/) fetches the page through `core/services/safe_fetch.py` (SSRF guard), stores the OG
card as plain text and the og:image as a re-encoded webp in `THUMBS_DIR`, served by
`/api/inbox/{id}/thumbnail` through X-Accel-Redirect to nginx `/internal/thumbs/` (Django streams it in DEBUG;
`core/views.thumbnail_response`, shared with the Item image, below).
After the unfurl (or at once for text), a `tag` job asks the LLM for tags, a one-line summary and a destination
through `core/services/llm.py`, the only LLM caller: it counts tokens, refuses the call when the month's cost plus
the estimate passes `LLM_MONTHLY_BUDGET_USD`, calls the provider with a JSON schema, validates the reply with
pydantic and logs every attempt in `LlmCall`. Valid results are cached by content hash (`LlmCache`). Provider for
now: Gemini free tier (`LLM_MODEL=gemini-3.1-flash-lite`, cost recorded as 0, tokens kept); a 429 leaves the job
pending for the next run. Only the title, site name and first 500 characters are sent.
Step 2 (DECISIONS 9.4): `backend/weeks/` has `Week` (one per Monday in Europe/Prague, unique per user, DB check
that it is a Monday; planning journal, the six review questions as text, `planned_at`, `reviewed_at`) and
`Objective` (title, open/done/dropped, position, `carried_from` self FK; one carry per source and week). Planning:
`GET /api/weeks/{start}/plan` lists the open objectives of the latest earlier week, `POST` carries the chosen ones
(idempotent) and saves the journal. Review: `GET /api/weeks/{start}/review` counts objectives by status and lists
the body of work per day from existing rows (inbox entries archived = status archived by `archived_at`, which
`inbox/services.triage_entry` sets on the change to archived and clears when the entry leaves the archive; the
migration backfilled older archived rows from `updated_at`; Items by
`finished_at`, `PageProgress` done by `updated_at`) plus the minutes of time entries per day, split into "for this
week's objectives" and "other", with minutes per objective (the review chart). No tasks.
Step 3 (DECISIONS 9.4): `backend/work/`. A project stays an `Item` with type=project; `ProjectDetails` is a OneToOne
on it (primary key = item id) with client (free text), billing fixed/hourly, agreed `price` or `hourly_rate` (DB
check: hourly needs a rate), currency (default CZK). A project Item made through `/api/items` without details reads
as fixed with no price; the first `PATCH /api/projects/{id}` creates them. `TimeEntry` (user, project Item, date,
minutes, billable, note, optional `weeks.Objective`) is typed in or timed: a running timer has `started_at` and
`minutes` null, a partial unique constraint allows one per user, starting a new one stops it (whole minutes, at
least 1). `GET /api/projects` annotates minute totals in one query; `work/services.py` computes `earned` (price, or
billable hours x rate) and the Harvest-style effective rate = earned / all hours including non-billable.
`GET /api/time-entries/summary?week=` gives billable vs non-billable minutes per project. `DELETE
/api/time-entries/{id}` removes an owner's entry (a running timer is discarded). No invoices, no CRM, no
Kimai rate tiers yet (DECISIONS 4.5).
Step 4 (DECISIONS 9.4): `backend/opportunities/`. `Opportunity` (title, one-sentence hypothesis, why now, next
action, `decide_by`, decision open/keep/drop/build, `decided_at`) is Alex's own niche hypothesis. `Evidence` (kind
inbox/item/note/conversation/link, stance supports/contradicts, title snapshot, url, note, date) links to an
`InboxEntry`, `Item` or `Note` of the same owner (DB checks: a link only with its kind; one row per inbox entry and
opportunity) or records a real conversation or an external link (the future morning-brief button, step 6, uses
kind link). `ScoreSnapshot` holds the four self-scores (opportunity, pain, feasibility, timing, 1-10, DB check);
it is append-only and the newest row is the current score. `services.opportunities()` annotates evidence counts,
last evidence, current scores (subqueries) and `stale` in one query: decision open or keep and no evidence
recorded (`created_at`, not the evidence date) for 4 weeks, counted from creation when there is none. The week
review adds `opportunities.withEvidence` (evidence recorded that week) and `opportunities.stale` (as of the week's
end or now). `POST /api/opportunities/{id}/evidence/inbox` attaches an inbox entry and archives it (idempotent).
"Fit" (`Opportunity.fit`, M2M to `growth.Skill`, owner checked) came with step 5.
Step 5 (DECISIONS 9.4): `backend/growth/`. `Skill` (display name, normalised `key` unique per owner, normalised
`aliases`, note; no self-rating) and `SkillEvidence` (kind item/note/link, a library `Item` (a work project is an
Item of type project) or `Note` of the owner, or an external URL; title snapshot, `date`). Freshness is computed
by `services.with_freshness()` from the newest evidence `date` (when it happened, not when it was recorded): fresh
within 3 months, aging within 6, faded after 6 months or with no evidence (DECISIONS 9.1, 9.2). `JobAd` (title,
company, url, pasted text, `month` = first day, DB check) enqueues a `jd_skills` job (key includes a hash of title,
company and text, so an edit re-runs it); `growth/extraction.py` sends title, company and the first 4000 characters
(job ads are public, unlike the 500-character cap for private inbox content; never the URL) with
`prompts/jd_skills.md` through `llm.complete()`; the pydantic `JdSkills` schema accepts 1-15 short normalised skill
names and a seniority; invalid output leaves the ad unprocessed with `error`, 429/budget leaves the job pending.
Skills can be corrected by hand (`skills` in PATCH skips the job). `GET /api/market/report?month=` counts, per
skill, the processed ads of the month that ask for it (once per ad) and of the previous month, matched to `Skill` by
exact normalised name or alias (no fuzzy matching, DECISIONS 4.5); a gap is a requested skill with no Skill row or
a faded one. `manage.py eval jd` runs `backend/evals/jd_skills/`. No RSS from job boards yet.
Brag document and predictions (DECISIONS 4.8) also live in `backend/growth/`. `Achievement` (date, title,
description, impact text with numbers, optional project `Item` (type project, owner checked), M2M `Skill`):
`GET/POST /api/achievements` (`?week=<Monday>`, newest date first), `PATCH /api/achievements/{id}`; the week review
adds `achievements` (dated in the week, oldest first). `Prediction` (statement, `made_on`, `check_on` default
`made_on` + 6 months via `services.months_after`, DB checks: check_on >= made_on, confidence 1-10 or null; outcome
open/right/wrong/partial; `scored_at` follows the outcome): `GET/POST /api/predictions` (`?due=true` = open and
`check_on` <= today in Prague, `?outcome=`), `PATCH /api/predictions/{id}` to re-score. No LLM involved.
Step 6 (DECISIONS 9.4, 5): `backend/brief/`. `Source` (name, feed URL, area of DECISIONS 6.2, active; added in the
admin or with `manage.py brief_sources add|seed|list|activate|deactivate`; `seed` adds only feeds of sources 6.2
names). `run_jobs` first calls the `jobs.periodic` schedulers: when an active source exists it enqueues the latest
due fetch slot (`feeds:2026-11-02T06`, hours `BRIEF_FETCH_HOURS`, default 6/12/18 Prague) and, from
`BRIEF_BUILD_TIME` (06:30), `brief:2026-11-02`; idempotency keys make the 5-minute cron enqueue each once. The `feeds`
job fetches every active source through `safe_fetch` (`FEED_TYPES`: rss+xml, atom+xml, xml, text/xml; 2 MB cap),
parses RSS 2.0 / RSS 1.0 / Atom with `xml.etree` after refusing any DOCTYPE or ENTITY declaration (`brief/feeds.py`),
keeps entries younger than `BRIEF_MAX_AGE_HOURS` (48), cleans title and excerpt to plain text (nh3, 500 characters)
and stores a `NewsItem` only when sha256(normalised title + URL without tracking parameters) is new for the owner (a
unique constraint), before any LLM call. A failing feed records `last_error` and does not stop the others. Each new
item gets a `news_tag` job until `BRIEF_TAG_DAILY_CAP` (40) items of the owner were queued that day; the rest is
stored `skipped`. `brief/tagging.py` sends title, source name and the excerpt (never the URL) with
`prompts/news_tag.md`; `NewsTags` (extra=forbid) accepts 1-5 tags (controlled list = 6.2 areas + brief/market topics,
at most 2 free), a Vietnamese one-line summary of at most 160 characters, `new_tool` and `relevance` 1-5; invalid
output sets `tag_status=failed` with `error`, 429/budget leaves the job pending. The `brief` job waits (RetryLater)
while `feeds`/`news_tag` jobs are queued, until `BRIEF_WAIT_UNTIL` (09:00), then builds one `DailyBrief` per owner
from the `BRIEF_MAX_ITEMS` (8) most relevant tagged items of the last 48 hours not shown in another day's brief
(`BriefEntry` keeps the order), and enqueues one `brief_intro` call (`prompts/brief_intro.md`, titles and summaries
only); a failed intro leaves the brief without one. Per day: at most 40 tag calls + 1 intro call (about 1 USD a
month at paid prices; the free tier now). `GET /api/brief/today`, `GET /api/brief/{date}`, `GET /api/news` (filters),
`GET /api/news/topics?weeks=` (tag counts per ISO week: replaces Exploding Topics, 9.2),
`POST /api/opportunities/{id}/evidence/news` (the brief's "evidence for" button: link evidence, idempotent per URL),
and `newTools` in the market report (items flagged "new tool/skill" that month). `manage.py eval brief` runs
`backend/evals/news_tag/`. Not yet: Telegram, the useful/not button, the weekly digest, moving an item to Inbox.
Deployment config is in `deploy/` (see deploy/README.md): nginx routes `/api/` (except `/api/search`), `/admin/`,
`/healthz` and `/files/` to Django and everything else to Next; `/files/` passes `auth_request` (Django `/api/me`)
and Django's `X-Accel-Redirect` to the internal `/internal/files/` alias; CSP is report-only. With
`AUTH_MODE=cf_access` every request needs a valid Access JWT for `OWNER_EMAIL`; a session alone is not enough.

Web UI, part A: the app shell (`web/components/app-shell.tsx`) has the six sidebar items of DECISIONS 9.3
(`web/lib/app-nav.ts`: Hôm nay `/`, Tuần `/tuan/`, Phát triển `/phat-trien/` with Sổ tay, Lộ trình, Kỹ năng,
Thị trường, Nhật ký thành tựu, Thư viện `/thu-vien/`, Cơ hội `/co-hoi/`, Công việc `/cong-viec/` with Giờ) and an
Inbox button with a count in the top bar. Home is "Hôm nay" (continue learning, week objectives, inbox count,
today's brief with a "bằng chứng cho cơ hội…" menu); the handbook grid moved to `/phat-trien/`. `/inbox/` (capture,
OG cards, keyboard triage j/k l a u o i c) and `/thu-vien/` (Items with filters, create/edit) are built.

Web UI, part B: every sidebar link is a real page. `/tuan/` (`?w=<monday>&tab=ke-hoach|nhin-lai`: carry-over,
objectives, planning journal; review with time chart, body of work, opportunities, achievements, six questions),
`/co-hoi/` (list + topic heatmap; `?id=N` detail with decision, scores history, evidence), `/cong-viec/` (projects,
timer) and `/cong-viec/gio/` (timer, week summary, entries), `/phat-trien/ky-nang/` (skills matrix by freshness,
evidence), `/phat-trien/thi-truong/` (job ads, monthly report), `/phat-trien/thanh-tuu/` (brag document,
predictions), `/thu-vien/ghi-chu/` (notes, `?item=N`); the inbox can turn an entry into an Item or a note.
Detail views use query parameters, not dynamic segments, so every route stays static. Components live in
`web/components/brain/<area>/`; each area has its typed calls in `web/lib/api/<area>.ts` (weeks, opportunities,
work, growth, library), all going through the one exported `request()` of `client.ts`. Shared helpers:
`lib/dates.ts` (Europe/Prague day, Monday, day arithmetic), `lib/labels.ts` (status tones, opportunity decisions,
DRF `fieldErrors`). The pages are static shells; data loads in the browser through `web/lib/api/` (`useApi` in
`lib/api/use-api.ts`), so `next build` never calls Django. A missing backend (network error, proxy 5xx, non-JSON answer) and 401/403 show states in the UI language
(`components/brain/api-state.tsx`). Cards and status colours are shared: `components/brain/brain-card.tsx`,
`lib/labels.ts`.

Daily use (backend and tooling step): every owned row can be deleted (`DELETE` on items, notes, inbox entries,
achievements, predictions, job ads, opportunity evidence and week objectives; another owner's row answers 404).
Links follow the models' `on_delete`: inbox entries, evidence, skill evidence and achievements keep their row with
the link set to null (evidence keeps its title snapshot), notes lose the link, a carried objective keeps its title
with `carried_from` null, time entries lose their objective. `TimeEntry.project` is `PROTECT`: deleting a project
Item with logged time answers 409, the time entries go first. Deleting an inbox entry (or an Item) also removes its
image file after the commit when no other inbox entry or Item of any owner names it (content addressed:
`thumbnails.discard_if_unused`). Lists of items, inbox, opportunities and skills take `?q=`
(`core/services/search.py`: icontains on titles and short fields, never note markdown); `Item` carries an annotated
`noteCount`. Morning-brief feedback lives on `NewsItem` (`feedback` useful/not_useful/"" + `feedback_at`, `PATCH
/api/news/{id}`); `manage.py export_brief_feedback` writes rated items into `backend/evals/news_tag/fb-<id>.json`
(title + first 500 characters). `GET /api/status` (`core/services/status.py`): month cost at paid prices from
`llm.month_paid_cost` vs `LLM_MONTHLY_BUDGET_USD`, LLM calls this month, last DailyBrief date, pending/failed Job
counts by kind, never keys or error texts. `GET /api/counts` (`core/services/counts.py`): the sidebar's
numbers, one COUNT/EXISTS per list on the list endpoints' own querysets with the pages' default filters (this
week, this month: Europe/Prague), read-only (no Week row created). `manage.py export --out <dir>` (`core/services/export.py`, DECISIONS
4.7): `notes/<id>-<slug>.md` with YAML front matter (id, title, items, created, updated) and `data/<table>.json`
(Django serializer) for every other owned model, then `images/<image_path>` (each file the owner's Items name, once,
under exactly that name, `<32 hex>.webp`; read in 64 kB chunks; stale images of an earlier folder export are removed
like stale notes; inbox thumbnails stay
out, they can be fetched again), plus `manifest.json` (`counts.images`); never the User row, sessions, `Job`,
`LlmCall` or `LlmCache`; a test fails when a new model is neither exported nor excluded. `GET /api/export`
streams the same files (`export_files()`) as `alex-brain-<date>.zip` (`stream_zip()`: ZipFile on an unseekable sink,
one chunk per file, text deflated, webp stored as it is, `X-Accel-Buffering: no`); the Phát triển page links it as a
plain download.

Item images (DECISIONS 9.6): `Item.image_path` (migration library 0003, `db_default=""` so an older process can still
insert) names one webp in `THUMBS_DIR`, the same content-addressed store as the inbox thumbnails
(`core/services/thumbnails.py`: `to_webp(data, sizes)`, `ITEM_SIZES` = 600/400 px for Items, `store()` writes 0644 for
nginx). Every change goes through `library/services.set_image(item_id, name, expect, fetched=)`: a row lock, then the
replaced file is discarded after the commit unless another row uses it; with `expect`, nothing changes when the image
moved on meanwhile. A fetch is an earlier request, so every change but the job's own ends the Item's fetch in the
same transaction (`_end_fetch`, the job row locked too): a waiting job is marked done (`imagePending` false at once)
and a running one gets the `expect` `ENDED_FETCH`, which no image has, so neither it nor a retry sets an image; the
job's own call (`fetched=True`) applies only while its job still runs with its `expect`. A newer upload, removal or
inbox link therefore always wins, also when the image is back to the name the fetch expects (comparing names alone
would miss "" -> copy -> ""). Sources: `POST /api/items/{id}/image` (multipart, the app's only non-JSON body;
`MultiPartParser` on that view only, 10 MB `ITEM_IMAGE_MAX_BYTES`, Pillow sniffs the bytes; nginx allows 11m on that
path because its limit counts the whole multipart body), `POST /api/items/{id}/image/fetch` (202) or the automatic
fetch on create and on a new http(s) `source` (not projects), both queue one `item_image` job per Item
(`library/jobs.py`, registered in `LibraryConfig.ready()`; the job key is re-armed when it already ran, and a waiting
job asked with another link starts over with attempts and delay reset) that run_jobs runs through safe_fetch (the URL
as an image, else its og:image), and
linking an inbox entry (`triage_entry`, or the unfurl job for an entry linked before it finished), which re-encodes
the entry's thumbnail into the Item's own file without network. `GET /api/items/{id}/image` answers through
`core/views.thumbnail_response` (X-Accel-Redirect, DEBUG streams). Item JSON carries `imageUrl` (`?v=` = start of the
name) and `imagePending` (an `Exists` on the Job key, annotated by `services.items()`), projects `imageUrl`.

Web UI, part C (daily use in the UI): "Hôm nay" adds, per brief card, "Đưa vào Inbox" (`POST /api/inbox` with the
URL; sent ids remembered per browser in localStorage `brain:brief-sent-to-inbox`, since the API has no link from
news to inbox) and "Hữu ích / Không hữu ích" (`PATCH /api/news/{id}`, pressing the active one clears it), a "Dự
đoán cần chấm lại" panel (`components/brain/due-predictions.tsx`, also in the week review) and the "AI và tác vụ
nền" status line (`GET /api/status`; warnings for failed jobs, a brief older than a day, cost >= 80% of the
budget). These pieces load with `next/dynamic` (`today-extras.tsx`, `brief-actions.tsx`) to keep the home page
under the 220 kB budget. Cmd+K (`components/search-dialog.tsx`, a lazy copy of the Fumadocs dialog registered in
`provider.tsx`) shows a "Bộ não thứ hai" group above the handbook results: `lib/api/search.ts` queries items,
notes, inbox, opportunities and skills (`?q=`, 5 each, 200 ms debounce, 2+ characters, one failing kind does not
hide the others, 60 s pause when Django is unreachable). Results deep link with query parameters handled by
`lib/use-open-from-url.ts` (opens once, then removes the parameter): `/thu-vien/?item=N`, `/thu-vien/ghi-chu/?id=N`,
`/inbox/?status=S&id=N`, `/co-hoi/?id=N`, `/phat-trien/ky-nang/?id=N`. Every delete goes through
`components/brain/confirm-delete.tsx` (Space UI alert dialog, focus starts on "Hủy", 404 = already gone, 409 shows
the backend message, page shortcuts are blocked while it is open); no `window.confirm` anywhere. A done Item with no
note (a film also without a rating) shows "Xong rồi, nhưng chưa có đầu ra" (`components/brain/library/done-output.tsx`)
on its Thư viện card and in the item dialog, with "Viết ghi chú" (new linked note with a template) and "Chấm điểm"
(opens the dialog on the rating field).

Local end to end: `make dev` (deploy/README.md, "Laptop: daily use without Docker") builds the web app with
`NEXT_PUBLIC_PROGRESS_STORE=api` and runs Django :8000, a Next production server :3100, the dev proxy :8080 and
the jobs loop (`make jobs`); it never touches :3000. `deploy/launchd/com.example.brain.jobs.plist` (not installed)
runs `run_jobs` every 300 s as a launchd user agent.

Capture from outside the app (DECISIONS 4.3): `/inbox/them/?url=&title=&text=` (`app/[lang]/(home)/inbox/them/`,
`components/capture/capture-form.tsx`) shows a confirm form (link + note prefilled with the title and the shared
text; only http/https links, checked in `lib/capture.ts` and again by the API) and saves with `POST /api/inbox`
through `lib/api/client.ts`, then offers "Đóng" (`window.close()`, works for the bookmarklet's popup; otherwise a
hint) and "Mở Inbox" (`/inbox/?status=inbox&id=N`). Two ways in: the bookmarklet on the Inbox page
(`components/capture/bookmarklet-help.tsx`, drag to the bookmarks bar; its `javascript:` href is built from
`window.location.origin` after mount and set on the DOM, since React 19 blocks `javascript:` URLs in props) opens
that page in a small window with the tab's URL, title and selection; and the PWA share target in
`app/manifest.ts` (GET to `/inbox/them/` with url/title/text; Android often puts the link in `text`, the form moves
the first http(s) link found there into the link field). Icons in `public/icons/` (generated locally with Pillow
from the same geometry as `icon.svg`; theme colour `--primary`). No service worker: install works without one and
nothing is cached offline. All of this is Next routes, so nginx and the dev proxy already send them to Next.

Backups (DECISIONS 10.1, laptop): `make backup` = `manage.py backup` (`core/services/backup.py`): `pg_dump -Fc
--no-owner --no-acl` of the configured database into `BACKUP_DIR/<date>.dump` (default `backend/backups/`,
gitignored; written as `.partial`, then renamed; the newest `BACKUP_KEEP` = 14 dated dumps kept), then
`mirror_images()` copies the images of `THUMBS_DIR` that `BACKUP_DIR/thumbs/` lacks (0600 files, 0700 folder,
`.partial` then rename) and never deletes there, since a name always means the same bytes. The pg tools
match the server's major version (`/opt/homebrew/opt/postgresql@16/bin` etc., `PG_BIN_DIR` overrides), the password
goes through `PGPASSWORD`. `make restore-check` = `manage.py restore_check`: restores the newest dump into a
throwaway `<db>_restore_check_<pid>` database, counts the rows of every table, fails when `django_migrations` or
`django_content_type` is empty, prints the differences with the live database (rows written since the dump) and
`images: N referenced, M missing from the backup` (Item `image_path`, when the dump has that column, and inbox
`og_image_path` names without a file in the mirror next to the dump; information only), and drops the throwaway
database in a `finally`; it never writes to the dev database. A real restore is `pg_restore` plus copying
`BACKUP_DIR/thumbs/*` into `THUMBS_DIR`.
`deploy/launchd/com.example.brain.backup.plist` (not installed) runs the backup nightly at 02:30.

Web UI, part D (guides and intro): `web/components/stageshow/` holds the Stageshow kit (`kit/`, MIT, brands left
out) and the app's animated how-tos, drawn from the real pages simplified, never with the owner's data or numbers.
`brain-look.ts` maps the Space UI tokens of `app/global.css` onto the kit's `--ss-*` tokens (so stages follow the
theme); each guide is `guides/<name>.tsx` + `.css` scoped under `.ssg-<name>`, 600x452 with a 358x470 compact design
below 560 px, a poster that is also the reduced-motion still, and a Vietnamese `role="img"` label. Pages import only
`stageshow/lazy.tsx` (next/dynamic, `ssr: false`), so no kit code is in any first load. `EmptyStateGuide` shows a
guide under a page's empty state (Inbox, Tuần when never planned, Cơ hội, Công việc + Giờ, Kỹ năng, Thư viện) only
when the list loaded without error and unfiltered; "Ẩn hướng dẫn" is per guide in localStorage
(`alex-brain:guide-hidden:<guide>`). The Inbox guide loops; the others play once in view with "Xem lại".
`/huong-dan/` lists all six. `/gioi-thieu/` is the intro: server-rendered copy (feature bento, case study with
"Số liệu: Alex điền" slots, print CSS and an "In hoặc lưu PDF" button) with pictures from `stageshow/intro/`
(one lazy chunk; only the Inbox tile moves, once). The week review adds `rhythm` (DECISIONS 6.5) shown as
"Nhịp thực hành" (`components/brain/tuan/review-rhythm.tsx`).

### Switching your own dev server to the API store

`NEXT_PUBLIC_PROGRESS_STORE` is inlined when Next compiles, so it is chosen when `next dev` (or `next build`) starts;
without it the pages keep using the localStorage store. localStorage belongs to one origin (scheme, host and
port): the phase 1 progress lives in `http://localhost:3000`, and a page served from :8080 or :3100 cannot see it.
To keep that origin and move the old progress once:

1. Stop your `next dev` on :3000 (Ctrl-C in its terminal). Postgres must be running.
2. `make dev-hot` from the repo root. It runs `migrate`, Django on :8000, `next dev` on :3001
   (`DEV_HOT_PORT`) with `NEXT_PUBLIC_PROGRESS_STORE=api`, and `web/scripts/dev-proxy.mjs` on :3000 in front of
   both (Django paths -> :8000, the rest -> :3001, WebSocket upgrades too, so hot reload keeps working). It refuses
   to start while :3000, :8000 or :3001 is in use. `make jobs` in another terminal adds the background jobs.
3. Open http://localhost:3000. "Hôm nay" shows "Chuyển tiến độ học cũ lên server" when this browser has done pages
   the server does not have yet. "Chuyển lên server" PUTs each of them (`PUT /api/progress/{book}/{page}`, 4 at
   a time), copies the old "last visited" page when the server has none, reloads the store and writes the marker
   `alex-brain:progress:api-migration` = `{status: "migrated"}`. "Bỏ qua" writes `{status: "dismissed"}`. Either
   way the offer never comes back in this browser, and the old data under `alex-brain:progress:v1` is kept.
   Pages of books the server no longer knows (400) are skipped; a network, 401 or 5xx error stops the move
   without the marker, and "Thử lại" sends only what is still missing. Moved pages get today's `updated_at`, so
   the week review counts them as done this week.

To make the API store permanent for a plain `next dev` (without the proxy, `/api/progress` would reach Next and
fail), put `NEXT_PUBLIC_PROGRESS_STORE=api` in `web/.env.local` yourself and restart `next dev`; keep using the
proxy in front of it (`node web/scripts/dev-proxy.mjs --web http://127.0.0.1:<next port>`). To go back, remove
the variable and restart: the localStorage store reads its old data again (changes made in API mode are not
copied back). `make dev` (:8080) always builds with `=api`; with `DEV_BUILD=0` it refuses a build that `make dev`
did not make (`web/.next/progress-store-api` holds the BUILD_ID of the last API build).

```
                Cloudflare Access (login: email OTP / Google, JWT on every request)
                         │
                Cloudflare Tunnel (cloudflared on the VPS, no inbound ports)
                         │
                       nginx  (VPS, listens on localhost only)
   ┌─────────────────────┼──────────────────────────────┐
   │ /api/*, /admin/*    │ /files/*                      │ everything else
   ▼                     ▼                               ▼
 Django (gunicorn)     auth_request → Django /api/me,   Next.js standalone server
 users, progress,      then X-Accel-Redirect /internal/ (CONTENT_DIR, SEARCH_DB on disk)
 later: Item, Note,    files/... served from a separate
 Collection, Inbox,    directory (not inside the Next bundle)
 DailyBrief
```

* **Identity:** Cloudflare Access is the only login screen. Django either keeps its own users with a session
  cookie, or trusts the `Cf-Access-Jwt-Assertion` header (verified against the team's public keys) and maps
  the email to a user. Next.js stays stateless.
* **Same origin:** `brain.example.com` serves both Next.js and Django paths, so the browser sends the
  session cookie and `csrftoken` automatically; the UI uses the endpoints in API_CONTRACT.md.
* **Progress:** `getProgressStore()` in `web/lib/progress/index.ts` returns an API-backed store calling
  `GET /api/progress`, `PUT /api/progress/{book}/{page}`, `PUT /api/progress/last-visited`; the home page
  offers once to move this browser's localStorage progress to the server.
* **Attachments (`/files/`):** ~1.8 GB of course PDFs, spreadsheets and Power BI files. In production they
  live in their own directory (copied from `raw/tai-lieu-so-tay-*`), are not packaged with the Next build,
  and are served by nginx after `auth_request` to Django succeeds (X-Accel-Redirect to an internal location).
* **Second brain (later):** Item (course, book, film, article, project; status, tags, ratings), Note
  (markdown, linked to items), Collection, Inbox, DailyBrief, managed first through Django admin. Search can
  move to Postgres full-text when notes live in the database.
* **Hosting:** one VPS (Oracle Always Free ARM or Hetzner) runs nginx, Next.js, Django, Postgres,
  `cloudflared`. Security headers and `X-Robots-Tag: noindex` at nginx. `raw/` never leaves the laptop.
