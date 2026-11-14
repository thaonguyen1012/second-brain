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

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    table: Table,
    Mermaid,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
