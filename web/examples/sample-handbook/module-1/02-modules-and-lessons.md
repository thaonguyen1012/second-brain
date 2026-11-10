# 1.2 Modules and lessons

A **module** is a chapter: a folder with its own introduction page (`README.md` in the source) and a list of lessons. A **lesson** is the smallest unit the app tracks: one page with its own "done" mark.

Course exports tend to produce one tiny page per video, reading and quiz. Reading those one by one is tiring and marking each one done is noise, so the importer merges them:

| Source shape | What the importer does | Merge mode |
| --- | --- | --- |
| modules whose introduction names lesson groups | one page per lesson group | `m2` |
| course > module > item, no groups | one page per module, split into parts above 12 lessons | `module` |
| a flat list of pages | near-empty pages fold into the page before them | `m1` |

Inside a merged page every item keeps its own heading with a stable anchor, so links from other pages still land on the right section. The link in the next sentence points at an item that was merged into a page of Module 2: [the review questions](../module-2/week/02-the-review.md).

This sample uses the `module` mode. Module 1 is one page (the four lessons you are reading), and in Module 2 the group called "The weekly rhythm" became one page too, while its other lessons stayed separate.
