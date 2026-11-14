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

  it('only the page behind them closes them: the layout root, never a popup portalled outside it', () => {
    // the layout root holds the top bar, the sidebar (the drawer below md) and the page with its popover
    expect(read('node_modules/fumadocs-ui/dist/layouts/docs/slots/container.js')).toMatch(/id: "nd-docs-layout",/);
    const body = read('node_modules/fumadocs-ui/dist/layouts/docs/client.js');
    expect(body).toMatch(/jsxs\(slots\.container, \{[\s\S]*?jsx\(slots\.header, \{\}\),[\s\S]*?children,/);
    expect(body).toMatch(/jsxs\(slots\.container, \{[\s\S]*?jsx\(slots\.sidebar\.root, \{[\s\S]*?children,/);
    // the drawer's language chooser and handbook switcher open Fumadocs' PopoverContent, a Base UI portal on <body>;
    // Cmd+K is a portalled dialog too
    expect(read('node_modules/fumadocs-ui/dist/components/ui/popover.js')).toMatch(/jsx\(Popover\$1\.Portal, \{/);
    const popover = /import \{[^}]*PopoverContent[^}]*\} from "[./]+(components\/)?ui\/popover\.js";/;
    for (const file of ['layouts/shared/slots/language-select.js', 'components/sidebar/tabs/dropdown.js'])
      expect(read(`node_modules/fumadocs-ui/dist/${file}`)).toMatch(popover);
    expect(read('node_modules/@base-ui/react/floating-ui-react/components/FloatingPortal.mjs')).toMatch(
      /\?\? parentPortalNode \?\? document\.body;/,
    );
    expect(read('node_modules/fumadocs-ui/dist/components/dialog/search.js')).toMatch(/jsx\(Dialog\.Portal, \{/);
    expect(read('components/lazy-docs-layout.tsx')).toMatch(/!to\.closest\('#nd-docs-layout'\)\) return;/);
  });

  it('a Cmd+K pick of a heading of the lesson shown hands it the focus, which closes them', () => {
    // Fumadocs reports the row picked as it closes the dialog, and hands its popup's props to Base UI, whose
    // finalFocus is where the focus goes on closing: the element's first tabbable part, a heading's own link
    const dialog = read('node_modules/fumadocs-ui/dist/components/dialog/search.js');
    expect(dialog).toMatch(/onOpenChange\(false\);\s*onSelectProp\?\.\(item\);/);
    expect(dialog).toMatch(/jsxs\(Dialog\.Popup, \{\s*id: "fd-search-dialog-content",[\s\S]*?\.\.\.props,\s*children:/);
    expect(read('node_modules/@base-ui/react/dialog/popup/DialogPopup.mjs')).toMatch(/returnFocus: finalFocus,/);
    const manager = read('node_modules/@base-ui/react/floating-ui-react/components/FloatingFocusManager.mjs');
    expect(manager).toMatch(/const tabbableReturnElement = getFirstTabbableElement\(returnElement\);/);
    // a finalFocus given at all is explicit: Base UI then moves the focus on closing even when it has moved on (an Item
    // Sheet a result opened), so the dialog gives one only for a pick on the page shown
    expect(manager).toMatch(/explicitReturnFocusRef\.current \?\? typeof returnFocusValueOrFn !== 'boolean';/);
    expect(read('node_modules/fumadocs-ui/dist/components/heading.js')).toMatch(
      /jsx\("a", \{\s*"data-card": "",\s*href: `#\$\{props\.id\}`,/,
    );
    const search = read('components/search-dialog.tsx');
    expect(search).toMatch(/onSelect=\{onPick\}/);
    expect(search).toMatch(/const finalFocus = returnTo\s*\?/);
    expect(search).toMatch(/finalFocus=\{finalFocus\}/);
  });
});
