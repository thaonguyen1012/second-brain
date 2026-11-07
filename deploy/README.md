# Deploy (config only, not deployed yet)

One VPS runs everything in Docker: Postgres, Django (gunicorn), Next.js standalone, nginx and cloudflared.
No port is published; the only way in is the Cloudflare Tunnel, and Cloudflare Access sits in front of it.

```
browser -> Cloudflare Access (login) -> Tunnel -> cloudflared -> nginx:8080 -> web:3000 | django:8000
```

## Cloudflare (Zero Trust dashboard, free plan)

1. **Tunnel**: Networks > Tunnels > Create (cloudflared). Copy the token into `deploy/.env` (`TUNNEL_TOKEN`).
   Public hostname: `brain.example.com` -> service `http://nginx:8080`.
2. **Access application**: Access > Applications > Self-hosted, domain `brain.example.com`, policy "Allow",
   include = the owner's email; login methods: one-time PIN (and Google if wanted). Session 24 h.
3. From the application's overview copy the **Application Audience (AUD) tag** and the team domain
   (`<team>.cloudflareaccess.com`) into `backend/.env`:

```
DEBUG=false
AUTH_MODE=cf_access
OWNER_EMAIL=<the email allowed by the Access policy>
CF_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com
CF_ACCESS_AUD=<AUD tag>
SECRET_KEY=<python -c "import secrets; print(secrets.token_urlsafe(50))">
```

4. **PWA files outside Access** (installing the app on a phone): browsers fetch the web app manifest without
   cookies, so behind Access the manifest request lands on the login page and the app cannot be installed (the
   share target then never appears). Add a second Access application, Self-hosted, with the paths
   `brain.example.com/manifest.webmanifest` and `brain.example.com/icons/*` and one policy with action **Bypass**,
   include Everyone. Those files are public metadata (name, colours, icons); every page, including the share
   target `/inbox/them/`, stays behind the login.

