import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The lesson page names Fumadocs' table of contents as a landmark through DocsPage's props
 * (app/[lang]/docs/[[...slug]]/page.tsx), which Fumadocs spreads onto its own markup. A Fumadocs update that stops
 * spreading them, or renames what they point at, would leave the contents outside every landmark again without a
 * type error: this fails instead.
 */
const web = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(web, file), 'utf8');
const toc = () => read('node_modules/fumadocs-ui/dist/layouts/docs/page/slots/toc.js');
const page = () => read('app/[lang]/docs/[[...slug]]/page.tsx');

describe("the lesson's table of contents as a landmark", () => {
  it('beside the lesson: a navigation named by its heading', () => {
    // Fumadocs spreads tableOfContent.container onto the TOC's box, and its heading keeps the id the name points at
    expect(toc()).toMatch(/id: "nd-toc",\s*\.\.\.container,/);
    expect(toc()).toMatch(/jsxs\("h3", \{\s*id: "toc-title",/);
    expect(page()).toMatch(/tableOfContent=\{\{ container: \{ role: 'navigation', 'aria-labelledby': 'toc-title' \} \}\}/);
  });
});
