# API contract (phase 2, implemented by Django)

Contract only; phase 1 has no API client. Everything is **same origin** (`brain.example.com`), JSON, UTF-8.

## Authentication and CSRF

* The browser is already behind Cloudflare Access. Django authenticates with its **session cookie**
  (`sessionid`), created after the Access login (or derived from the Access JWT).
* Unsafe methods (`PUT`, `POST`, `DELETE`) must send the value of the `csrftoken` cookie in the
  **`X-CSRFToken`** header. Requests use `credentials: 'same-origin'`.
* Unauthenticated requests get `401 {"detail": "..."}`; CSRF failures get `403`.

## Identifiers

* `book`: book slug from `web/lib/books.ts` (ASCII, e.g. `handbook-08`).
* `page`: page path inside the book, without leading/trailing slash; the book's index page is the empty
  string, sent as `_index` in URLs. Example: `/docs/it/handbook-08/c5-m3-linux-commands-in-the-bash-shell/001-navigate-the-linux-file-system/`
  → book `handbook-08`, page `c5-m3-linux-commands-in-the-bash-shell/001-navigate-the-linux-file-system`.
  In URLs the page is percent-encoded as one segment (`/` → `%2F`).

## GET /api/me

```json
200 { "id": 1, "email": "alex@example.com", "name": "Alex" }
```

## GET /api/progress

Full progress snapshot, the same shape as `ProgressSnapshot` in `web/lib/progress/store.ts`.

```json
200 {
  "done": { "handbook-08": { "c5-m3-linux-commands-in-the-bash-shell/001-navigate-the-linux-file-system": true } },
  "lastVisited": { "bookSlug": "handbook-08", "pageSlug": "c5-m3-...", "title": "Navigate the Linux file system", "at": "2026-10-31T10:00:00Z" }
}
```

`lastVisited` is `null` when nothing was visited.

## PUT /api/progress/{book}/{page}

Mark one page done or not done. Idempotent.

```json
request  { "done": true }
response 200 { "book": "handbook-08", "page": "c5-m3-...", "done": true, "updatedAt": "2026-10-31T10:00:00Z" }
```

`400` for an unknown book or a malformed body. Unknown pages are accepted (content may change between imports).

## PUT /api/progress/last-visited

```json
request  { "book": "handbook-08", "page": "c5-m3-...", "title": "Navigate the Linux file system" }
response 200 { "bookSlug": "handbook-08", "pageSlug": "c5-m3-...", "title": "Navigate the Linux file system", "at": "2026-10-31T10:00:00Z" }
```

`title` is optional and for display only.

## Lists: cursor pagination

List endpoints return the newest rows first, 50 per page (`?limit=` up to 200):

```json
200 { "next": "http://.../api/items?cursor=cD0y...", "previous": null, "results": [ ... ] }
```

Follow `next` until it is `null`. Unknown ids answer `404`; validation errors answer `400` with field messages.

## Items (`/api/items`)

`GET /api/items?type=book&status=active` lists items (both filters optional). `POST /api/items` creates one,
`PATCH /api/items/{id}` changes any writable field.

```json
request  { "type": "book", "title": "Deep Work", "tags": ["Focus"], "source": "Cal Newport", "rating": 9 }
response 201 { "id": 1, "type": "book", "status": "planned", "title": "Deep Work", "tags": ["focus"],
               "source": "Cal Newport", "rating": 9, "createdAt": "...", "updatedAt": "...",
               "startedAt": null, "finishedAt": null }
```

`type`: course, book, film, article, project. `status`: planned, active, done, dropped. Tags are lowercased and
deduplicated; `rating` is 1-10 or null.

## Inbox (`/api/inbox`)

`POST /api/inbox` stores a capture and answers at once with `processed: false`; unfurl and AI tagging run later
in a background job, never inside the request.

```json
request  { "url": "https://example.com/post" }          (or { "text": "an idea" }; at least one is required)
response 201 { "id": 7, "url": "https://example.com/post", "text": "", "status": "inbox", "item": null,
               "createdAt": "...", "processed": false, "processedAt": null, "error": "",
               "ogTitle": "", "ogDescription": "", "ogSiteName": "", "thumbnailUrl": null,
               "suggestedTags": [], "summary": "", "suggestedDestination": "" }
```

Only `http` and `https` URLs are accepted. `GET /api/inbox?status=inbox` lists entries. `PATCH /api/inbox/{id}`
records the weekly triage and accepts only `{ "status": "inbox|later|archived", "item": <item id>|null }`.
`suggestedDestination` is one of read_later, book, opportunity, note (or empty until processed).

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
`PATCH /api/weeks/{start}/objectives/{id}` accepts `title`, `status` (open, done, dropped) and `position`.
3–5 objectives per week is a guideline shown in the UI, not enforced.

Review. `PATCH /api/weeks/{start}/review` saves any of `reviewWin`, `reviewDistraction`, `reviewLearned`,
`reviewSatisfied`, `reviewChangedMind`, `reviewOpportunityEvidence` and sets `reviewedAt`; it answers `<week>`.
`GET /api/weeks/{start}/review` (`404` if the week was never opened) answers:

```json
200 { "week": <week>, "objectiveCounts": { "open": 1, "done": 3, "dropped": 0 },
      "days": [ { "date": "2026-11-02", "inboxArchived": [ { "id": 7, "title": "..." } ],
                  "itemsFinished": [ { "id": 1, "title": "Deep Work", "type": "book" } ],
                  "pagesDone": [ { "book": "handbook-08", "page": "c5-m3-..." } ] }, ... 7 days ] }
```

Body of work per day: inbox entries with status archived (by their last update), Items by `finishedAt`,
handbook pages marked done (by their last update). Hours per objective come with TimeEntry (later step).

## Mapping to ProgressStore

| ProgressStore method | HTTP |
|---|---|
| `getAll()` | `GET /api/progress` (loaded once, then kept in memory) |
| `isDone(book, page)` | in-memory lookup |
| `setDone(book, page, done)` | `PUT /api/progress/{book}/{page}` (optimistic update) |
| `getLastVisited()` | in-memory |
| `setLastVisited(book, page, title?)` | `PUT /api/progress/last-visited` (debounced) |
| `subscribe(listener)` | client-side only |
