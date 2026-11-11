# Deploy examples

Configuration examples for running Alex's Brain for one person, behind a login. Replace `brain.example.com` with your
own host name and the paths with yours. Two server variants share the same pieces (Postgres, Django under gunicorn,
the Next.js standalone server, nginx, cloudflared, the jobs runner):

* `docker-compose.prod.yml` + `nginx/`: one VPS runs everything in Docker (below);
* `systemd/`: the same stack as systemd units on a machine without Docker ("systemd", further down).

And for a laptop or desktop that is the server itself: `launchd/` (macOS agents for the jobs and the nightly backup).

In the Docker variant one VPS runs Postgres, Django (gunicorn), Next.js standalone, nginx and cloudflared.
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

* `web/content/docs` and `web/data/search.sqlite`: copied from the machine where you import handbooks (`rsync`),
  mounted read-only.
* Attachments: prepared by `node web/scripts/prepare-assets.mjs <slug> <folder>` into `web/public/files/`, copied to
  `FILES_DIR` (`deploy/.env`). nginx serves them only after `auth_request` and Django's `X-Accel-Redirect`.
* `deploy/.env` (Postgres password, tunnel token) and `backend/.env`.

## Start

```
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.prod.yml exec django uv run --no-sync python manage.py check --deploy
```

The web image is built with `NEXT_PUBLIC_PROGRESS_STORE=api` (inlined at build time).

## A laptop or desktop as the server, without Docker

Prerequisites: Postgres 16 running (Homebrew, apt, or `docker compose -f backend/docker-compose.yml up -d`), `backend/.env` filled in (see `backend/.env.example`), and the morning
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

`deploy/launchd/com.example.brain.jobs.plist` runs `manage.py run_jobs` every 300 s while you are logged in, without
a terminal (the feeds at their hours, the 06:30 brief, tagging). It is not installed; to install it:

```
cp deploy/launchd/com.example.brain.jobs.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.brain.jobs.plist
launchctl kickstart -k gui/$(id -u)/com.example.brain.jobs      # run once now
tail -f ~/Library/Logs/com.example.brain.jobs.log
```

To stop it: `launchctl bootout gui/$(id -u)/com.example.brain.jobs` (then delete the copied file).

* The paths inside are placeholders (`/Users/you/alex-brain`, `~/.local/bin/uv`, the log file): edit the copy
  before installing it.
* If the repo is under `~/Desktop` or `~/Documents`, which macOS protects: if the log shows "Operation not permitted", give `uv`
  (`~/.local/bin/uv`) Full Disk Access in System Settings > Privacy & Security, or move the repo out of Desktop.
* Do not run `make jobs` / `make dev` at the same time as the agent: it is safe (jobs are claimed with row locks)
  but doubles the free-tier LLM request rate.
* A sleeping laptop runs nothing; launchd runs the job once on wake, and the 06:30 brief is built on the first run
  after 06:30.

### Backups on the laptop

When the laptop is the server, its database is the real data (DECISIONS 10.1).

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
* Restoring for real (only after a loss; this replaces the data): stop Django and the jobs, then restore the dump and
  copy the images back, from the repository root:

  ```
  dropdb alex_brain && createdb alex_brain && pg_restore --no-owner --no-acl -d alex_brain backend/backups/<date>.dump
  mkdir -p backend/media/thumbs && cp backend/backups/thumbs/*.webp backend/media/thumbs/
  chmod 644 backend/media/thumbs/*.webp
  ```

  These are the default folders; when `backend/.env` sets `BACKUP_DIR` or `THUMBS_DIR`, put those paths in instead
  (they are read by Django, not set in the shell). `mkdir -p` because a fresh checkout has no image folder yet (the app
  creates it on its first image); 0644 because nginx, another user, sends the images on the VPS. A real restore is
  always both: the dump and the images.
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
for the jobs agent apply (placeholder paths, Full Disk Access for `uv` when the repo is in a protected folder).

### Capture from the browser and the phone

