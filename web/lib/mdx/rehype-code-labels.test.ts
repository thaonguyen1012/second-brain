import { createCompiler } from '@fumadocs/mdx-remote';
import type { Element, ElementContent, Root } from 'hast';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { mdxOptionsFor } from '../content/mdx-options';
import { enPage } from '../i18n/en';
import { makeT, tVi } from '../i18n/translate';
import { rehypeCodeLabels } from './rehype-code-labels';

// Hand-built hast trees, as Shiki hands them over: a highlighted block is a <pre> holding its <code>.
const h = (tagName: string, children: ElementContent[] = []): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});
const block = () => h('pre', [h('code', [{ type: 'text', value: 'x = 1' }])]);
const labels = (tree: Root) => {
  const out: unknown[] = [];
  const visit = (node: { type: string; tagName?: string; properties?: Record<string, unknown>; children?: unknown[] }) => {
    if (node.tagName === 'pre') out.push(node.properties?.dataCodeLabel);
    (node.children as (typeof node)[] | undefined)?.forEach(visit);
  };
  visit(tree as never);
  return out;
};

describe('rehypeCodeLabels', () => {
  it('numbers the code blocks in reading order, inside MDX nodes too', () => {
    // a `:::` Callout is an MDX node around its blocks
    const callout = { type: 'mdxJsxFlowElement', name: 'Callout', attributes: [], children: [block()] };
    const tree = { type: 'root', children: [block(), h('div', [h('details', [block()])]), callout] } as unknown as Root;
    rehypeCodeLabels()(tree);
    expect(labels(tree)).toEqual(['Khối mã 1', 'Khối mã 2', 'Khối mã 3']);
  });

  it('names them in the page language and leaves inline code alone', () => {
    const inline = h('p', [h('code', [{ type: 'text', value: 'x' }])]);
    const tree: Root = { type: 'root', children: [inline, block()] };
    rehypeCodeLabels({ t: makeT('en', enPage) })(tree);
    expect(labels(tree)).toEqual(['Code block 1']);
    expect((inline.children[0] as Element).properties).toEqual({});
  });

  it('runs after Shiki in the lesson pipeline, so the highlighted blocks keep their names', async () => {
    const compiler = createCompiler(mdxOptionsFor(tVi));
    const source = '```js\nconst a = 1;\n```\n\nText with `code`.\n\n```python\nprint(1)\n```\n';
    const result = await compiler.compile({ source, filePath: '/nonexistent/track/book/page.md' });
    const element = await (result.body as unknown as (props: object) => Promise<ReactElement>)({ components: {} });
    const html = renderToStaticMarkup(element);
    expect([...html.matchAll(/<pre[^>]*data-code-label="([^"]+)"/g)].map((m) => m[1])).toEqual(['Khối mã 1', 'Khối mã 2']);
  });
});
