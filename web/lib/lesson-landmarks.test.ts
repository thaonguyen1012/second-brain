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

  it('below xl: the popover box drawn as a <nav>, so the <header> inside it is no second banner', () => {
    // the popover is Base UI's Collapsible root (it takes `render`), with tableOfContentPopover.container spread on it,
    // around the <header> that would otherwise be a banner
    expect(read('node_modules/fumadocs-ui/dist/components/ui/collapsible.js')).toMatch(
      /from "@base-ui\/react\/collapsible";[\s\S]*const Collapsible = Collapsible\$1\.Root;/,
    );
    expect(toc()).toMatch(/jsx\(Collapsible, \{\s*open,\s*onOpenChange: setOpen,\s*"data-toc-popover": "",\s*\.\.\.container,/);
    expect(toc()).toMatch(/"data-toc-popover": ""[\s\S]*?jsxs\("header", \{/);
    expect(page()).toMatch(/const tocPopover = \{ render: <nav \/>, 'aria-label': t\('Trên trang này'\) \}/);
    expect(page()).toMatch(/tableOfContentPopover=\{\{ container: tocPopover \}\}/);
  });
});
