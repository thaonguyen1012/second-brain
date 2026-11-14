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

/**
 * components/lazy-docs-layout.tsx closes the lesson's two overlays when the focus leaves them, through Fumadocs' own
 * controls, found by the markup below: a Fumadocs update that changes it would leave them open behind the focus again.
 */
describe("the lesson's overlays, closed as the focus leaves them", () => {
  const base = () => read('node_modules/fumadocs-ui/dist/components/sidebar/base.js');
  it('the table-of-contents popover: open while its Collapsible root has data-open, toggled by its trigger', () => {
    expect(read('node_modules/@base-ui/react/collapsible/root/CollapsibleRootDataAttributes.d.ts')).toMatch(
      /export declare const open = "data-open";/,
    );
    expect(toc()).toMatch(/jsxs\(CollapsibleTrigger, \{[\s\S]*?"data-toc-popover-trigger": "",/);
  });

  it('the sidebar drawer: data-state on it, its backdrop just before it closes it, its button controls it', () => {
    expect(base()).toMatch(/id: "nd-sidebar-mobile",\s*"data-state": open \? "open" : "closed",/);
    expect(base()).toMatch(/function SidebarDrawerOverlay[\s\S]*?onClick: \(\) => setOpen\(false\),/);
    expect(read('node_modules/fumadocs-ui/dist/layouts/docs/slots/sidebar.js')).toMatch(
      /jsx\(SidebarDrawerOverlay, \{[^}]*\}\), \/\* @__PURE__ \*\/ jsx\(SidebarDrawerContent, \{/,
    );
    expect(base()).toMatch(/"aria-expanded": open,\s*"aria-controls": "nd-sidebar-mobile",/);
  });
});
