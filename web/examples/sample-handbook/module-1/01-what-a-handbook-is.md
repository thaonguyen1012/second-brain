# 1.1 What a handbook is

A **handbook** is one book of notes about one course or one subject. In the app it is a folder under `web/content/docs/<track>/<slug>/`, with a page per lesson and a `meta.json` that gives the sidebar its order. The registry in `web/lib/books.ts` knows its title, its description, its track and how many lesson pages it has; that count is the denominator of its progress bar.

A handbook belongs to one of three **tracks**, which are only groups on the Handbooks page: `kinh-doanh` (business), `it` and `ky-nang` (skills). This sample lives in `ky-nang`.

The text of a handbook is yours. The importer changes structure and syntax (it merges small pages, shifts headings, rewrites links), never the words. If a sentence reads oddly, it read oddly in the source.
