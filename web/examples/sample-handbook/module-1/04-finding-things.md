# 1.4 Finding things

Press **⌘K** (or Ctrl+K) anywhere to open search. It has two parts:

1. the handbooks, searched in full text: every heading section of every lesson is a row in an SQLite FTS5 index, so a phrase deep inside a transcript is found too;
2. the second brain: items, notes, inbox entries, opportunities and skills, by title.

The handbook index is a local file, `web/data/search.sqlite`, rebuilt by the importer for each handbook it imports and by `npm run search:rebuild` for all of them. If search finds nothing from a handbook you just added, rebuild the index.

A result opens the page at the matching section. Here is a picture placeholder, so you can see how the app treats an image whose file is not available offline:

![The search dialog with a few results](https://example.com/pictures/search-dialog.png)

The original image is not downloaded; the app shows its description and a note instead. Images you keep under `web/public/img/` render normally.
