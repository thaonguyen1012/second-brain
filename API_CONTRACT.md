# API contract (phase 2, implemented by Django)

Contract only; phase 1 has no API client. Everything is **same origin** (`brain.example.com`), JSON, UTF-8.

## Authentication and CSRF

* The browser is already behind Cloudflare Access. Django authenticates with its **session cookie**
  (`sessionid`), created after the Access login (or derived from the Access JWT).
* Unsafe methods (`PUT`, `POST`, `DELETE`) must send the value of the `csrftoken` cookie in the
  **`X-CSRFToken`** header. Requests use `credentials: 'same-origin'`.
* Unauthenticated requests get `401 {"detail": "..."}`; CSRF failures get `403`.

## Identifiers

* `book`: book slug from `web/lib/books.ts` (ASCII, e.g. `garden-notes`).
* `page`: page path inside the book, without leading/trailing slash; the book's index page is the empty
  string, sent as `_index` in URLs. Example: `/docs/ky-nang/garden-notes/01-soil-and-water/001-what-plants-need/`
  → book `garden-notes`, page `01-soil-and-water/001-what-plants-need`.
  In URLs the page is percent-encoded as one segment (`/` → `%2F`).

## GET /api/me

```json
200 { "id": 1, "email": "alex@example.com", "name": "Alex" }
```

## GET /api/progress

Full progress snapshot, the same shape as `ProgressSnapshot` in `web/lib/progress/store.ts`.

```json
200 {
  "done": { "garden-notes": { "01-soil-and-water/001-what-plants-need": true } },
  "lastVisited": { "bookSlug": "garden-notes", "pageSlug": "01-soil-...", "title": "What plants need", "at": "2026-10-31T10:00:00Z" }
}
```

`lastVisited` is `null` when nothing was visited.

## PUT /api/progress/{book}/{page}

Mark one page done or not done. Idempotent.

```json
request  { "done": true }
response 200 { "book": "garden-notes", "page": "01-soil-...", "done": true, "updatedAt": "2026-10-31T10:00:00Z" }
```

`400` for an unknown book or a malformed body. Unknown pages are accepted (content may change between imports).

## PUT /api/progress/last-visited

```json
request  { "book": "garden-notes", "page": "01-soil-...", "title": "What plants need" }
response 200 { "bookSlug": "garden-notes", "pageSlug": "01-soil-...", "title": "What plants need", "at": "2026-10-31T10:00:00Z" }
```

`title` is optional and for display only.

## Lists: cursor pagination

List endpoints return the newest rows first, 50 per page (`?limit=` up to 200):

```json
200 { "next": "http://.../api/items?cursor=cD0y...", "previous": null, "results": [ ... ] }
```

Follow `next` until it is `null`. Unknown ids answer `404`; validation errors answer `400` with field messages.

Search: `?q=` on `/api/items`, `/api/inbox`, `/api/opportunities`, `/api/skills`, `/api/notes`,
`/api/achievements`, `/api/predictions`, `/api/market/job-ads` and `/api/news` is a case-insensitive substring
match (spaces collapsed, at most 200 characters) on the fields named in each section; it combines with the other
filters. Only `/api/notes` and `/api/notes/search` search note markdown. Cmd+K (DECISIONS 4.4) uses these filters,
with `limit=5`, and opens a result through the `GET .../{id}` of its kind.

## Deleting

`DELETE` answers `204` with no body, `404` for an unknown id or a row of another owner, and needs the CSRF header
like every unsafe method. What points at the deleted row is kept and unlinked: the linked field becomes `null`
(evidence keeps its `title` snapshot), notes lose the Item from `items`. Deletable: `/api/items/{id}`,
`/api/notes/{id}`, `/api/inbox/{id}`, `/api/weeks/{start}/objectives/{id}`, `/api/time-entries/{id}`,
`/api/opportunities/{id}/evidence/{evidenceId}`, `/api/skills/{id}/evidence/{evidenceId}`, `/api/achievements/{id}`,
`/api/predictions/{id}`, `/api/market/job-ads/{id}`, and `/api/items/{id}/image` (removes the Item's image, also
`204` when it has none; see Items). Image files are shared by content: one goes, after the commit, only when no
Item or inbox entry of any owner still names it.

## GET /api/status

```json
200 { "llm": { "provider": "gemini", "model": "gemini-3.1-flash-lite", "freeTier": true,
               "monthStart": "...", "monthCostUsd": 0.012345, "budgetUsd": 5.0,
               "calls": 42, "failedCalls": 3 },
      "lastBriefDate": "2026-11-02",
      "jobs": { "pending": [ { "kind": "tag", "count": 2 } ], "failed": [ { "kind": "unfurl", "count": 1 } ] } }
```

`monthCostUsd` is the cost since `monthStart` (the first of the month, UTC, like the guard) at paid-tier prices:
what the `LLM_MONTHLY_BUDGET_USD` guard compares, even on the free tier. `calls` counts every LLM call recorded
since then, refused and failed ones too. `lastBriefDate` is the owner's newest DailyBrief (`null` when none). `jobs` counts background jobs waiting (`pending`) and given up
(`failed`) by kind. No keys, payloads or error texts.

## GET /api/counts

```json
200 { "objectivesOpen": 2, "skills": 14, "tools": 40, "jobAds": 6, "achievements": 1, "items": 77, "notes": 12,
      "opportunities": 3, "projects": 2, "timerRunning": false }
```

The numbers next to the app sidebar's rows. Each one is the row count of the list its sidebar row opens, with
that page's default filters, so a click shows exactly that many rows: `objectivesOpen` = the open objectives of
this week, `jobAds` = the job ads of this month (`GET /api/market/job-ads?month=`), `achievements` = the
achievements of this week (`GET /api/achievements?week=`), `tools` = the Items of type tool (`GET
/api/items?type=tool`, the Công cụ page); `skills`, `items`, `notes`, `opportunities` and `projects` = their whole
unfiltered lists. `timerRunning` is `true` while a timer runs. This week and this month
are Europe/Prague. Read-only: unlike `GET /api/weeks/current` it never creates a Week row (a week nobody opened
yet has `objectivesOpen: 0`). One COUNT or EXISTS query per number. `401` when not logged in.

