---
title: "Module 1. Handbooks, modules and lessons"
---
A handbook is a course worth of notes, kept as markdown on disk and read in the browser. This module explains the three words the app uses for its parts, what the "done" mark means, and how to find a page again.

## What you will learn

* what a handbook, a module and a lesson are, and how they map to folders and files;
* how progress is counted and where it is stored;
* how search works, and what it indexes.

## Before you start

Nothing is needed beyond this page. The module is short on purpose: four lessons, merged into one page by the importer, which is how most imported handbooks read as well.

## 1.1 What a handbook is [#01-what-a-handbook-is]

A **handbook** is one book of notes about one course or one subject. In the app it is a folder under `web/content/docs/<track>/<slug>/`, with a page per lesson and a `meta.json` that gives the sidebar its order. The registry in `web/lib/books.ts` knows its title, its description, its track and how many lesson pages it has; that count is the denominator of its progress bar.

A handbook belongs to one of three **tracks**, which are only groups on the Handbooks page: `kinh-doanh` (business), `it` and `ky-nang` (skills). This sample lives in `ky-nang`.

The text of a handbook is yours. The importer changes structure and syntax (it merges small pages, shifts headings, rewrites links), never the words. If a sentence reads oddly, it read oddly in the source.

## 1.2 Modules and lessons [#02-modules-and-lessons]

A **module** is a chapter: a folder with its own introduction page (`README.md` in the source) and a list of lessons. A **lesson** is the smallest unit the app tracks: one page with its own "done" mark.

Course exports tend to produce one tiny page per video, reading and quiz. Reading those one by one is tiring and marking each one done is noise, so the importer merges them:

| Source shape | What the importer does | Merge mode |
| --- | --- | --- |
| modules whose introduction names lesson groups | one page per lesson group | `m2` |
| course > module > item, no groups | one page per module, split into parts above 12 lessons | `module` |
| a flat list of pages | near-empty pages fold into the page before them | `m1` |

Inside a merged page every item keeps its own heading with a stable anchor, so links from other pages still land on the right section. The link in the next sentence points at an item that was merged into a page of Module 2: [the review questions](/docs/ky-nang/sample-handbook/module-2/week/#02-the-review).

This sample uses the `module` mode. Module 1 is one page (the four lessons you are reading), and in Module 2 the group called "The weekly rhythm" became one page too, while its other lessons stayed separate.

## 1.3 Marking a lesson done [#03-marking-a-lesson-done]

At the bottom of every lesson page there is one checkbox, **Done**. Tick it when you have worked through the page. That is the whole progress model: no streaks, no points, no timers.

What the mark feeds:

* the progress bar of the handbook on the Handbooks page and on its cards;
* the **Today** page, whose first block takes you back to the last page you visited, with the handbook's progress beside it;
* the week review, which counts the days on which you marked a lesson done.

Where the mark is stored depends on how the app was built. With the web app alone it lives in the browser (`localStorage`), so it is per device. With the Django backend it is saved through the progress API and follows you to any browser you sign in from. The Today page offers once to move old browser marks to the server.

:::warning

A visit alone is not progress. Opening a page records it as "last visited", so Today can bring you back, but the handbook only moves forward when you tick the box.

:::

## 1.4 Finding things [#04-finding-things]

Press **⌘K** (or Ctrl+K) anywhere to open search. It has two parts:

1. the handbooks, searched in full text: every heading section of every lesson is a row in an SQLite FTS5 index, so a phrase deep inside a transcript is found too;
2. the second brain: items, notes, inbox entries, opportunities and skills, by title.

The handbook index is a local file, `web/data/search.sqlite`, rebuilt by the importer for each handbook it imports and by `npm run search:rebuild` for all of them. If search finds nothing from a handbook you just added, rebuild the index.

A result opens the page at the matching section. Here is a picture placeholder, so you can see how the app treats an image whose file is not available offline:

![The search dialog with a few results](https://example.com/pictures/search-dialog.png)

The original image is not downloaded; the app shows its description and a note instead. Images you keep under `web/public/img/` render normally.
