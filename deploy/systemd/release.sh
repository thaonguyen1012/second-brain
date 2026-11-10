#!/usr/bin/env bash
# Put a copy of Alex's Brain in /srv/brain/app into service (deploy/README.md, "systemd"). As root:
#   sudo BRAIN_HOST=brain.example.com /srv/brain/app/deploy/systemd/release.sh            backend and web
#   sudo BRAIN_HOST=brain.example.com /srv/brain/app/deploy/systemd/release.sh --backend  backend only (no Next build)
# The Next build runs as brain in a transient slice of its own (brain-build.slice) with a memory cap and a low CPU
# and IO weight, so other services on the same machine keep their memory and most of the CPU, and the running site of the
# Brain keeps its own slice; a build that passes the cap is killed, nothing else is.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root (sudo)"; exit 1; }
host=${BRAIN_HOST:-brain.example.com}
app=/srv/brain/app
uv=/srv/brain/tools/bin/uv
web=${1:---all}

install -d -o brain -g brain -m 0750 /srv/brain /srv/brain/thumbs /srv/brain/staticfiles /srv/brain/backups \
  /srv/brain/content /srv/brain/files
install -d -o brain -g brain -m 0750 /var/lib/brain /var/lib/brain/uv-cache /var/lib/brain/npm-cache
chown brain:brain "$app" && chmod 0750 "$app"

echo "== backend: uv sync (locked, no dev)"
sudo -u brain env UV_CACHE_DIR=/var/lib/brain/uv-cache UV_PYTHON=/usr/bin/python3.13 UV_PYTHON_DOWNLOADS=never \
  "$uv" sync --frozen --no-dev --project "$app/backend"
test -f "$app/backend/.env" || { echo "missing $app/backend/.env (deploy/README.md)"; exit 1; }
chown brain:brain "$app/backend/.env" && chmod 0600 "$app/backend/.env"

if [ "$web" != --backend ]; then
  echo "== web: npm ci and next build in brain-build.slice (MemoryMax 2300M, CPUWeight 20); 10 to 20 minutes on 1 OCPU"
  run=(systemd-run --wait --pipe --collect --quiet --uid=brain --gid=brain --slice=brain-build.slice
       -p MemoryHigh=1800M -p MemoryMax=2300M -p MemorySwapMax=2G -p CPUWeight=20 -p IOWeight=20 -p Nice=15
       -p OOMScoreAdjust=800
       --setenv=HOME=/var/lib/brain --setenv=npm_config_cache=/var/lib/brain/npm-cache
       --setenv=NEXT_TELEMETRY_DISABLED=1 --setenv=NEXT_PUBLIC_PROGRESS_STORE=api
       --setenv=CONTENT_DIR=/srv/brain/content --setenv=SEARCH_DB=/srv/brain/search.sqlite
       --setenv=ROADMAP_FILE=/srv/brain/roadmap.json
       --setenv=NODE_OPTIONS=--max-old-space-size=1536
       --working-directory="$app/web")
  "${run[@]}" /usr/bin/npm ci --no-audit --no-fund
  "${run[@]}" /usr/bin/npm run build
  test -f "$app/web/.next/standalone/server.js"
  install -d -o brain -g brain -m 0750 "$app/web/.next/standalone/.next/cache"
fi

echo "== units"
systemctl stop brain-jobs.timer brain-jobs.service 2>/dev/null || true
systemctl restart brain-django
[ "$web" = --backend ] || systemctl restart brain-web
systemctl start brain-jobs.timer
sleep 3
systemctl --no-pager --quiet is-active postgresql@16-brain brain-django brain-web nginx brain-cloudflared brain-jobs.timer \
  && echo "all active" || { systemctl --no-pager status brain-django brain-web | tail -30; exit 1; }
curl -fsS -H "Host: $host" http://127.0.0.1:8080/healthz; echo
curl -fsS -o /dev/null -w 'web %{http_code}\n' -H "Host: $host" http://127.0.0.1:8080/
