import { loader } from 'fumadocs-core/source';
import { docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { remarkAdmonition, remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { rehypeSafeHtml } from './mdx/rehype-safe-html';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    async: true,
    mdxOptions: applyMdxPreset({
      // images are replaced at build time, never measured or fetched
      remarkImageOptions: false,
      // search is done by Pagefind over the built HTML
      remarkStructureOptions: false,
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
        rehypeSafeHtml,
        rehypeKatex,
        ...v,
      ],
    }),
  },
  meta: {
    schema: metaSchema,
  },
});

export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [],
});
