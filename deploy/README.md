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

## Not validated yet

The laptop has no Docker or nginx, so the Dockerfiles, `docker-compose.prod.yml` and `nginx/` have not been
run. First run on the VPS: `nginx -t` inside the nginx container, then the checks above, then open an
attachment whose name has Vietnamese characters (checks that nginx decodes the X-Accel-Redirect path).

## Still to do before going live

* Nightly encrypted `pg_dump` to object storage, monthly restore drill (DECISIONS 10.1).
* Uptime Kuma on `/healthz`; switch the CSP from report-only to enforcing after a week without violations in the browser
  console (there is no report endpoint yet).
