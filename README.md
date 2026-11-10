# Alex's Brain

Personal study site built from 15 Coursera/F8 handbooks (Vietnamese "sổ tay"), later a personal second
brain. Phase 1 (this repo today) is the Fumadocs app in `web/`; phase 2 adds a Django backend in `backend/`.

* 15 handbooks, 18,780 source items merged into 4,746 learning pages, 3 tracks (Kinh doanh, IT, Kỹ năng)
* Full-text search (SQLite FTS5), study roadmap from the PDF, progress per lesson (browser storage for now)
* Next.js server mode: markdown on disk is compiled on request and cached; build time does not depend on page count

## Run locally

Requirements: Node 22+ (uses `node:sqlite`), macOS/Linux. Optional: `pdftohtml` (poppler) for `extract-courses.mjs`.

```bash
cd web
npm install
npm run search:rebuild          # builds web/data/search.sqlite from web/content (≈15 s)
npm run assets:prepare          # clones attachments from raw/tai-lieu-so-tay-N into public/files (APFS clone)
BUILD_SUBSET=handbook-08,handbook-05 npm run dev   # only these books, fast first page
npm run dev                     # all 15 books
```

* `BUILD_SUBSET` takes book slugs, comma separated. Home cards always list all books.
* Stop the dev server with **Ctrl-C**. Turbopack writes its cache (`.next/dev/cache`) on a clean shutdown;
  killing the process (`kill -9`, `pkill`) loses it and the next first page takes ~7 s instead of ~3 s.
* The search index and attachments are local files (gitignored); the site works without them
  (search logs a warning and returns nothing, attachment links 404).

## Build and run the production server

```bash
cd web
npm run build                   # next build (standalone) + copies static assets next to the server
npm start                       # node .next/standalone/server.js on PORT (default 3000)
```

`npm start` sets `CONTENT_DIR` (default `web/content/docs`) and `SEARCH_DB` (default `web/data/search.sqlite`);
override them when the content lives elsewhere. Pages render on first request and are cached until the next build.

Optional static export (not the deploy target, use with a subset): `BUILD_SUBSET=... npm run export:static`.

## Add a handbook

```bash
node web/scripts/import-gitbook.mjs <export.zip | handbook.html | folder> --track <kinh-doanh|it|ky-nang> \
  --slug <ascii-slug> --title "<title>" [--description "..."] [--merge auto|m2|module|m1|none] [--cover <name>]
```

Three inputs, picked from the path (or `--from zip|html|markdown-dir`):

* **GitBook zip**: a markdown export with `SUMMARY.md` and one file per page;
* **single HTML**: a handbook in one HTML file with an embedded `<script id="book-data">` JSON block;
* **folder of markdown**: with a `SUMMARY.md` it is read like the zip; without one, each sub-folder is a module,
  each `.md` file a lesson, in natural name order (`2-x` before `10-x`), a folder's `README.md` or `index.md` is
  its page and titles come from each file's first `# heading` (else its name).

One command: merges items into learning pages (structure only, the text is never rewritten), normalizes GitBook
syntax, writes `web/content/docs/<track>/<slug>/`, registers the book in `web/lib/books.ts` and re-indexes search.
Then:

1. add its English title and description to `web/lib/i18n/en/shell.ts` (the coverage test asks for them),
2. optional: list the slug before `"..."` in `web/content/docs/<track>/meta.json` (`pages`) to set its position,
3. optional: add its programs to `web/content/courses.json` and run `node web/scripts/extract-courses.mjs`
   (course links), `node web/scripts/prepare-assets.mjs <slug> <folder>` if it has attachments, then edit the
   description in `web/lib/books.ts` if needed.

Images whose URLs expired render as placeholders. When fresh URLs exist, put them in a file in the same
order as `raw/missing-images.json` and run `node web/scripts/backfill-images.mjs <file>`.

## Repository layout

```
web/            Fumadocs app (server mode) — see CLAUDE.md for details
archive/        original HTML handbooks (archive/html/, untouched), small markdown zips, roadmap PDF
raw/            large zips, attachments (tai-lieu-so-tay-*), materials json — gitignored
_to_delete/     untouched, gitignored
```

## Planned deployment (not done yet)

The Node server runs on a VPS next to Django, reachable only through a **Cloudflare Tunnel**
(`cloudflared`, no open ports), with **Cloudflare Access** in front of **brain.example.com** (email OTP or
Google login). Django serves the progress API and later the second-brain features; nginx serves `/files/`
from a separate directory behind the same login. See ARCHITECTURE.md.

## What phase 2 adds

Django in `backend/`: users (or trust the Cloudflare Access JWT), the progress API in API_CONTRACT.md
(the UI swaps `LocalStorageProgressStore` for an API store), then Item / Note / Collection / Inbox /
DailyBrief models for the second brain, and Postgres full-text search if it outgrows SQLite.
