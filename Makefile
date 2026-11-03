# One command for the whole repo: make check (DECISIONS.md 10.3).
SMOKE_BASE ?= auto
SMOKE_FLAGS ?=
SMOKE_SAMPLE ?= 20
E2E_BASE ?= http://127.0.0.1:8080
UV := cd backend && uv run

BUDGET_KB ?= 220
JOBS_INTERVAL ?= 300
DEV_WEB_PORT ?= 3100
DEV_BUILD ?= 1
DEV_HOT_PORT ?= 3001

.PHONY: check web-check backend-check smoke budget e2e api-types backend-dev build jobs dev dev-hot backup restore-check audit

check: web-check backend-check smoke budget

web-check:
	cd web && npm run --silent types:check
	cd web && npm run --silent lint
	cd web && npm run --silent test

backend-check:
	$(UV) ruff check .
	$(UV) ruff format --check .
	$(UV) mypy .
	$(UV) python manage.py makemigrations --check --dry-run
	$(UV) pytest

# Needs a running web server at SMOKE_BASE (auto = the owner's next dev on :3000, else make dev on :8080).
# The pre-commit hook passes SMOKE_FLAGS=--optional: with no server it warns and skips instead of failing.
smoke:
	node web/scripts/smoke-test.mjs --base $(SMOKE_BASE) --sample $(SMOKE_SAMPLE) $(SMOKE_FLAGS)

# Home First Load JS (gzip) of the last `npm run build`; skipped when there is no build (DECISIONS 10.2, 10.3).
# Only as fresh as that build: it warns when app/, components/ or lib/ sources are newer than it.
budget:
	node web/scripts/check-budget.mjs --max-kb $(BUDGET_KB)

# Playwright flows (DECISIONS 10.3: home, lesson, search, dark mode) in the installed Google Chrome, against the
# whole stack at E2E_BASE (default: the make dev proxy on :8080). Read-only: every write to /api/ is aborted in the
# browser before it is sent (e2e/fixtures.ts), and an unexpected one fails the flow. Not part of make check, because it needs Django, Next and the proxy running.
e2e:
	cd web && E2E_BASE=$(E2E_BASE) npm run --silent e2e

# Known vulnerabilities in the web app's production dependencies (DECISIONS 10.5: npm audit every month).
# Needs the network (registry.npmjs.org); not part of make check. Exits non-zero when it finds any.
audit:
	cd web && npm audit --omit=dev

# OpenAPI schema -> web/lib/api/schema.ts (the only place the web app gets backend types from).
api-types:
	$(UV) python manage.py spectacular --file ../web/lib/api/openapi.yaml --validate
	cd web && npx openapi-typescript lib/api/openapi.yaml -o lib/api/schema.ts

backend-dev:
	$(UV) python manage.py runserver 127.0.0.1:8000

build:
	cd web && time npm run build

# Backups (DECISIONS 10.1): pg_dump -Fc of the dev database into backend/backups/<date>.dump (gitignored), the newest
# 14 kept (BACKUP_DIR, BACKUP_KEEP in backend/.env). restore-check restores the newest dump into a throwaway
# database, prints row counts against the live database and drops it; it never writes to the dev database.
# Nightly on the laptop: deploy/launchd/com.example.brain.backup.plist (deploy/README.md).
backup:
	$(UV) python manage.py backup

restore-check:
	$(UV) python manage.py restore_check

# Background jobs (unfurl, tagging, feeds, morning brief) every JOBS_INTERVAL seconds, like the production cron.
# Ctrl-C stops it. For a loop that survives logout, see deploy/README.md (launchd).
JOBS_LOOP = cd backend && while true; do uv run python manage.py run_jobs || true; sleep $(JOBS_INTERVAL); done

jobs:
	@$(JOBS_LOOP)

# The whole app on one origin, as in production: http://localhost:8080 (dev proxy) -> Django :8000 and a Next
# production server on DEV_WEB_PORT (3100), built with NEXT_PUBLIC_PROGRESS_STORE=api, plus `make jobs`.
# Never touches :3000 (the owner's `next dev`). DEV_BUILD=0 reuses the last build, only when that build was made
# by `make dev` (web/.next/progress-store-api holds its BUILD_ID), so the pages always use the API store.
# Ctrl-C stops everything.
# (No $(MAKE) in the recipe on purpose: `make -n dev` must only print, not start the servers.)
dev:
	@if [ "$(DEV_WEB_PORT)" = "3000" ]; then echo "DEV_WEB_PORT must not be 3000 (next dev runs there)"; exit 1; fi
	@for port in 8000 8080 $(DEV_WEB_PORT); do \
	  if lsof -nP -iTCP:$$port -sTCP:LISTEN >/dev/null 2>&1; then echo "port $$port is in use, stop it first"; exit 1; fi; \
	done
	@if [ "$(DEV_BUILD)" = "1" ]; then \
	  cd web && NEXT_PUBLIC_PROGRESS_STORE=api npm run build && cp .next/BUILD_ID .next/progress-store-api; \
	elif ! cmp -s web/.next/BUILD_ID web/.next/progress-store-api; then \
	  echo "the last web build was not made with NEXT_PUBLIC_PROGRESS_STORE=api: run make dev without DEV_BUILD=0"; exit 1; \
	fi
	$(UV) python manage.py migrate --no-input
	@trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT; \
	(cd backend && exec uv run python manage.py runserver 127.0.0.1:8000) & \
	(cd web && NEXT_PUBLIC_PROGRESS_STORE=api PORT=$(DEV_WEB_PORT) HOSTNAME=127.0.0.1 exec npm start) & \
	node web/scripts/dev-proxy.mjs --port 8080 --web http://127.0.0.1:$(DEV_WEB_PORT) & \
	($(JOBS_LOOP)) & \
	echo "make dev: open http://localhost:8080 (Ctrl-C stops Django, Next :$(DEV_WEB_PORT), proxy and jobs)"; \
	wait

# Hot reload with the API store on the owner's usual origin http://localhost:3000, which still holds the old
# localStorage progress (the "Hôm nay" page then offers to move it to the server once): Django :8000, `next dev`
# on DEV_HOT_PORT (3001) with NEXT_PUBLIC_PROGRESS_STORE=api, and the dev proxy on :3000 in front of both.
# Stop your own `next dev` on :3000 first: this refuses to start while :3000, :8000 or DEV_HOT_PORT is in use and
# never stops anything it did not start. Jobs are not included (`make jobs` in another terminal). Ctrl-C stops all.
dev-hot:
	@if [ "$(DEV_HOT_PORT)" = "3000" ]; then echo "DEV_HOT_PORT must not be 3000 (the proxy listens there)"; exit 1; fi
	@for port in 3000 8000 $(DEV_HOT_PORT); do \
	  if lsof -nP -iTCP:$$port -sTCP:LISTEN >/dev/null 2>&1; then echo "port $$port is in use, stop it first"; exit 1; fi; \
	done
	$(UV) python manage.py migrate --no-input
	@trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT; \
	(cd backend && exec uv run python manage.py runserver 127.0.0.1:8000) & \
	(cd web && NEXT_PUBLIC_PROGRESS_STORE=api exec npx next dev --port $(DEV_HOT_PORT) --hostname 127.0.0.1) & \
	node web/scripts/dev-proxy.mjs --port 3000 --web http://127.0.0.1:$(DEV_HOT_PORT) & \
	echo "make dev-hot: open http://localhost:3000 (Ctrl-C stops Django, next dev :$(DEV_HOT_PORT) and the proxy)"; \
	wait
