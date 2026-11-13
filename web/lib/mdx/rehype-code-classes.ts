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

/**
 * Only Shiki's own declarations are lifted into the page's stylesheet (security audit P-02): its colour variables with
 * a hex value. Anything else, also a content style that merely contains `--shiki`, is left where it is (and
 * rehype-safe-html has already dropped custom properties from content). Each declaration ends at a `;` or the end, so
 * no run of spaces can be split two ways between declarations (CodeQL js/redos).
 */
export const SHIKI_STYLE =
  /^\s*(?:--shiki-(?:light|dark)(?:-bg|-font-style|-font-weight|-text-decoration)?\s*:\s*(?:#[0-9a-fA-F]{3,8}|italic|bold|normal|underline|none|inherit)\s*(?:;\s*|$))+$/;

const className = (style: string) => `sk-${createHash('md5').update(style).digest('hex').slice(0, 7)}`;

export function rehypeCodeClasses() {
  return (tree: Root, file: VFile) => {
    const rules = new Map<string, string>();
    const visit = (node: AnyNode) => {
      // hast elements (token spans)
      const style = node.properties?.style;
      if (node.type === 'element' && typeof style === 'string' && SHIKI_STYLE.test(style)) {
        const name = className(style);
        rules.set(name, style);
        delete node.properties!.style;
        const cls = node.properties!.className;
        node.properties!.className = [...(Array.isArray(cls) ? cls : cls ? [String(cls)] : []), name];
      }
      // MDX JSX wrappers (Fumadocs code block) carry the pre background as a style attribute
      if (node.type.startsWith('mdxJsx') && node.attributes) {
        const attr = node.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === 'style');
        if (attr && typeof attr.value === 'string' && SHIKI_STYLE.test(attr.value)) {
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
