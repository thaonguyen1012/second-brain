// The whole lesson pipeline (mdx-options.ts: rehype-raw, rehype-safe-html, Shiki, rehype-code-classes) against raw
// HTML that once got through (security audit P-01/S-19, P-02/S-18): inside a `:::` Callout, inside raw <pre>/<code>,
// after an unclosed <code>, and in style attributes. Compiled and rendered as the lesson page does.
import { createCompiler } from '@fumadocs/mdx-remote';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mdxOptionsFor } from '@/lib/content/mdx-options';
import { tVi } from '@/lib/i18n/translate';
import { safeStyle } from './rehype-safe-html';
import { SHIKI_STYLE } from './rehype-code-classes';

const compiler = createCompiler(mdxOptionsFor(tVi));
const components = {
  Callout: (props: { children?: ReactNode }) => createElement('aside', { 'data-callout': '' }, props.children),
  Mermaid: () => null,
};

async function compile(source: string) {
  const result = await compiler.compile({ source, filePath: '/nonexistent/track/book/page.md' });
  const element = await (result.body as unknown as (props: object) => Promise<ReactElement>)({ components });
  return { html: renderToStaticMarkup(element), css: String(result.vfile.data.codeCss ?? '') };
}
const render = async (source: string) => (await compile(source)).html;

const DANGEROUS = ['<script', '<iframe', '<form', '<meta', '<base', '<style', 'attacker.example/p'];
const clean = (html: string) => DANGEROUS.filter((tag) => html.includes(tag));

describe('raw HTML is neutralised wherever it sits', () => {
  it('at the top level', async () => {
    expect(clean(await render('<script>alert(1)</script>\n\n<img src="https://attacker.example/p.png">\n'))).toEqual([]);
  });

  it('inside a ::: admonition (the Callout)', async () => {
    const html = await render(
      ':::note\n\n<script>alert(1)</script>\n\n<img src="https://attacker.example/p.png" alt="x">\n\n<iframe src="https://attacker.example/"></iframe>\n\n<form action="https://attacker.example/s"><input name="q"></form>\n\n<meta http-equiv="refresh" content="0">\n\n<base href="https://attacker.example/">\n\n<style>body{display:none}</style>\n\n:::\n',
    );
    expect(clean(html)).toEqual([]);
    expect(html).toContain('data-callout');
    expect(html).toContain('&lt;script&gt;'); // shown as text
  });

  it('inside a raw <pre> or inline <code>', async () => {
    expect(clean(await render('<pre><img src="https://attacker.example/p.png"><script>alert(2)</script></pre>\n'))).toEqual([]);
    expect(clean(await render('Text <code><img src="https://attacker.example/p.png"></code> more\n'))).toEqual([]);
  });

  it('after an unclosed <code> in a list item', async () => {
    const html = await render('- A. <code>\n- B. khác\n\nĐoạn sau.\n\n<details><img src="https://attacker.example/p.png" alt="x"></details>\n');
    expect(clean(html)).toEqual([]);
  });

  it('keeps a markdown code block as code, with its Shiki colours lifted into classes', async () => {
    const { html, css } = await compile('```html\n<script>alert(1)</script>\n```\n');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toMatch(/script<\/span>/); // highlighted tokens of the code, not an element
    expect(css).toMatch(/^\.sk-[0-9a-f]{7}\{--shiki-light:#/);
    expect(html).not.toMatch(/style="[^"]*--shiki/);
  });
});

describe('style attributes in content', () => {
  it('a --shiki style from content never reaches the page stylesheet', async () => {
    const { html, css } = await compile('Top <span style="--shiki-x: red; } body { background: url(https://attacker.example/c) } .x {">css</span>\n');
    expect(css).toBe('');
    expect(html).not.toContain('attacker.example');
  });

  it('an overlay or a url() is dropped, plain formatting is kept', async () => {
    const html = await render('<span style="position:fixed;inset:0;background:url(https://attacker.example/p.png)">o</span> <span style="color: red; width: 40%">k</span>\n');
    expect(html).not.toContain('position');
    expect(html).not.toContain('attacker.example');
    expect(html).toContain('style="color:red;width:40%"');
  });

  it('safeStyle keeps the allowed declarations only', () => {
    expect(safeStyle('color: red; position: fixed')).toBe('color: red');
    expect(safeStyle('width: 50%; border-radius: 8px')).toBe('width: 50%; border-radius: 8px');
    expect(safeStyle('--shiki-light: #fff')).toBeNull();
    expect(safeStyle('background-color: url(x)')).toBeNull();
    expect(safeStyle('color: var(--x)')).toBeNull();
    expect(safeStyle('font-size: 12px /* x */')).toBeNull();
  });

  it("SHIKI_STYLE matches Shiki's declarations only", () => {
    expect(SHIKI_STYLE.test('--shiki-light:#24292E;--shiki-dark:#E1E4E8')).toBe(true);
    expect(SHIKI_STYLE.test('--shiki-light:#fff;--shiki-dark:#24292e;--shiki-light-bg:#fff;--shiki-dark-bg:#24292e')).toBe(true);
    expect(SHIKI_STYLE.test('--shiki-light-font-style:italic;--shiki-dark-font-style:italic')).toBe(true);
    expect(SHIKI_STYLE.test('--shiki-x: red; } body { color: red } .x {')).toBe(false);
    expect(SHIKI_STYLE.test('--shiki-light:#fff;background:url(x)')).toBe(false);
    expect(SHIKI_STYLE.test(' --shiki-light: #fff ; --shiki-dark: #000; ')).toBe(true);
  });

  it('SHIKI_STYLE answers fast on a long run of spaces (no backtracking blow-up)', () => {
    const started = performance.now();
    expect(SHIKI_STYLE.test(`--shiki-light:#fff${' '.repeat(50_000)}!`)).toBe(false);
    expect(SHIKI_STYLE.test(`${'--shiki-light:#fff '.repeat(5_000)}!`)).toBe(false);
    expect(performance.now() - started).toBeLessThan(200);
  });
});
