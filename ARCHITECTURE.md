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
reload on tab focus; on first load against an empty account it copies this browser's localStorage progress once).
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
`/api/inbox/{id}/thumbnail` through X-Accel-Redirect to nginx `/internal/thumbs/` (Django streams it in DEBUG).
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
OG cards, keyboard triage j/k l a u o i c) and `/thu-vien/` (Items with filters, create/edit) are built; Tuần,
Cơ hội, Công việc and the other Phát triển pages are "Đang xây" placeholders. The pages are static shells; data
loads in the browser through `web/lib/api/client.ts` (`useApi` in `lib/api/use-api.ts`), so `next build` never
calls Django. A missing backend (network error, proxy 5xx, non-JSON answer) and 401/403 show Vietnamese states
(`components/brain/api-state.tsx`). Cards and status colours are shared: `components/brain/brain-card.tsx`,
`lib/labels.ts`.

Local end to end: `make backend-dev`, a web server (e.g. `npm start` with `PORT=3100`), then
`node web/scripts/dev-proxy.mjs --web http://127.0.0.1:3100` and open http://localhost:8080.

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
  `GET /api/progress`, `PUT /api/progress/{book}/{page}`, `PUT /api/progress/last-visited`; it can import
  the localStorage state once on first login.
* **Attachments (`/files/`):** ~1.8 GB of course PDFs, spreadsheets and Power BI files. In production they
  live in their own directory (copied from `raw/tai-lieu-so-tay-*`), are not packaged with the Next build,
  and are served by nginx after `auth_request` to Django succeeds (X-Accel-Redirect to an internal location).
* **Second brain (later):** Item (course, book, film, article, project; status, tags, ratings), Note
  (markdown, linked to items), Collection, Inbox, DailyBrief, managed first through Django admin. Search can
  move to Postgres full-text when notes live in the database.
* **Hosting:** one VPS (Oracle Always Free ARM or Hetzner) runs nginx, Next.js, Django, Postgres,
  `cloudflared`. Security headers and `X-Robots-Tag: noindex` at nginx. `raw/` never leaves the laptop.
