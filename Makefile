# One command for the whole repo: make check (DECISIONS.md 10.3).
SMOKE_BASE ?= http://localhost:3000
SMOKE_SAMPLE ?= 20
UV := cd backend && uv run

BUDGET_KB ?= 220

.PHONY: check web-check backend-check smoke budget api-types backend-dev build

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