* Bookmarklet: the Inbox page shows a "Lưu vào Brain" button; drag it to the bookmarks bar. It opens
  `/inbox/them/?url=&title=&text=` on the origin it was dragged from (http://localhost:8080 with `make dev`,
  https://brain.example.com later; drag it again from the live site after going live). Only http/https pages.
* Phone: open the site, "Add to Home Screen" / "Install app", then Share -> Alex's Brain sends the link to the same
  page (Android share target; iOS Safari does not support share targets, use the bookmarklet there). Needs the
  Access bypass for the manifest and icons above. There is no service worker and nothing works offline.

## systemd (a server without Docker)

`systemd/` holds the same stack as units for a Linux machine without Docker: `brain-django.service` (gunicorn on
127.0.0.1:8001), `brain-web.service` (the Next standalone server), `brain-jobs.service` + `.timer` (every 5 minutes),
`brain-backup.service` + `.timer` (nightly), `brain-restore-check.service` + `.timer` (monthly), `brain-cloudflared`,
all in `brain.slice` (memory cap, lower CPU and IO weight, for a small shared server); `nginx/brain.conf` (nginx on
127.0.0.1:8080 only, Cloudflare Tunnel in front); `postgresql-brain.slice.conf` (a drop-in that puts a Postgres
cluster on port 5433 in the same slice); `backend.env.example` and `cloudflared.env.example`; `release.sh` (as root, from a root-owned copy:
`uv sync`, `npm ci` and `next build` in a capped transient slice, restart the units, check `/healthz`).

The units assume three system users and the app checked out in `/srv/brain/app`, with data folders under
`/srv/brain/` (`content`, `files`, `thumbs`, `staticfiles`, `backups`); change the paths in the units if yours
differ. `brain` runs Django, the jobs and the backups; `brain-web` runs Next with no secret and no database login
(it compiles handbook text, which may come from anyone); `brain-tunnel` runs cloudflared. No file those users can
read holds a secret: Django's settings live in `/etc/brain/backend.env` (root, 0600), which systemd hands to the
units (`EnvironmentFile`).

```bash
sudo useradd --system --home /var/lib/brain --create-home --shell /usr/sbin/nologin brain
sudo useradd --system --no-create-home --shell /usr/sbin/nologin brain-web
sudo useradd --system --no-create-home --shell /usr/sbin/nologin brain-tunnel
sudo install -d -o brain -g brain -m 0750 /srv/brain /srv/brain/app /srv/brain/content /srv/brain/files /srv/brain/thumbs /srv/brain/staticfiles /var/lib/brain/uv-cache /var/lib/brain/npm-cache
sudo install -d -o brain -g brain -m 0700 /srv/brain/backups
sudo install -d -m 0755 /etc/brain
sudo install -m 0600 -o root -g root /srv/brain/app/deploy/systemd/backend.env.example /etc/brain/backend.env   # then fill it in
```

Every folder and owner is set here, once: the release script runs as root and never creates, chowns or chmods
anything under `/srv/brain`, a tree `brain` can write. For the same reason it runs from a root-owned copy and
refuses to run from the checkout; read the diff before installing a changed version:

```bash
sudo install -o root -g root -m 0755 /srv/brain/app/deploy/systemd/release.sh /usr/local/sbin/brain-release
```

Then: the Postgres cluster and role, with the local socket asking for a password too (by default OS user `brain`
gets in by peer authentication):

```bash
sudo sed -i -E 's/^(local[[:space:]]+all[[:space:]]+all[[:space:]]+)peer/\1scram-sha-256/' /etc/postgresql/16/brain/pg_hba.conf
```

A TCP connection to 127.0.0.1 carries no login, so `brain.nft` lets only nginx (`www-data`) reach Next and
Gunicorn and only the tunnel and root reach nginx; keep the include after any `flush ruleset` line:

```bash
sudo install -m 0644 /srv/brain/app/deploy/systemd/brain.nft /etc/nftables.d-brain.nft
echo 'include "/etc/nftables.d-brain.nft"' | sudo tee -a /etc/nftables.conf
sudo nft -c -f /etc/nftables.d-brain.nft && sudo systemctl enable --now nftables
```

Copy the units to `/etc/systemd/system/` and the nginx file to `/etc/nginx/sites-enabled/`, the tunnel token into
`/etc/brain/cloudflared.env` (root, 0600), then run `sudo BRAIN_HOST=brain.example.com brain-release`
(`--backend` skips the Next build). `sudo -u nobody curl -sS http://127.0.0.1:8080/healthz` must fail with a reset.
The Cloudflare steps above are the same, with the tunnel's public hostname pointing at `http://localhost:8080`.

## Not validated yet

The author ran neither variant end to end: the Dockerfiles, `docker-compose.prod.yml`, `nginx/` and `systemd/` have not
been run. First run on the VPS: `nginx -t` inside the nginx container, then the checks above, then open an
attachment whose name has Vietnamese characters (checks that nginx decodes the X-Accel-Redirect path).

## Still to do before going live

* Nightly encrypted `pg_dump` to object storage, monthly restore drill (DECISIONS 10.1). The laptop part exists
  (`make backup`, `make restore-check`, launchd agent above, the systemd timers); the Docker VPS still needs a cron/systemd timer running
  `manage.py backup` in the django container, encryption (age or gpg) and the upload, of the dumps and of
  `BACKUP_DIR/thumbs/` (the images; the django container mounts the `thumbs` volume read-write for uploads).
* After the first deploy with Item images: restart django and jobs together right after `migrate`, so no old
  process discards an image file that an Item now shares with an inbox entry.
* Uptime Kuma on `/healthz`; switch the CSP from report-only to enforcing after a week without violations in the browser
  console (there is no report endpoint yet).