## GET /api/export

A copy of all the owner's data (DECISIONS 4.7), the same files as `manage.py export`, streamed as
`200 application/zip` with `Content-Disposition: attachment; filename="alex-brain-<date>.zip"` and
`Cache-Control: no-store`. Inside the folder `alex-brain-<date>/`: `notes/<id>-<slug>.md` (YAML front matter + the
markdown), `data/<table>.json` for every other owned model, `images/<image_path>` (each image file the owner's Items
use, once; the file name is exactly the Item's `image_path` in `data/items.json`, which already ends in `.webp`, for
example `images/3f2a9c1e...c1e.webp`; stored in the zip without compression),
`manifest.json` (`exportedAt`, `owner`, `counts`; `counts.images` is the number of image files). Inbox thumbnails
are left out: they come from the link and can be fetched again. Never the User row, sessions, jobs, LLM calls or
the LLM cache. `401` when not logged in.

## Items (`/api/items`)

`GET /api/items?type=book&status=active&q=deep` lists items (all filters optional; `q` matches title, summary or
source, or is exactly one of the tags). `GET /api/items/{id}` reads one (with `noteCount`). `POST /api/items` creates one, `PATCH /api/items/{id}` changes any writable field.
`DELETE /api/items/{id}` (`204`) unlinks notes, inbox entries, evidence and achievements and removes the project's
details and the Item's image; a project with time entries answers `409` `{ "detail": "..." }` (delete its time
entries first).

```json
request  { "type": "book", "title": "Deep Work", "summary": "Làm việc sâu, không xao nhãng", "tags": ["Focus"],
           "source": "Cal Newport", "rating": 9 }
response 201 { "id": 1, "type": "book", "status": "planned", "title": "Deep Work",
               "summary": "Làm việc sâu, không xao nhãng", "tags": ["focus"],
               "source": "Cal Newport", "rating": 9, "createdAt": "...", "updatedAt": "...",
               "startedAt": null, "finishedAt": null, "noteCount": 0,
               "imageUrl": null, "imagePending": false, "imageMissing": false }
```

`noteCount` (read only) is the number of notes linked to the Item. `imageUrl` (read only) is where the Item's image
loads, `/api/items/1/image?v=3f2a9c1e` (`v` changes with the image, so a replaced image never comes from the browser
cache), or `null` without an image. `imagePending` (read only) is `true` while a fetch of the image from a link waits
for the background job or runs. `imageMissing` (read only) is `true` when the last fetch of the Item's `source` ended
without a picture (a page without an image, a site without a usable logo, a refused or unreadable answer), while the
Item has the image it had when that fetch was asked (none, usually: an upload makes it `false`, removing that upload
makes it `true` again) and until a fetch is asked again; a fetch that an image change ended never sets it. Every Item
answer (list, one, create, update, upload, fetch) carries all three, without a query per row. The image cannot be set
through this body, only through the endpoints below.

