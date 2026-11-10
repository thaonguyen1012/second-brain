---
title: "2.4 Importing your own handbooks"
---
Handbooks come in through one command, run in the folder of the source code. It reads your material, merges the items into lesson pages, writes them under `web/content/docs/`, registers the handbook and rebuilds its search index.

```bash
node web/scripts/import-gitbook.mjs path/to/export.zip \
  --track ky-nang --slug my-course --title "My course notes" \
  --description "What the course covered, in my words."
```

The first argument is one of three inputs:

| Input | What it is |
| --- | --- |
| `export.zip` | a GitBook markdown export: `SUMMARY.md` plus one markdown file per page |
| `handbook.html` | a single HTML file with an embedded `book-data` block (some note generators produce these) |
| `a folder` | markdown files on disk; with a `SUMMARY.md` it is read like the zip, without one the folders become modules |

`--track` is the group on the Handbooks page (`kinh-doanh`, `it` or `ky-nang`), `--slug` the folder name and URL (lowercase ASCII), `--title` what the cards show. The importer picks a cover drawing from the slug; `--cover <name>` chooses one of `web/public/covers/`. Re-import with `--replace` after changing the source.

After an import, add the handbook's English title and description to `web/lib/i18n/en/shell.ts` (a test asks for them), then restart or rebuild the web app, since the registry is code. The README of the repository has the longer version of these steps.
