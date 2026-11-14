import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Two registry components are drawn on other elements with copies of their classes (components/ui is the registry's
 * and is never edited by hand): SidebarInset's box as a div in components/app-shell.tsx (the registry renders a
 * <main>, which would hold the top bar), and TabsList / TabsTab on Thư viện's nav of links in
 * components/brain/library/library-tabs.tsx (links to two routes are not tabs). A `shadcn add` update of
 * components/ui/sidebar or components/ui/tabs changes the originals only: these fail until the copies follow.
 */
const web = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(web, file), 'utf8');
const tokens = (classes: string) => classes.split(/\s+/).filter(Boolean);

/** The first capture of `re` in `file`, or a failure that names what was looked for. */
function find(file: string, re: RegExp, what: string): string {
  const m = read(file).match(re);
  if (!m) throw new Error(`${what} not found in ${file}`);
  return m[1];
}

/** Base UI state attributes (data-active, data-disabled, data-orientation): a link has none of them. */
const isState = (c: string) => c.startsWith('data-');

describe('registry classes copied by the app', () => {
  it('app-shell.tsx draws SidebarInset as a div with its classes', () => {
    const registry = find(
      'components/ui/sidebar.tsx',
      /export function SidebarInset[\s\S]*?className=\{cn\(\s*'([^']*)'/,
      "SidebarInset's classes",
    );
    const copy = find('components/app-shell.tsx', /data-slot="sidebar-inset" className="([^"]*)"/, 'the inset div');
    expect(tokens(copy)).toEqual(tokens(registry));
    // The registry's other classes are for variant="inset", which this sidebar does not use
    expect(read('components/app-shell.tsx')).not.toMatch(/variant="inset"/);
  });

  it('library-tabs.tsx draws the nav as TabsList and its links as TabsTab', () => {
    const tabsFile = 'components/ui/tabs.tsx';
    const navFile = 'components/brain/library/library-tabs.tsx';
    const listBase = find(tabsFile, /<TabsPrimitive\.List\s+className=\{cn\(\s*'([^']*)'/, "TabsList's classes");
    const listDefault = find(tabsFile, /variant === 'default'\s*\?\s*'([^']*)'/, "TabsList's default variant");
    const tabBase = find(tabsFile, /<TabsPrimitive\.Tab\s+className=\{cn\(\s*'([^']*)'/, "TabsTab's classes");
    const indicator = find(
      tabsFile,
      /variant === 'underline'\s*\?\s*'[^']*'\s*:\s*'([^']*)'/,
      "the default indicator's classes",
    );
    const nav = find(navFile, /<nav[\s\S]*?className="([^"]*)"/, "the nav's classes");
    const link = find(navFile, /<Link[\s\S]*?className=\{cn\(\s*'([^']*)'/, "the links' classes");
    const current = find(navFile, /current === key && '([^']*)'/, "the current link's classes");

    // The list without `relative z-0`, which place the sliding indicator a nav does not have
    const list = new Set([...tokens(listBase), ...tokens(listDefault)].filter((c) => !isState(c)));
    list.delete('relative');
    list.delete('z-0');
    expect(new Set(tokens(nav))).toEqual(list);

    expect(tokens(link)).toEqual(tokens(tabBase).filter((c) => !isState(c)));

    // The current half in the indicator's colours and the active tab's text, without the indicator's own place
    // (-z-1 under the tab, the tab's radius)
    const active = tokens(tabBase)
      .filter((c) => c.startsWith('data-active:'))
      .map((c) => c.slice('data-active:'.length));
    const colours = tokens(indicator).filter((c) => c !== '-z-1' && c !== 'rounded-md');
    expect(new Set(tokens(current))).toEqual(new Set([...colours, ...active]));
  });
});

/**
 * components/mdx.tsx copies Fumadocs' table (fumadocs-ui/mdx: the wrapper that scrolls a wide table and is its tab
 * stop) to add the app's focus ring, and its pre (the code block) to name the code's scrolling viewport. A Fumadocs
 * update changes the original only: this fails until the copy follows.
 */
describe('Fumadocs markup copied by the app', () => {
  it("mdx.tsx draws Fumadocs' table wrapper with its classes and tab stop, plus the focus ring", () => {
    const fumadocsFile = 'node_modules/fumadocs-ui/dist/mdx.js';
    const original = find(fumadocsFile, /function Table\(props\) \{[\s\S]*?className: "([^"]*)"/, "Fumadocs' Table");
    expect(read(fumadocsFile)).toMatch(/function Table\(props\) \{[\s\S]*?tabIndex: 0,[\s\S]*?jsx\("table"/);
    const copy = find('components/mdx.tsx', /function Table\([\s\S]*?className="([^"]*)"/, 'the table wrapper');
    expect(tokens(copy).filter((c) => !c.startsWith('focus-visible:'))).toEqual(tokens(original));
    expect(read('components/mdx.tsx')).toMatch(
      /function Table\([\s\S]*?tabIndex=\{0\}[\s\S]*?<table \{\.\.\.props\} \/>/,
    );
  });

  it("mdx.tsx draws Fumadocs' code block as its pre does, and names the viewport through viewportProps", () => {
    // fumadocs-ui/mdx's pre: CodeBlock around Pre, with the same props
    expect(read('node_modules/fumadocs-ui/dist/mdx.js')).toMatch(
      /pre: \(props\) => \/\* @__PURE__ \*\/ jsx\(CodeBlock, \{\s*\.\.\.props,\s*children: \/\* @__PURE__ \*\/ jsx\(Pre, \{ children: props\.children \}\)\s*\}\)/,
    );
    // the viewport takes viewportProps (the name) and is the role="region" tab stop
    expect(read('node_modules/fumadocs-ui/dist/components/codeblock.js')).toMatch(
      /\.\.\.viewportProps,\s*role: "region",\s*tabIndex: 0,/,
    );
    expect(read('components/mdx.tsx')).toMatch(
      /function CodeBlockPre\([\s\S]*?<CodeBlock \{\.\.\.props\} viewportProps=[\s\S]*?<Pre>\{props\.children\}<\/Pre>/,
    );
  });
});
