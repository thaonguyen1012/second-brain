#!/usr/bin/env bash
# Put a copy of Alex's Brain in /srv/brain/app into service (deploy/README.md, "systemd"). Installed once as
# root-owned /usr/local/sbin/brain-release (0755) and run from there, never from the synced tree, which the user
# brain can write (security audit S-13):
#   sudo BRAIN_HOST=brain.example.com brain-release            backend and web
#   sudo BRAIN_HOST=brain.example.com brain-release --backend  backend only (no Next build)
# Root does no chown, chmod, install or write on any path under /srv/brain (brain could plant a link there): the
# folders and their owners are set once at provisioning (deploy/README.md), the secrets live in /etc/brain (root).
# uv sync, npm ci and the Next build run as brain in transient units with a filesystem sandbox (only the app's own
# folders and caches writable) and resource caps, so other services on the same machine keep its memory and most of the
# CPU; root only restarts units and reads the health check.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root (sudo)"; exit 1; }
host=${BRAIN_HOST:-brain.example.com}
case "$(readlink -f "$0")" in /srv/*) echo "run the root-owned copy (/usr/local/sbin/brain-release), not $0"; exit 1;; esac
app=/srv/brain/app
web=${1:---all}
for f in /etc/brain/backend.env /etc/brain/cloudflared.env; do
  [ "$(stat -c '%U %a' "$f")" = "root 600" ] || { echo "$f must be root, 0600 (deploy/README.md)"; exit 1; }
done

sandbox=(systemd-run --wait --pipe --collect --quiet --uid=brain --gid=brain --slice=brain-build.slice
  -p NoNewPrivileges=yes -p PrivateTmp=yes -p ProtectSystem=strict -p ProtectHome=yes -p PrivateDevices=yes
  -p ReadWritePaths=/var/lib/brain -p MemoryHigh=1800M -p MemoryMax=2300M -p MemorySwapMax=2G
  -p CPUWeight=20 -p IOWeight=20 -p Nice=15 -p OOMScoreAdjust=800 --setenv=HOME=/var/lib/brain)

echo "== backend: uv sync (locked, no dev)"
"${sandbox[@]}" -p ReadWritePaths="$app/backend" -p ReadOnlyPaths=/srv/brain/tools \
  --setenv=UV_CACHE_DIR=/var/lib/brain/uv-cache --setenv=UV_PYTHON=/usr/bin/python3.13 \
  --setenv=UV_PYTHON_DOWNLOADS=never --working-directory="$app/backend" \
  /srv/brain/tools/bin/uv sync --frozen --no-dev --project "$app/backend"

if [ "$web" != --backend ]; then
  echo "== web: npm ci and next build as brain (MemoryMax 2300M, CPUWeight 20); 10 to 20 minutes on 1 OCPU"
  build=("${sandbox[@]}" -p ReadWritePaths="$app/web" -p ReadOnlyPaths=/srv/brain/content
    --setenv=npm_config_cache=/var/lib/brain/npm-cache --setenv=NEXT_TELEMETRY_DISABLED=1
    --setenv=NEXT_PUBLIC_PROGRESS_STORE=api --setenv=CONTENT_DIR=/srv/brain/content
    --setenv=SEARCH_DB=/srv/brain/search.sqlite --setenv=ROADMAP_FILE=/srv/brain/roadmap.json --setenv=NODE_OPTIONS=--max-old-space-size=1536
    --working-directory="$app/web")
  "${build[@]}" /usr/bin/npm ci --no-audit --no-fund
  "${build[@]}" /usr/bin/npm run build
  # the ISR cache of brain-web (group brain, setgid so new files stay in the group)
  "${build[@]}" /usr/bin/install -d -m 2770 "$app/web/.next/standalone/.next/cache"
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