`type`: course, book, film, article, project, tool. `status`: planned, active, done, dropped. `summary` (optional,
at most 300 characters, default "") is one line on what the Item is or what it is for (a tool's "dùng để làm gì");
any run of whitespace in it is sent back as one space. Tags are lowercased and deduplicated (a tool's stages are
tags: `backend/library/tools.py`, `web/lib/tools.ts`); `rating` is 1-10 or null.

The dates follow the status on every write (`POST`/`PATCH` here and on `/api/projects`), so an Item marked done
anywhere counts in the week review (by `finishedAt`): a change to `active` sets `startedAt` to now when it is empty
and clears `finishedAt`; to `done` sets `finishedAt` to now when it is empty (`startedAt` is kept and may stay
`null`); to `planned` clears both; to `dropped` clears `finishedAt` (`startedAt` is kept). Creating an Item with a
status applies the same rule. A `startedAt` or `finishedAt` sent in the same request wins over the rule, and a write
that does not change the status leaves both dates alone.

### Item image

One image per Item (DECISIONS 9.6): the cover of a book or film, the logo of a project or a tool (a project is an
Item, so it uses these endpoints too). The server stores it re-encoded as webp, at most 600 px on the longer side and 200 KB
(a logo fetched from a tool's site: at most 256 px), without EXIF; never the uploaded bytes. Every endpoint answers
`404` for an unknown id or another owner's Item and `401` when not logged in; writes need the CSRF header.

* `GET /api/items/{id}/image`: the webp (`Content-Type: image/webp`, `Cache-Control: private, max-age=86400`), `404`
  when the Item has no image. Load it through `imageUrl`. Not in the OpenAPI schema (not JSON).
* `POST /api/items/{id}/image`: `multipart/form-data` with the file in the field `file` (the only multipart body of
  the API; a JSON body answers `415`). JPEG, PNG, GIF or WebP, at most 10 MB (`ITEM_IMAGE_MAX_BYTES`). The server
  reads the bytes, not the type the browser sends. Sets or replaces the image and answers `200` with the Item (a
  fetch that waits or runs is ended, see below). `400 { "file": ["..."] }` when the file is missing (`Chọn một ảnh để
  tải lên.`), too big (`Ảnh lớn hơn 10 MB.`) or not a readable image, such as SVG, HEIC, PDF or a decompression bomb
  (`Không đọc được ảnh. Chỉ nhận JPEG, PNG, GIF hoặc WebP.`). In production nginx lets a body of up to 11 MB through
  on this path only (2 MB everywhere else; the limit counts the whole multipart body, so every file up to 10 MB
  reaches Django and a file just over it still gets the JSON `400`). A larger body answers `413` with nginx's HTML
  page, not JSON, so the web checks `file.size` against 10 MB before it uploads.
* `DELETE /api/items/{id}/image`: removes the image, `204` (also when there is none), and ends a fetch that waits or
  runs, so the fetch never puts an image back.
* `POST /api/items/{id}/image/fetch`: `{ "url": "https://..." }` (optional, default the Item's `source`) takes the
  image from a link: the URL itself when it answers with an image, else the page's `og:image`. It answers `202` with
  the Item (`imagePending: true`) at once; the request is made later by the background job (`run_jobs`, every 5
  minutes), through the same SSRF guard as the inbox. The image then appears in the Item's `imageUrl` (reload the
  Item). It replaces only the image the Item had when the fetch was asked, and any later change of the image (an
  upload, a removal, linking an inbox entry) ends the fetch: `imagePending` turns `false` (at once when the job has
  not started; a running job finishes without setting its image) and the fetched image is never applied, also when
  the image is back to what it was when asked (removed again). A page without an image, a refused address or an
  unreadable image ends without an image (`imageMissing: true`); a network error is retried (3 attempts, 10 minutes
  apart). Asking again while a fetch waits keeps one job: the same request changes nothing, another link starts it
  over with every attempt and no delay; after a fetch has ended (or was ended) it runs again.
  `400 { "url": ["Item chưa có link http(s)."] }` when there is no `url` and the source is not an http(s) URL (an
  invalid `url` answers `400` with the URL message). Allowed for every type (the UI hides it for projects, whose
logo is uploaded, and offers it as "Lấy logo từ trang" for tools).

For a tool the fetch takes the logo of its site instead of an `og:image` (a page's banner makes a poor logo;
DECISIONS 9.10, `backend/library/logos.py`, `backend/core/services/site_icon.py`): the icons the page declares
(`<link rel>` apple-touch-icon, icon, shortcut icon, also inline as a `data:` URL; not one for a dark colour scheme,
a light drawing that would vanish on the logo's white ground; the raster icons of its web app manifest) and the
site's `/apple-touch-icon.png` and `/favicon.ico` (not on Read the Docs, which answers them with its own icon, nor for
a project's page on `<user>.github.io/<project>/` or GitLab Pages, where the root and the paths above the project are
the user's own site), ranked by declared size (128-512 px first), at most 5 of them tried. The first raster image
(PNG, JPEG, GIF, WebP or an ICO's largest frame) of 64 px or more on its smaller side is kept, else the largest of
at least 32 px; never enlarged, with its transparency, and a drawing on a wide white or transparent margin (under
80% of the icon) is cut out with 6% around it. An image under 32 px on its smaller side once at most 256 px (a
favicon, a sliver) is no logo. When no icon makes a logo, the last resort is a raster logo the page itself shows: a
square `og:image`, else an `<img>` whose short alt or class says "logo" and whose file name holds "logo" or the
site's name (at most 2:1); at most 2 such images are fetched. SVG is never fetched, and the default icons of Read
the Docs and mdBook are never taken. A small page that only redirects with `<meta http-equiv="refresh">` is followed
once (when that fails, the page itself is read). A page the guard refuses for its answer (over 2 MB, compressed, not
HTML) still gives its site's root files; an image link it refuses stays refused. Any answer under 500 but 408 and
429 is final (a 204 for a silenced favicon included). A `url` that answers with an image is that logo itself. Hosts
whose pages carry their own icon: `github.com/<owner>/<repo>` asks the GitHub API (no token) for the repository's
homepage and takes that site's icon (a person's repository only when the homepage names the repository in its host
or path: a person's own site carries their own mark); with no homepage, or a homepage icon under 64 px, the owner's
avatar (256 px) only when the owner is an organisation that is the tool itself (its login is the repository's name in
letters and digits, `gitleaks/gitleaks`; an umbrella organisation's avatar, `grafana/k6`, `pypa/pip-audit`, is
another mark); a person's account gives no avatar, `github.com/<organisation>` gives its avatar, and GitHub's own
pages (`/features/...`, `/search`) keep GitHub's icon. The Visual Studio Marketplace, the Chrome Web Store and GitLab
give the item's own icon (the page's `og:image`, only when it is the store's icon URL); npm, PyPI, Bitbucket,
Codeberg, SourceForge, addons.mozilla.org, the App Store and Google Play give none. A GitHub API 403 or 429 is its
hourly limit only when `/rate_limit` (never counted) says no request remains: the job then waits until the limit
resets (at most 61 minutes) without counting an attempt, the other repositories wait too without a request, and
every other job, of any kind, goes on. Any other 403 or 429 is an error retried like a network error (3 attempts,
then the job fails); a repository that is gone (404) ends without a logo.

Automatic fetch: creating an Item, or a `PATCH` that changes its `source`, queues the same fetch (`imagePending:
true` in that answer) when the Item has no image, its `source` is an http(s) URL and it is not a project (a page's
banner makes a poor logo, and a client's site is not the project's): a tool gets the logo of its site. Handbook
courses (source `/docs/...`) and sources that are plain text are skipped. `manage.py seed_tools` therefore queues a
logo for each tool it adds, and `manage.py fetch_tool_logos [--owner EMAIL] [--again]` queues one for each of the
owner's tools that has a link, no image and no fetch waiting or running, except a tool whose last fetch of the same
link found no logo (`imageMissing`; `--again` asks those too).

### Where an Item is used

`GET /api/items/{id}/mentions` ("Được nhắc tới ở" on the Item page, DECISIONS 9.8): the owner's opportunities that
hold the Item as evidence, with the stance of each such row, the skills that do, with their freshness (from all
their evidence, as on `/api/skills`), and the notes whose markdown links the Item (`[[ ]]`, see Notes below). The
opportunities and skills follow their newest evidence `date`, and so do the rows inside each; the notes are newest
first (`updatedAt`), `title` as in the note search below. Read only; `404` for an unknown id or another owner's Item.
A fixed number of queries whatever the number of rows.

```json
200 { "opportunities": [ { "id": 2, "title": "Bakery stock", "decision": "keep",
                           "evidence": [ { "id": 8, "stance": "supports", "title": "Deep Work", "note": "",
                                           "date": "2026-11-02" } ] } ],
      "skills": [ { "id": 3, "name": "Django", "freshness": "fresh",
                    "evidence": [ { "id": 5, "title": "Pekárna eshop", "note": "", "date": "2026-10-01" } ] } ],
      "notes": [ { "id": 7, "title": "Thói quen nhỏ", "updatedAt": "2026-11-07T20:14:03Z" } ] }
```

## Notes (`/api/notes`)

A note is markdown linked to any number of the owner's Items (DECISIONS 4.1). Note bodies stay private: they are
never sent to an LLM.

```json
request  { "title": "Deep Work: 3 ý chính", "markdown": "# ...", "items": [1, 4] }   (markdown required)
response 201 { "id": 3, "title": "Deep Work: 3 ý chính", "markdown": "# ...", "items": [1, 4],
               "itemLabels": [{ "id": 1, "title": "Deep Work", "type": "book" }, ...],
               "createdAt": "...", "updatedAt": "..." }
```

`GET /api/notes?q=focus&item=1` lists notes (cursor pagination, newest first; the filters are optional): `q` matches
title or markdown (case-insensitive substring; a `q` with ASCII punctuation also matches the markdown with its
backslash escapes shown, so `AT&T` finds `AT\&T` as the editor writes it), `item` keeps notes linked to that Item id, `clientId` (a UUID, `400`
otherwise) keeps the note a create with that `clientId` made, if it arrived. `GET /api/notes/{id}`
reads one, `DELETE /api/notes/{id}` removes it (`204`); `PATCH /api/notes/{id}` accepts `title`, `markdown` and `items` (replaces the links; `[]` removes them).
`items` are sorted ids, up to 10,000 (as many as a note's text can link); an Item that is not the owner's answers `400`.
Markdown is up to 200,000 characters.

Saving from the editor (it saves by itself, DECISIONS 9.8): a `POST` may carry `clientId`, a UUID the editor gives
the new note before its first save. A `POST` with a `clientId` the owner already used answers `200` with that note
and changes nothing (a create answers one time for `createdAt` and `updatedAt`; a create sent again, as the page closed or from a restored copy, never makes a second note); the
editor then sends its newer text with a `PATCH`, unless that note was edited since it was made (`updatedAt` after
`createdAt`) and holds other text than the editor sent: then it shows that note and keeps its own text as a copy to restore. A copy of a new
note left by a page that closed while creating it is first looked up with `GET /api/notes?clientId=`: if its create
arrived, the copy belongs to that note. A `PATCH` may carry `baseUpdatedAt`, the `updatedAt` the edit
started from: when the note was saved since then (another tab or device), nothing is written and the answer is
`409 { "detail": "...", "note": { ...the note as it is now } }`. A `PATCH` writes only the fields it sends, so a
save of the Items never puts back older text.
`itemLabels` (read only) gives the id, title and type of each linked Item, so a list can label its links without
loading every Item.

Links (`[[ ]]`, DECISIONS 9.8): the editor's picker writes a readable markdown link to a record's page, such as
`[Atomic Habits](/thu-vien/item/?id=12)`; the pages are `/thu-vien/item/` (Item), `/thu-vien/ghi-chu/` (note),
`/co-hoi/` (opportunity) and `/phat-trien/ky-nang/` (skill), with or without `/vi` or `/en` before them. Every
`POST`, and every `PATCH` that sends `markdown` or `items`, reads the note's links into its link table. A link counts
where the reading view (CommonMark + GFM, as micromark reads it) shows one: in the text of a paragraph, heading or
table cell, written `[text](url)` (an optional title in `""`, `''` or `()`) or as a reference (`[text][label]`,
`[label][]`, `[label]` with a definition); never inside code (fenced or indented, in quotes and lists too), an HTML
block or raw HTML, an autolink, an image or another link's text. An unknown id, another owner's record and the note
itself are ignored. A link to an Item also
adds that Item to `items` (a `PATCH` that replaces `items` keeps the Items the text links). The markdown stays the
only source: the table is rebuilt from it, and an export carries only the markdown.

`GET /api/notes/{id}/mentions` ("Được nhắc tới ở" on the note page): the owner's notes that link this note, newest
first, as `{ "notes": [ { "id": 9, "title": "...", "updatedAt": "..." } ] }`; `404` for an unknown id or another
owner's note.

`GET /api/notes/search?q=focus&limit=5` (`q` required, `limit` 1-20, default 5) is the Cmd+K form of the search:
the newest matching notes as `{ "results": [ { "id": 3, "title": "...", "excerpt": "…around the match…",
"updatedAt": "..." } ] }`, never the whole markdown. `title` is the note's title, else its first line with text,
read as it shows: without heading/quote/list/task marks and inline marks, links by their text, escapes and numeric
character references (`&#x20;`) by their character, no hard break's backslash, at most 120 characters; else `""`.
`excerpt` is about 120 characters around the first match, read the same way. An empty `q` answers
`{ "results": [] }`.

## Inbox (`/api/inbox`)

`POST /api/inbox` stores a capture and answers at once with `processed: false`; unfurl and AI tagging run later
in a background job, never inside the request.

```json
request  { "url": "https://example.com/post" }          (or { "text": "an idea" }; at least one is required)
response 201 { "id": 7, "url": "https://example.com/post", "text": "", "status": "inbox", "item": null,
               "itemTitle": null, "itemType": null, "createdAt": "...", "archivedAt": null, "processed": false, "processedAt": null, "error": "",
               "ogTitle": "", "ogDescription": "", "ogSiteName": "", "thumbnailUrl": null,
               "suggestedTags": [], "summary": "", "suggestedDestination": "" }
```

Only `http` and `https` URLs are accepted. `GET /api/inbox?status=inbox&q=bakery` lists entries (`q` matches
`ogTitle`, `text` or `url`). `GET /api/inbox/count?status=inbox` answers `{ "count": 12 }` (one COUNT, `status`
defaults to inbox; the badge in the top bar). `DELETE /api/inbox/{id}` (`204`) removes an entry and its thumbnail file
when no other entry and no Item (of any owner) uses that file; evidence made from it keeps its title.
`PATCH /api/inbox/{id}`
records the weekly triage and accepts only `{ "status": "inbox|later|archived", "item": <item id>|null }`.
`archivedAt` is set when the status becomes archived, kept while it stays
archived and cleared (`null`) when it leaves the archive. Linking an Item that has no image gives it its own copy of
the entry's thumbnail (re-encoded for Items, no network request; the Item's `imageUrl`) and ends a fetch of the
Item's image that waits or runs; an Item that has an image keeps it, and a project or a tool never gets one this way
(a page's OG image is a banner, not a logo; a tool's logo fetch goes on). An entry linked before its unfurl finished passes the thumbnail on when the unfurl
stores it. Unlinking or
deleting the entry later leaves the Item's image alone.
`suggestedDestination` is one of read_later, book, opportunity, note (or empty until processed).
`itemTitle` and `itemType` (read only) label the linked Item, `null` when `item` is `null`.

## Weeks (`/api/weeks`)

A week runs Monday to Sunday in Europe/Prague; `{start}` is its Monday as `YYYY-MM-DD` (another weekday answers
`400`, an impossible date `404`). `GET /api/weeks/current` returns this week and creates it empty on first access.
`GET /api/weeks` lists weeks, newest `startDate` first (cursor pagination).

```json
200 { "id": 3, "startDate": "2026-11-02", "planningJournal": "", "plannedAt": null,
      "reviewWin": "", "reviewDistraction": "", "reviewLearned": "", "reviewSatisfied": "",
      "reviewChangedMind": "", "reviewOpportunityEvidence": "", "reviewedAt": null,
      "objectives": [ { "id": 9, "title": "Ship Week", "status": "open", "position": 0, "carriedFrom": null,
                        "createdAt": "...", "updatedAt": "..." } ],
      "createdAt": "...", "updatedAt": "..." }
```

Planning. `GET /api/weeks/{start}/plan` (creates the week) answers `{ "week": <week>, "carryCandidates": [ { "id": 5,
"title": "...", "weekStart": "2026-10-26", "carried": false } ] }`: the open objectives of the latest earlier week.
`POST /api/weeks/{start}/plan` carries the chosen ones over and saves the journal; repeating it changes nothing.

```json
request  { "carry": [5, 6], "planningJournal": "What I expect this week" }   (both optional)
response 200 <week>
```

An id that is not an open objective of that earlier week answers `400`.
`POST /api/weeks/{start}/objectives` `{ "title": "..." }` adds an objective at the end (`201`);
`PATCH /api/weeks/{start}/objectives/{id}` accepts `title`, `status` (open, done, dropped) and `position`;
`DELETE /api/weeks/{start}/objectives/{id}` (`204`) removes it: objectives carried from it keep their title with
`carriedFrom: null`, time entries linked to it lose the link.
3–5 objectives per week is a guideline shown in the UI, not enforced.

Review. `PATCH /api/weeks/{start}/review` saves any of `reviewWin`, `reviewDistraction`, `reviewLearned`,
`reviewSatisfied`, `reviewChangedMind`, `reviewOpportunityEvidence` and sets `reviewedAt`; it answers `<week>`.
`GET /api/weeks/{start}/review` (`404` if the week was never opened) answers:

```json
200 { "week": <week>, "objectiveCounts": { "open": 1, "done": 3, "dropped": 0 },
      "days": [ { "date": "2026-11-02", "inboxArchived": [ { "id": 7, "title": "..." } ],
                  "itemsFinished": [ { "id": 1, "title": "Deep Work", "type": "book" } ],
                  "pagesDone": [ { "book": "garden-notes", "page": "01-soil-..." } ] }, ... 7 days ] }
```

Body of work per day: inbox entries with status archived (by `archivedAt`), Items by `finishedAt`,
handbook pages marked done (by their last update). Each day also has `minutesForObjectives` and `minutesOther`
(finished time entries of that date; "for objectives" = linked to one of this week's objectives), and the review
has a week total for the chart:

```json
"time": { "minutesForObjectives": 120, "minutesOther": 60,
          "byObjective": [ { "id": 9, "title": "Ship Week", "minutes": 120 } ] }
```

The review also answers "which opportunity got more evidence" (evidence recorded this week, see Opportunities)
and lists the stale ones as of the end of the week (or now for the current week):

```json
"opportunities": { "withEvidence": [ { "id": 2, "title": "Bakery stock", "decision": "keep", "supports": 2,
                                       "contradicts": 1 } ],
                   "stale": [ { "id": 5, "title": "...", "decision": "open", "lastEvidenceAt": null } ] }
```

`achievements` lists the brag-document lines dated in the week, oldest first (shape as in `/api/achievements`).

`rhythm` holds the practice-rhythm reminders (DECISIONS 6.5), counted from existing data:

```json
"rhythm": { "notes": 1, "achievements": 2, "predictionsDue": 0,
            "month": { "month": "2026-10", "booksFinished": 1, "notes": 6 },
            "quarter": null }
```

`notes`: notes created in the week; `achievements`: brag lines dated in it; `predictionsDue`: open predictions with
`checkOn` on or before the Sunday. The review is written at the end of the week, so the week whose Sunday is day
1-7 of a month holds the first review of that month: only then `month` describes the month that just ended (book
Items finished, notes created), else `null`. When that month is January, April, July or October, `quarter` describes
the quarter that just ended: `{ "year", "quarter" (1-4), "achievements", "projectsFinished", "predictionsOpen" }`
(`predictionsOpen` = every prediction not scored yet); else `null`.

## Projects and time (`/api/projects`, `/api/time-entries`)

A project is an Item with `type: "project"`; its id is the Item id. Money is a decimal string with two places in
`currency` (ISO 4217, default `CZK`). Minute totals count finished entries only (not a running timer).

```json
200 { "id": 4, "title": "Eshop", "status": "active", "tags": ["sme"], "source": "",
      "imageUrl": "/api/items/4/image?v=3f2a9c1e", "client": "Pekárna",
      "billing": "hourly", "price": null, "hourlyRate": "800.00", "currency": "CZK",
      "minutesTotal": 480, "minutesBillable": 360, "minutesNonBillable": 120,
      "earned": "4800.00", "effectiveRate": "600.00",
      "createdAt": "...", "updatedAt": "...", "startedAt": null, "finishedAt": null }
```

`earned` is the agreed `price` (fixed) or billable hours × `hourlyRate` (hourly). `effectiveRate` = `earned` /
all hours spent, non-billable included (Harvest style); `null` without time or without a price. `imageUrl` (read
only) is the project's logo, the Item image (`null` without one): set, replaced and removed through
`/api/items/{id}/image` (see Items). A project never fetches its logo from `source` by itself.
`GET /api/projects?status=active` lists projects (cursor pagination, newest first), `GET /api/projects/{id}` reads
one. `POST /api/projects` (`201`) creates the Item and its details; `PATCH /api/projects/{id}` changes any of them.
Fields: `title` (required on create), `status`, `tags`, `source`, `startedAt`, `finishedAt`, `client`,
`billing` (fixed, hourly), `price`, `hourlyRate`, `currency`. An hourly project without `hourlyRate` answers `400`.
A `status` change (the Dự án board sends only `status`) moves `startedAt` and `finishedAt` by the Items rule: active
sets the start, done the finish, planned clears both, dropped clears the finish; dates sent in the same request win.

Time entries:

```json
200 { "id": 12, "project": 4, "projectTitle": "Eshop", "objective": 9, "date": "2026-11-02", "minutes": 90,
      "startedAt": null, "running": false, "note": "checkout", "billable": true, "createdAt": "...", "updatedAt": "..." }
```

`GET /api/time-entries?project=4&from=2026-11-02&to=2026-11-08` lists entries, newest `date` first (cursor
pagination; all filters optional, dates inclusive). `POST /api/time-entries` `{ "project": 4, "date": "2026-11-02",
"minutes": 90, "note": "", "billable": true, "objective": 9 }` (`201`; `minutes` 1–1440, `objective` optional)
records time by hand; `PATCH /api/time-entries/{id}` accepts the same fields. A project or objective that is not
the owner's answers `400`. Minutes of a running entry cannot be patched (`400`, stop it first).
`DELETE /api/time-entries/{id}` (`204`) removes one of the owner's entries; a running timer is discarded (no
minutes recorded). Another owner's or an unknown id answers `404`.

Timer. `GET /api/time-entries/timer` answers `{ "running": <entry>|null }`. `POST /api/time-entries/timer/start`
`{ "project": 4, "note": "", "billable": true, "objective": 9 }` (only `project` required) stops a running timer and
starts a new entry dated today (`201`, `minutes: null`, `running: true`). `POST /api/time-entries/timer/stop`
answers the stopped entry (minutes rounded, at least 1), `404` when nothing runs. One running timer per owner.

`GET /api/time-entries/summary?week=2026-11-02` (a Monday; default this week, another weekday `400`):

```json
200 { "weekStart": "2026-11-02", "minutesTotal": 210, "minutesBillable": 120, "minutesNonBillable": 90,
      "projects": [ { "id": 4, "title": "Eshop", "client": "Pekárna", "minutesTotal": 150,
                      "minutesBillable": 120, "minutesNonBillable": 30 } ] }
```

## Opportunities (`/api/opportunities`)

An opportunity is a niche hypothesis of the owner's (DECISIONS 9.2). `decision` is `open` (undecided), `keep`,
`drop` or `build`; `decidedAt` is set when it changes to keep/drop/build and cleared when it goes back to open.

```json
200 { "id": 2, "title": "Bakery stock", "hypothesis": "Small bakeries lose money on waste and pay for a forecast.",
      "whyNow": "...", "nextAction": "Talk to 3 bakers", "decideBy": "2026-12-01", "decision": "keep",
      "decidedAt": "...", "scores": { "opportunity": 7, "pain": 8, "feasibility": 5, "timing": 6, "createdAt": "..." },
      "evidenceSupports": 2, "evidenceContradicts": 1, "lastEvidenceAt": "...", "stale": false,
      "fit": [ { "id": 3, "name": "Python", "freshness": "fresh" } ], "createdAt": "...", "updatedAt": "..." }
```

`scores` is the newest snapshot (`null` if never scored). `stale` is computed: decision open or keep and no
evidence recorded for 4 weeks (counted from `createdAt` when there is none); "recorded" is the evidence's
`createdAt`, not its `date`. `GET /api/opportunities?decision=keep&stale=true` lists them (cursor pagination,
newest first; both filters optional, `stale` is `true` or `false`). `GET /api/opportunities/{id}` adds `evidence`
(newest `date` first) and `scoreHistory` (newest first). `POST /api/opportunities` (`201`, answers the detail)
takes `title` and `hypothesis` (required), `whyNow`, `nextAction`, `decideBy`, `decision` and optional `scores`
(the first snapshot); `PATCH /api/opportunities/{id}` changes the same fields except `scores`.
`fit` ("hợp với mình") is written as a list of skill ids (`/api/skills`) and replaces the set; it reads as
`{ id, name, freshness }` sorted by name. A skill that is not the owner's answers `400`.

Scores. `POST /api/opportunities/{id}/scores` `{ "opportunity": 7, "pain": 8, "feasibility": 5, "timing": 6,
"note": "why" }` (each 1–10, all four required) records a new snapshot (`201`); older snapshots never change:

```json
201 { "id": 4, "opportunity": 7, "pain": 8, "feasibility": 5, "timing": 6, "note": "why", "createdAt": "..." }
```

Evidence:

```json
{ "id": 8, "kind": "inbox", "stance": "supports", "title": "Bakery news", "url": "https://...", "note": "...",
  "date": "2026-11-02", "inboxEntry": 7, "item": null, "libraryNote": null, "createdAt": "...", "updatedAt": "..." }
```

`POST /api/opportunities/{id}/evidence` (`201`): `kind` and `stance` (supports, contradicts) required; `inbox`
needs `inboxEntry`, `item` needs `item`, `note` needs `libraryNote` (title defaults to the linked row's);
`conversation` (a real talk, The Mom Test) needs `title`; `link` (an external source, later a morning-brief story)
needs `title` and `url`. `date` defaults to today. A linked row that is not the owner's, a link that does not match
the kind, or an inbox entry already attached to this opportunity answers `400`.
`PATCH /api/opportunities/{id}/evidence/{evidenceId}` accepts `stance`, `title`, `url`, `note`, `date`;
`DELETE /api/opportunities/{id}/evidence/{evidenceId}` (`204`) removes it (the linked row stays; `stale` is computed
again).

Weekly triage in one action: `POST /api/opportunities/{id}/evidence/inbox`
`{ "inboxEntry": 7, "stance": "supports", "note": "", "title": "", "date": "...", "archive": true }` (only
`inboxEntry` and `stance` required; `date` defaults to the day the entry was captured, `archive` to `true`) makes
the entry evidence and archives it. It answers `201` with `{ "evidence": <evidence>, "created": true,
"inboxStatus": "archived" }`, or `200` with `created: false` when the entry was already attached.

Morning-brief button ("tin này là bằng chứng cho cơ hội nào"): `POST /api/opportunities/{id}/evidence/news`
`{ "newsItem": 31, "stance": "supports", "title": "", "note": "", "date": "..." }` (only `newsItem` and `stance`
required) records the news item (`/api/news`) as `link` evidence: title and URL from the item, `note` defaults to its
summary, `date` to the day it was published (else fetched). It answers `201` with `{ "evidence": <evidence>,
"created": true }`, or `200` with `created: false` when this URL is already link evidence of the opportunity. A news
item that is not the owner's answers `400`, an opportunity that is not the owner's `404`.

## Skills (`/api/skills`)

A row of the portable skills matrix (DECISIONS 6.5). There is no self-rating: `freshness` is computed from the
newest evidence `date`: `fresh` (within 3 months), `aging` (3 to 6 months), `faded` (6 months or more, or no
evidence). Market matching uses the name and `aliases`, both lowercased with single spaces.

```json
200 { "id": 3, "name": "PostgreSQL", "aliases": ["postgres"], "note": "", "freshness": "aging",
      "lastEvidenceOn": "2026-07-10", "evidenceCount": 2, "createdAt": "...", "updatedAt": "..." }
```

`GET /api/skills?freshness=faded&q=sql` lists skills by name (cursor pagination, `limit` up to 200; filters
optional, `q` matches the name or an alias).
`GET /api/skills/{id}` adds `evidence` (newest `date` first). `POST /api/skills` (`201`, answers the detail) takes
`name` (required), `aliases`, `note`; `PATCH /api/skills/{id}` the same fields (`aliases` replaces the list). A name
or alias already used by another skill of the owner answers `400`.

Evidence:

```json
{ "id": 5, "kind": "item", "title": "Pekárna eshop", "url": "", "note": "", "date": "2026-10-01",
  "item": 4, "libraryNote": null, "createdAt": "...", "updatedAt": "..." }
```

`POST /api/skills/{id}/evidence` (`201`): `kind` required; `item` needs `item` (a library Item, a shipped work
project too), `note` needs `libraryNote` (title defaults to the linked row's), `link` (an article, a public repo, a
case study online) needs `title` and `url`. `date` (when it was shipped or written) defaults to today. A linked row
that is not the owner's or a link that does not match the kind answers `400`.
`PATCH /api/skills/{id}/evidence/{evidenceId}` accepts `title`, `url`, `note`, `date`;
`DELETE /api/skills/{id}/evidence/{evidenceId}` answers `204`.

## Brag document (`/api/achievements`)

One line per thing done, written every week (DECISIONS 4.8, 6.5), with the impact in numbers for the CV.

```json
request  { "title": "Ship checkout", "impact": "Checkout 40 s -> 12 s", "description": "...", "date": "2026-10-28",
           "project": 4, "skills": [3, 7] }                  (only title required; date defaults to today)
response 201 { "id": 2, "date": "2026-10-28", "title": "Ship checkout", "description": "...",
               "impact": "Checkout 40 s -> 12 s", "project": 4, "projectTitle": "Eshop",
               "skills": [ { "id": 3, "name": "Django" } ], "createdAt": "...", "updatedAt": "..." }
```

`GET /api/achievements?week=2026-10-26` lists achievements, newest `date` first (cursor pagination); `week` (a
Monday; another weekday `400`) keeps that week's dates; `q` matches title, impact or description.
`GET /api/achievements/{id}` reads one. `PATCH /api/achievements/{id}` accepts the same fields;
`skills` replaces the links, `project: null` removes it. `project` must be an Item of type project of the owner and
`skills` the owner's skill ids (skills sorted by name in the answer), otherwise `400`.
`DELETE /api/achievements/{id}` (`204`) removes the line; the project Item and skills stay.

## Predictions (`/api/predictions`)

Write a prediction, score it again after 6 months (DECISIONS 4.8, 6.2).

```json
request  { "statement": "Gemini 4 ships before June", "madeOn": "2026-08-31", "confidence": 7 }
response 201 { "id": 5, "statement": "Gemini 4 ships before June", "madeOn": "2026-08-31",
               "checkOn": "2027-02-28", "confidence": 7, "outcome": "open", "note": "", "scoredAt": null,
               "createdAt": "...", "updatedAt": "..." }
```

`statement` is required; `madeOn` defaults to today, `checkOn` to `madeOn` + 6 months (clamped to the month's last
day), `confidence` is 1-10 or null, `outcome` is open, right, wrong or partial. `checkOn` before `madeOn` answers
`400`. `GET /api/predictions` lists them (cursor pagination, newest first); `?due=true` keeps the open ones whose
`checkOn` is today or earlier (Europe/Prague), `?due=false` the others, `?outcome=` filters by outcome, `?q=`
matches the statement or note. `GET /api/predictions/{id}` reads one. `PATCH /api/predictions/{id}` accepts the same fields: re-scoring sets `outcome` and `note`; `scoredAt` is set when
the outcome leaves `open` and cleared when it goes back. `DELETE /api/predictions/{id}` answers `204`.

## Market (`/api/market`)

Each month the owner pastes 5 to 10 job ads for the target roles (DECISIONS 9.5). Months are `YYYY-MM`.

```json
200 { "id": 9, "title": "Product Engineer", "company": "Acme", "url": "https://...", "text": "...",
      "month": "2026-11", "skills": ["python", "llm apis", "german"], "seniority": "senior",
      "processed": true, "processedAt": "...", "error": "", "createdAt": "...", "updatedAt": "..." }
```

`GET /api/market/job-ads?month=2026-11` lists ads (cursor pagination, newest first; `month` optional; `q`
matches title or company). `GET /api/market/job-ads/{id}` reads one.
`POST /api/market/job-ads` (`201`) takes `title` and `text` (required, text up to 20,000 characters), `company`,
`url`, `month` (default this month) and returns at once with `processed: false`; a background job asks the LLM
for the skills (up to 15 short lowercase names) and `seniority` (junior, mid, senior, lead, unknown). An invalid
reply leaves `processed: false` with `error`; a rate limit retries on a later run. `PATCH /api/market/job-ads/{id}`
accepts the same fields; changed `title`, `company` or `text` clears the result and extracts again, `skills` sent
by hand sets the result and skips the job. `DELETE /api/market/job-ads/{id}` (`204`) removes the ad from the
report; a pending extraction finds nothing and stops.

`GET /api/market/report?month=2026-11` (default this month):

```json
200 { "month": "2026-11", "jobAds": 8, "processed": 7,
      "seniority": [ { "level": "senior", "count": 5 } ],
      "skills": [ { "name": "PostgreSQL", "count": 4, "previousCount": 2,
                    "skill": { "id": 3, "name": "PostgreSQL", "freshness": "faded", "lastEvidenceOn": "2026-03-01" },
                    "gap": true } ],
      "gaps": [ ... ] }
```

`count` is the number of processed ads of the month asking for the skill (once per ad), `previousCount` the same
for the previous month. A requested name matches a skill by its normalised name or an alias (shown under the
skill's name), otherwise `skill` is `null`. `gap` (and the `gaps` subset) = asked for, and no skill or a faded one.
Sorted by `count`, then name. `newTools` lists up to 20 morning-brief news items (shape as in `/api/news`) fetched
in that month and tagged "new tool/skill", most relevant first; the UI asks the two questions of DECISIONS 6.1 next
to them.

## Morning brief (`/api/brief`, `/api/news`)

Feeds (`Source`, managed in the admin or with `manage.py brief_sources`) are fetched by background jobs; each new
item is tagged by the LLM in the background (at most `BRIEF_TAG_DAILY_CAP` a day, the rest stays `skipped`). A news
item:

```json
{ "id": 31, "source": { "id": 2, "name": "Simon Willison", "area": "ai" }, "title": "...", "url": "https://...",
  "published": "2026-11-02T05:10:00Z", "excerpt": "first 500 characters, plain text",
  "tags": ["ai", "ai tools"], "summary": "một dòng tiếng Việt", "newTool": true, "relevance": 4,
  "tagStatus": "tagged", "createdAt": "...", "feedback": null }
```

`area` is one of `ai`, `business`, `psychology`, `geopolitics`, `science`, `health` (DECISIONS 6.2). `tagStatus`:
`queued` (waiting for the LLM), `tagged`, `failed` (invalid reply; no tags), `skipped` (over the daily cap).
`published` may be `null`; `relevance` is 1-5 or `null` until tagged.

`GET /api/news` lists items, newest fetched first (cursor pagination). Filters, all optional: `tag` (one topic tag),
`newTool=true|false`, `date=YYYY-MM-DD` (fetched that day, Europe/Prague), `minRelevance=1..5`, `source` (id),
`tagStatus`, `q` (matches the title). An invalid filter answers `400`.

`GET /api/brief/today` and `GET /api/brief/{date}` (YYYY-MM-DD) answer the day's brief, or `404` before the 06:30
job has built it (an impossible date answers `400`):

```json
200 { "date": "2026-11-02", "intro": "2-3 câu tiếng Việt, or empty", "generatedAt": "...",
      "items": [ <news item>, ... ] }
```

`items` (up to 8, in order) are the most relevant tagged items of the last 48 hours not shown in an earlier brief.

Feedback (the "hữu ích / không" button, DECISIONS 5, 10.3): `PATCH /api/news/{id}` `{ "feedback": "useful" }`
(`useful`, `not_useful`, or `null` to clear) answers the news item; a body without `feedback` changes nothing
(PATCH semantics, as the OpenAPI schema documents it). Every news item, in lists
and briefs, carries `feedback` (`null` when not rated). Another owner's item answers `404`.
`manage.py export_brief_feedback` writes the rated items into `backend/evals/news_tag/fb-<id>.json` for
`manage.py eval brief` (title, source, first 500 characters; expected relevance 3-5 for useful, 1-2 for not useful).

`GET /api/news/topics?weeks=8` (1-52, default 8) counts topic tags of the tagged items fetched per ISO week
(Europe/Prague), oldest week first, the running week last (replaces Exploding Topics, DECISIONS 9.2):

```json
200 { "weeks": [ { "week": "2026-W45", "start": "2026-11-02", "items": 37,
                   "topics": [ { "tag": "ai", "count": 21 }, { "tag": "economy", "count": 6 } ] } ] }
```

## Mapping to ProgressStore

| ProgressStore method | HTTP |
|---|---|
| `getAll()` | `GET /api/progress` (loaded once, then kept in memory) |
| `isDone(book, page)` | in-memory lookup |
| `setDone(book, page, done)` | `PUT /api/progress/{book}/{page}` (optimistic update) |
| `getLastVisited()` | in-memory |
| `setLastVisited(book, page, title?)` | `PUT /api/progress/last-visited` (debounced) |
| `subscribe(listener)` | client-side only |
