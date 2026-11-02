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

## Notes (`/api/notes`)

A note is markdown linked to any number of the owner's Items (DECISIONS 4.1). Note bodies stay private: they are
never sent to an LLM.

```json
request  { "title": "Deep Work: 3 ý chính", "markdown": "# ...", "items": [1, 4] }   (markdown required)
response 201 { "id": 3, "title": "Deep Work: 3 ý chính", "markdown": "# ...", "items": [1, 4],
               "itemLabels": [{ "id": 1, "title": "Deep Work", "type": "book" }, ...],
               "createdAt": "...", "updatedAt": "..." }
```

`GET /api/notes?q=focus&item=1` lists notes (cursor pagination, newest first; both filters optional): `q` matches
title or markdown (case-insensitive substring), `item` keeps notes linked to that Item id. `GET /api/notes/{id}`
reads one; `PATCH /api/notes/{id}` accepts `title`, `markdown` and `items` (replaces the links; `[]` removes them).
`items` are sorted ids; an Item that is not the owner's answers `400`. Markdown is up to 200,000 characters.
`itemLabels` (read only) gives the id, title and type of each linked Item, so a list can label its links without
loading every Item.

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

Only `http` and `https` URLs are accepted. `GET /api/inbox?status=inbox` lists entries. `PATCH /api/inbox/{id}`
records the weekly triage and accepts only `{ "status": "inbox|later|archived", "item": <item id>|null }`.
`archivedAt` is set when the status becomes archived, kept while it stays
archived and cleared (`null`) when it leaves the archive.
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

## Projects and time (`/api/projects`, `/api/time-entries`)

A project is an Item with `type: "project"`; its id is the Item id. Money is a decimal string with two places in
`currency` (ISO 4217, default `CZK`). Minute totals count finished entries only (not a running timer).

```json
200 { "id": 4, "title": "Eshop", "status": "active", "tags": ["sme"], "source": "", "client": "Pekárna",
      "billing": "hourly", "price": null, "hourlyRate": "800.00", "currency": "CZK",
      "minutesTotal": 480, "minutesBillable": 360, "minutesNonBillable": 120,
      "earned": "4800.00", "effectiveRate": "600.00",
      "createdAt": "...", "updatedAt": "...", "startedAt": null, "finishedAt": null }
```

`earned` is the agreed `price` (fixed) or billable hours × `hourlyRate` (hourly). `effectiveRate` = `earned` /
all hours spent, non-billable included (Harvest style); `null` without time or without a price.
`GET /api/projects?status=active` lists projects (cursor pagination, newest first), `GET /api/projects/{id}` reads
one. `POST /api/projects` (`201`) creates the Item and its details; `PATCH /api/projects/{id}` changes any of them.
Fields: `title` (required on create), `status`, `tags`, `source`, `startedAt`, `finishedAt`, `client`,
`billing` (fixed, hourly), `price`, `hourlyRate`, `currency`. An hourly project without `hourlyRate` answers `400`.

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
`PATCH /api/opportunities/{id}/evidence/{evidenceId}` accepts `stance`, `title`, `url`, `note`, `date`.

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

`GET /api/skills?freshness=faded` lists skills by name (cursor pagination, `limit` up to 200; filter optional).
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
Monday; another weekday `400`) keeps that week's dates. `PATCH /api/achievements/{id}` accepts the same fields;
`skills` replaces the links, `project: null` removes it. `project` must be an Item of type project of the owner and
`skills` the owner's skill ids (skills sorted by name in the answer), otherwise `400`.

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
`checkOn` is today or earlier (Europe/Prague), `?due=false` the others, `?outcome=` filters by outcome.
`PATCH /api/predictions/{id}` accepts the same fields: re-scoring sets `outcome` and `note`; `scoredAt` is set when
the outcome leaves `open` and cleared when it goes back.

## Market (`/api/market`)

Each month the owner pastes 5 to 10 job ads for the target roles (DECISIONS 9.5). Months are `YYYY-MM`.

```json
200 { "id": 9, "title": "Product Engineer", "company": "Acme", "url": "https://...", "text": "...",
      "month": "2026-11", "skills": ["python", "llm apis", "czech"], "seniority": "senior",
      "processed": true, "processedAt": "...", "error": "", "createdAt": "...", "updatedAt": "..." }
```

`GET /api/market/job-ads?month=2026-11` lists ads (cursor pagination, newest first; `month` optional).
`POST /api/market/job-ads` (`201`) takes `title` and `text` (required, text up to 20,000 characters), `company`,
`url`, `month` (default this month) and returns at once with `processed: false`; a background job asks the LLM
for the skills (up to 15 short lowercase names) and `seniority` (junior, mid, senior, lead, unknown). An invalid
reply leaves `processed: false` with `error`; a rate limit retries on a later run. `PATCH /api/market/job-ads/{id}`
accepts the same fields; changed `title`, `company` or `text` clears the result and extracts again, `skills` sent
by hand sets the result and skips the job.

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
  "tagStatus": "tagged", "createdAt": "..." }
```

`area` is one of `ai`, `business`, `psychology`, `geopolitics`, `science`, `health` (DECISIONS 6.2). `tagStatus`:
`queued` (waiting for the LLM), `tagged`, `failed` (invalid reply; no tags), `skipped` (over the daily cap).
`published` may be `null`; `relevance` is 1-5 or `null` until tagged.

`GET /api/news` lists items, newest fetched first (cursor pagination). Filters, all optional: `tag` (one topic tag),
`newTool=true|false`, `date=YYYY-MM-DD` (fetched that day, Europe/Prague), `minRelevance=1..5`, `source` (id),
`tagStatus`. An invalid filter answers `400`.

`GET /api/brief/today` and `GET /api/brief/{date}` (YYYY-MM-DD) answer the day's brief, or `404` before the 06:30
job has built it (an impossible date answers `400`):

```json
200 { "date": "2026-11-02", "intro": "2-3 câu tiếng Việt, or empty", "generatedAt": "...",
      "items": [ <news item>, ... ] }
```

`items` (up to 8, in order) are the most relevant tagged items of the last 48 hours not shown in an earlier brief.

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
