// Runs after Shiki. Fumadocs' code block makes its scrolling viewport a tab stop with role="region" and no name, so a
// lesson with several code blocks had as many unnamed regions, which a landmark list cannot tell apart (axe
// landmark-unique). Each code block of the page gets its number in reading order as `data-code-label` on its <pre>
// ("Khối mã 3", in the page's UI language like the placeholders' words); components/mdx.tsx names the viewport with it.
import type { Root } from 'hast';
import { tVi, type T } from '../i18n/translate';

type Node = { type: string; tagName?: string; properties?: Record<string, unknown>; children?: Node[] };

/** `t`: the language of the names (lib/content/compile.ts compiles once per language). */
export function rehypeCodeLabels({ t = tVi }: { t?: T } = {}) {
  return (tree: Root) => {
    let n = 0;
    const visit = (node: Node) => {
      if (node.type === 'element' && node.tagName === 'pre') {
        n += 1;
        node.properties = { ...node.properties, dataCodeLabel: t('Khối mã {n}', { n }) };
        return;
      }
      // elements and the MDX nodes around them (a `:::` Callout)
      node.children?.forEach(visit);
    };
    visit(tree as unknown as Node);
  };
}
