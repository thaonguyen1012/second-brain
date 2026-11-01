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

## Not validated yet

The laptop has no Docker or nginx, so the Dockerfiles, `docker-compose.prod.yml` and `nginx/` have not been
run. First run on the VPS: `nginx -t` inside the nginx container, then the checks above, then open an
attachment whose name has Vietnamese characters (checks that nginx decodes the X-Accel-Redirect path).

## Still to do before going live

* Nightly encrypted `pg_dump` to object storage, monthly restore drill (DECISIONS 10.1).
* Uptime Kuma on `/healthz`; switch the CSP from report-only to enforcing after a week without violations in the browser
  console (there is no report endpoint yet).
