// R4: after Shiki, move each token's inline style (--shiki-light/--shiki-dark colors) into a short
// class, and collect the rules in file.data.codeCss. The page inlines only its own rules, so a
// cached page always carries the CSS it needs.
import { createHash } from 'node:crypto';
import type { Root } from 'hast';
import type { VFile } from 'vfile';

interface AnyNode {
  type: string;
  properties?: Record<string, unknown>;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: AnyNode[];
}

const className = (style: string) => `sk-${createHash('md5').update(style).digest('hex').slice(0, 7)}`;

export function rehypeCodeClasses() {
  return (tree: Root, file: VFile) => {
    const rules = new Map<string, string>();
    const visit = (node: AnyNode) => {
      // hast elements (token spans)
      const style = node.properties?.style;
      if (node.type === 'element' && typeof style === 'string' && style.includes('--shiki')) {
        const name = className(style);
        rules.set(name, style);
        delete node.properties!.style;
        const cls = node.properties!.className;
        node.properties!.className = [...(Array.isArray(cls) ? cls : cls ? [String(cls)] : []), name];
      }
      // MDX JSX wrappers (Fumadocs code block) carry the pre background as a style attribute
      if (node.type.startsWith('mdxJsx') && node.attributes) {
        const attr = node.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === 'style');
        if (attr && typeof attr.value === 'string' && attr.value.includes('--shiki')) {
          const name = className(attr.value);
          rules.set(name, attr.value);
          node.attributes = node.attributes.filter((a) => a !== attr);
          const cls = node.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === 'className');
          if (cls) cls.value = `${String(cls.value ?? '')} ${name}`.trim();
          else node.attributes.push({ type: 'mdxJsxAttribute', name: 'className', value: name });
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree as unknown as AnyNode);
    file.data.codeCss = [...rules].map(([name, s]) => `.${name}{${s}}`).join('');
  };
}
