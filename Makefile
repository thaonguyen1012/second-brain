# One command for the whole repo: make check (DECISIONS.md 10.3).
SMOKE_BASE ?= http://localhost:3000
SMOKE_SAMPLE ?= 20
UV := cd backend && uv run

BUDGET_KB ?= 220
JOBS_INTERVAL ?= 300
DEV_WEB_PORT ?= 3100
DEV_BUILD ?= 1

.PHONY: check web-check backend-check smoke budget api-types backend-dev build jobs dev

check: web-check backend-check smoke budget

web-check:
	cd web && npm run --silent types:check
	cd web && npm run --silent lint

backend-check:
	$(UV) ruff check .
	$(UV) ruff format --check .
	$(UV) mypy .
	$(UV) python manage.py makemigrations --check --dry-run
	$(UV) pytest

# Needs a running web server (owner's dev server or `npm start`) at SMOKE_BASE.
smoke:
	node web/scripts/smoke-test.mjs --base $(SMOKE_BASE) --sample $(SMOKE_SAMPLE)

# Home First Load JS (gzip) of the last `npm run build`; skipped when there is no build (DECISIONS 10.2, 10.3).
budget:
	node web/scripts/check-budget.mjs --max-kb $(BUDGET_KB)

# OpenAPI schema -> web/lib/api/schema.ts (the only place the web app gets backend types from).
api-types:
	$(UV) python manage.py spectacular --file ../web/lib/api/openapi.yaml --validate
	cd web && npx openapi-typescript lib/api/openapi.yaml -o lib/api/schema.ts

backend-dev:
	$(UV) python manage.py runserver 127.0.0.1:8000

build:
	cd web && time npm run build

# Background jobs (unfurl, tagging, feeds, morning brief) every JOBS_INTERVAL seconds, like the production cron.
# Ctrl-C stops it. For a loop that survives logout, see deploy/README.md (launchd).
JOBS_LOOP = cd backend && while true; do uv run python manage.py run_jobs || true; sleep $(JOBS_INTERVAL); done

jobs:
	@$(JOBS_LOOP)

# The whole app on one origin, as in production: http://localhost:8080 (dev proxy) -> Django :8000 and a Next
# production server on DEV_WEB_PORT (3100), built with NEXT_PUBLIC_PROGRESS_STORE=api, plus `make jobs`.
# Never touches :3000 (the owner's `next dev`). DEV_BUILD=0 reuses the last build. Ctrl-C stops everything.
# (No $(MAKE) in the recipe on purpose: `make -n dev` must only print, not start the servers.)
dev:
	@if [ "$(DEV_WEB_PORT)" = "3000" ]; then echo "DEV_WEB_PORT must not be 3000 (next dev runs there)"; exit 1; fi
	@for port in 8000 8080 $(DEV_WEB_PORT); do \
	  if lsof -nP -iTCP:$$port -sTCP:LISTEN >/dev/null 2>&1; then echo "port $$port is in use, stop it first"; exit 1; fi; \
	done
	@if [ "$(DEV_BUILD)" = "1" ]; then cd web && NEXT_PUBLIC_PROGRESS_STORE=api npm run build; fi
	$(UV) python manage.py migrate --no-input
	@trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT; \
	(cd backend && exec uv run python manage.py runserver 127.0.0.1:8000) & \
	(cd web && PORT=$(DEV_WEB_PORT) HOSTNAME=127.0.0.1 exec npm start) & \
	node web/scripts/dev-proxy.mjs --port 8080 --web http://127.0.0.1:$(DEV_WEB_PORT) & \
	($(JOBS_LOOP)) & \
	echo "make dev: open http://localhost:8080 (Ctrl-C stops Django, Next :$(DEV_WEB_PORT), proxy and jobs)"; \
	wait
