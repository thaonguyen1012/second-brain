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
planned/active/done/dropped, tags as a Postgres array, rating 1-10) and `Note` (markdown, M2M to Item, admin only);
`backend/inbox/` has `InboxEntry` (url or text, triage status inbox/later/archived, optional linked Item, OG unfurl
fields, LLM suggestions, `processed` + `error`). Endpoints `GET/POST /api/items`, `PATCH /api/items/{id}`,
`GET/POST /api/inbox`, `PATCH /api/inbox/{id}` (cursor pagination, newest first). Django admin is the first UI.
Deployment config is in `deploy/` (see deploy/README.md): nginx routes `/api/` (except `/api/search`), `/admin/`,
`/healthz` and `/files/` to Django and everything else to Next; `/files/` passes `auth_request` (Django `/api/me`)
and Django's `X-Accel-Redirect` to the internal `/internal/files/` alias; CSP is report-only. With
`AUTH_MODE=cf_access` every request needs a valid Access JWT for `OWNER_EMAIL`; a session alone is not enough.

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
