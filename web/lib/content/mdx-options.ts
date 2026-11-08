import type { CompilerOptions } from '@fumadocs/mdx-remote';
import { rehypeCodeDefaultOptions, remarkAdmonition, remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeSafeHtml } from '../mdx/rehype-safe-html';
import { rehypeCodeClasses } from '../mdx/rehype-code-classes';
import { tVi, type T } from '../i18n/translate';

/** The compile options for one UI language: only the image and embed placeholders' words depend on it. */
export const mdxOptionsFor = (t: T): CompilerOptions => ({
  format: 'md',
  // images are replaced by placeholders, never measured or fetched
  remarkImageOptions: false,
  // unknown fence languages in the sources (e.g. ```excel) render as plain text instead of failing
  rehypeCodeOptions: { ...rehypeCodeDefaultOptions, fallbackLanguage: 'text' },
  remarkPlugins: (v) => [
    [remarkMath, { singleDollarTextMath: false }],
    [
      remarkAdmonition,
      { typeMap: { info: 'info', note: 'info', tip: 'info', success: 'success', warning: 'warn', danger: 'error' } },
    ],
    remarkMdxMermaid,
    ...v,
  ],
  rehypePlugins: (v) => [
    [
      rehypeRaw,
      { passThrough: ['mdxjsEsm', 'mdxFlowExpression', 'mdxJsxFlowElement', 'mdxJsxTextElement', 'mdxTextExpression'] },
    ],
    [rehypeSafeHtml, { t }],
    rehypeKatex,
    ...v,
    rehypeCodeClasses,
  ],
});

export const mdxOptions: CompilerOptions = mdxOptionsFor(tVi);