Django refuses to start with `DEBUG=false` and a missing Access value, and refuses `AUTH_MODE=dev` without
`DEBUG`. Every request must carry a valid `Cf-Access-Jwt-Assertion` for `OWNER_EMAIL` (RS256, keys from
`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, cached 1 h); otherwise the API answers 401.

## Files on the VPS (never in git)

* `web/content/docs` and `web/data/search.sqlite`: copied from the laptop (`rsync`), mounted read-only.
* Attachments: `raw/tai-lieu-so-tay-*` prepared by `npm run assets:prepare`, copied to `FILES_DIR`
  (`deploy/.env`). nginx serves them only after `auth_request` and Django's `X-Accel-Redirect`.
* `deploy/.env` (Postgres password, tunnel token) and `backend/.env`.

## Start

```
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.prod.yml exec django uv run --no-sync python manage.py check --deploy
```

The web image is built with `NEXT_PUBLIC_PROGRESS_STORE=api` (inlined at build time).

## Laptop: daily use without Docker

Prerequisites: Homebrew Postgres 16 running, `backend/.env` filled in (see `backend/.env.example`), and the morning
brief feeds added once:

```
cd backend && uv run python manage.py brief_sources seed     # the feeds DECISIONS 6.2 names; `list` shows them
```

* `make dev`: the whole app on one origin, like production. It builds the web app with
  `NEXT_PUBLIC_PROGRESS_STORE=api` (skip with `DEV_BUILD=0`), runs `migrate`, then starts Django on :8000, a Next
  production server on :3100 (`DEV_WEB_PORT`), the dev proxy on :8080 and the jobs loop. Open
  http://localhost:8080. It refuses to start when :8000, :8080 or :3100 is taken and never touches :3000 (`next
  dev`). Ctrl-C stops all four.
* `make dev-hot`: hot reload with the API store on http://localhost:3000, the origin that holds the old
  localStorage progress. Stop your own `next dev` first; it runs Django :8000, `next dev` :3001 and the dev proxy
  on :3000 (ARCHITECTURE.md, "Switching your own dev server to the API store").
* `make jobs`: only the jobs loop (`manage.py run_jobs` every 300 s, `JOBS_INTERVAL`), for when Django runs elsewhere.
* `GET /api/status` (or http://localhost:8080/api/status) shows this month's LLM cost against the budget, the last
  morning brief and the jobs waiting or failed.
* `manage.py export --out <dir>` writes the notes as markdown and everything else as JSON (DECISIONS 4.7);
  `manage.py export_brief_feedback` adds the rated news items to the `eval brief` golden set.

### Background jobs on the laptop (launchd)

`deploy/launchd/com.example.brain.jobs.plist` runs `manage.py run_jobs` every 300 s while Alex is logged in, without
a terminal (the feeds at their hours, the 06:30 brief, tagging). It is not installed; to install it:

```
cp deploy/launchd/com.example.brain.jobs.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.brain.jobs.plist
launchctl kickstart -k gui/$(id -u)/com.example.brain.jobs      # run once now
tail -f ~/Library/Logs/com.example.brain.jobs.log
```

To stop it: `launchctl bootout gui/$(id -u)/com.example.brain.jobs` (then delete the copied file).

* The paths inside are absolute (repo, `~/.local/bin/uv`, log file); edit the copy if the repo or uv moves.
* The repo is under `~/Desktop`, which macOS protects: if the log shows "Operation not permitted", give `uv`
  (`~/.local/bin/uv`) Full Disk Access in System Settings > Privacy & Security, or move the repo out of Desktop.
* Do not run `make jobs` / `make dev` at the same time as the agent: it is safe (jobs are claimed with row locks)
  but doubles the free-tier LLM request rate.
* A sleeping laptop runs nothing; launchd runs the job once on wake, and the 06:30 brief is built on the first run
  after 06:30.

### Backups on the laptop

DECISIONS 10.1, until the VPS exists: the dev database is the real data.

```
make backup          # pg_dump -Fc -> backend/backups/<date>.dump (gitignored), keeps the newest 14,
                     # then copies new images of THUMBS_DIR into backend/backups/thumbs/
make restore-check   # restores the newest dump into a throwaway database, prints row counts, drops it
```

* A second backup on the same day replaces that day's file. `BACKUP_DIR` and `BACKUP_KEEP` in `backend/.env` change
  the folder and the count; `manage.py restore_check --dump <file>` checks an older dump.
* Images (Item covers and logos, inbox thumbnails) are files in `THUMBS_DIR`, not rows, so the backup also copies
  every image that `BACKUP_DIR/thumbs/` does not have yet (0600 files in a 0700 folder). It never deletes there: a
  name is the hash of the bytes, so an image removed from the app stays available to the older dumps that name it.
* `restore-check` never writes to the dev database: it creates `alex_brain_restore_check_<pid>`, restores into it with
  `pg_restore --exit-on-error`, compares the row counts with the live database (a difference only means rows were
  written after the dump) and drops it, also when the restore fails. Run it once a month (the restore drill). It also
  prints `images: N referenced, M missing from the backup` (the image names in the restored rows that have no file in
  `thumbs/` next to the dump, up to 10 listed); that line is information and does not fail the check.
* The tools match the server version (Homebrew `postgresql@16` when the server is 16, since a pg_dump 17 file can
  carry settings a 16 server rejects); `PG_BIN_DIR=/path/to/bin` overrides.
* Restoring for real (only after a loss; this replaces the data): stop Django and the jobs, then
  `dropdb alex_brain && createdb alex_brain && pg_restore --no-owner --no-acl -d alex_brain backend/backups/<date>.dump`,
  and copy the images back: `cp backend/backups/thumbs/*.webp "$THUMBS_DIR"/ && chmod 644 "$THUMBS_DIR"/*.webp`
  (the `THUMBS_DIR` of `backend/.env`, default `backend/media/thumbs/`; 0644 because nginx, another user, sends them
  on the VPS). A real restore is always both: the dump and the images.
* The dumps sit on the same disk as the database: copy `backend/backups/` to another disk or cloud folder now and then.
  They are not encrypted (the encrypted upload to object storage belongs to the VPS, see "Still to do"). Each dump is
  the whole database (password hash, sessions, every note): `manage.py backup` writes them 0600 in a 0700 folder, and
  every copy must stay owner-only (`cp -p`, `rsync -a`, a private folder) or be encrypted (for example
  `gpg --symmetric`) before it goes to a shared disk or a cloud folder.

Nightly, without a terminal: `deploy/launchd/com.example.brain.backup.plist` runs `manage.py backup` at 02:30 (on wake
when the laptop slept through it). Not installed; to install it:

```
cp deploy/launchd/com.example.brain.backup.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.brain.backup.plist
launchctl kickstart -k gui/$(id -u)/com.example.brain.backup      # run once now
tail ~/Library/Logs/com.example.brain.backup.log
```

To stop it: `launchctl bootout gui/$(id -u)/com.example.brain.backup` (then delete the copied file). The same notes as
for the jobs agent apply (absolute paths, Full Disk Access for `uv` while the repo is under `~/Desktop`).

### Capture from the browser and the phone

* Bookmarklet: the Inbox page shows a "Lưu vào Brain" button; drag it to the bookmarks bar. It opens
  `/inbox/them/?url=&title=&text=` on the origin it was dragged from (http://localhost:8080 with `make dev`,
  https://brain.example.com later; drag it again from the live site after going live). Only http/https pages.
* Phone: open the site, "Add to Home Screen" / "Install app", then Share -> Alex's Brain sends the link to the same
  page (Android share target; iOS Safari does not support share targets, use the bookmarklet there). Needs the
  Access bypass for the manifest and icons above. There is no service worker and nothing works offline.

## Not validated yet

The laptop has no Docker or nginx, so the Dockerfiles, `docker-compose.prod.yml` and `nginx/` have not been
run. First run on the VPS: `nginx -t` inside the nginx container, then the checks above, then open an
attachment whose name has Vietnamese characters (checks that nginx decodes the X-Accel-Redirect path).

## Still to do before going live

* Nightly encrypted `pg_dump` to object storage, monthly restore drill (DECISIONS 10.1). The laptop part exists
  (`make backup`, `make restore-check`, launchd agent above); the VPS still needs a cron/systemd timer running
  `manage.py backup` in the django container, encryption (age or gpg) and the upload, of the dumps and of
  `BACKUP_DIR/thumbs/` (the images; the django container mounts the `thumbs` volume read-write for uploads).
* After the first deploy with Item images: restart django and jobs together right after `migrate`, so no old
  process discards an image file that an Item now shares with an inbox entry.
* Uptime Kuma on `/healthz`; switch the CSP from report-only to enforcing after a week without violations in the browser
  console (there is no report endpoint yet).
