import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';
import { Mermaid } from './mermaid';

/**
 * Fumadocs' table (fumadocs-ui/mdx): a wrapper that scrolls a wide table and is a tab stop for it. Its focus is the
 * app's 2px ring inside the wrapper's edge, over the table's own rounded border (the cells keep clear of it), as on
 * the app's other scrollers (DESIGN.md §4), instead of the browser's thin outline (lessons, /tu-vi/).
 */
function Table(props: ComponentProps<'table'>) {
  return (
    <div
      className="relative overflow-auto prose-no-margin my-6 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      tabIndex={0}
    >
      <table {...props} />
    </div>
  );
}

/**
 * Fumadocs' code block (fumadocs-ui/mdx's `pre`) with its scrolling viewport named. That viewport is a tab stop with
 * role="region"; unnamed, the regions of a lesson with several blocks could not be told apart in a landmark list (axe
 * landmark-unique). lib/mdx/rehype-code-labels.ts numbers the page's blocks in its `data-code-label` ("Khối mã 3"); a
 * <pre> without one keeps Fumadocs' unnamed viewport.
 */
function CodeBlockPre({ 'data-code-label': label, ...props }: ComponentProps<'pre'> & { 'data-code-label'?: string }) {
  return (
    <CodeBlock {...props} viewportProps={label ? { 'aria-label': label } : undefined}>
      <Pre>{props.children}</Pre>
    </CodeBlock>
  );
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    pre: CodeBlockPre,
    table: Table,
    Mermaid,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
