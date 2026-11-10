# Using Alex's Brain

This is a sample handbook. It ships with the app so that a fresh install has something to read, and it is written about the app itself: what a handbook is, how lessons and progress work, and what the pages around the handbooks are for. Once you have imported your own handbooks you can keep it or delete it (`web/content/docs/ky-nang/sample-handbook/` and its line in `web/lib/books.ts`).

It was also made to exercise the importer. Its source is a small GitBook-style folder, `web/examples/sample-handbook/`: a `SUMMARY.md` that lists the pages, one markdown file per page, two modules, one lesson group, a code block, a table, an image and a few links between pages. If you want to see what the importer does to a structure like this, compare that folder with the pages you are reading now.

{% hint style="info" %}
Everything in this handbook is plain markdown. The app renders it, keeps a "done" mark per page, and never changes the text.
{% endhint %}

## How to read it

Start with [Module 1](module-1/README.md) if you only want to study: it explains handbooks, lessons and the done mark. [Module 2](module-2/README.md) is about the rest of the app: items and notes, the week, and how to bring your own material in.
