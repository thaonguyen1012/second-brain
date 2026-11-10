# Contributing

Thanks for looking. This is a personal tool made public; issues and small pull requests are welcome, larger changes
are best discussed in an issue first. The working rules live in `CLAUDE.md` (written for coding agents, and just as
useful for people); this file is the short version.

## Set up

Follow "Quick start: with the backend" in `README.md`. `npm ci` in `web/` also installs the lefthook pre-commit
hook, which runs `make check` before every commit.

## The one check

```bash
make check
```

Web: `tsc` + ESLint + Vitest (`web/lib/**/*.test.ts`, `web/scripts/**/*.test.mjs`). Backend: ruff (lint and format),
mypy (strict), `makemigrations --check`, pytest (needs Postgres). Then the smoke test against a running server
(`SMOKE_BASE=auto`: :3000, else :8080; skipped with a warning when none answers) and the home page's First Load JS
budget (220 kB gzip, measured on the last `npm run build`). It must pass before a commit; never skip a failing check.
`make e2e` runs the Playwright flows against `make dev` (not part of `make check`).

## Conventions

* English for code, comments, commit messages, file names and slugs (ASCII). UI text is written in Vietnamese in the
  code and goes through `t()` / `msg()`; its English goes into `web/lib/i18n/en/<area>.ts`
  (`web/lib/i18n/coverage.test.ts` fails otherwise; `web/lib/i18n/README.md`).
* One commit per step, with a message that says what changed and why.
* Handbook content is never rewritten: the importer changes structure and syntax only.
* No runtime requests to other domains (no CDN, web fonts or analytics).
* Django owns data and auth; `web/lib/api/` is the only backend caller, typed from the OpenAPI schema
  (`make api-types` after an API change). Logic goes in `services/`, views stay thin.
* UI follows `web/DESIGN.md`; Space UI components are added with `npx shadcn@latest add @spaceui/<name>`.
* Decisions that change the product or the engineering standards go into `DECISIONS.md`.

## How the work was done

Most of this code was written by coding agents from written briefs: read `STATUS.md` and the recent `git log` first,
put a line under "In progress", work on a branch, keep each commit small with `make check` green, have a second
reviewer (a person or another agent) check each larger piece, and move the line to "Done" with the commit subjects.
