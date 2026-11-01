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

## Mapping to ProgressStore

| ProgressStore method | HTTP |
|---|---|
| `getAll()` | `GET /api/progress` (loaded once, then kept in memory) |
| `isDone(book, page)` | in-memory lookup |
| `setDone(book, page, done)` | `PUT /api/progress/{book}/{page}` (optimistic update) |
| `getLastVisited()` | in-memory |
| `setLastVisited(book, page, title?)` | `PUT /api/progress/last-visited` (debounced) |
| `subscribe(listener)` | client-side only |
