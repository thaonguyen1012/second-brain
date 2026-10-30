// Runs after rehype-raw. Keeps the page self-contained and safe:
// - images become a build-time placeholder (no <img> to external hosts; all source images are offline-unavailable),
// - iframes/video/audio/embeds become a plain link,
// - unknown or unsafe raw HTML tags are shown as literal text (content often mentions tags like <script>),
// - event-handler attributes and javascript: URLs are dropped.
import type { Element, ElementContent, Root, Text } from 'hast';
import type { VFile } from 'vfile';

const ALLOWED = new Set(
  (
    'a abbr b blockquote br caption center code col colgroup dd del details div dl dt em figcaption figure ' +
    'h1 h2 h3 h4 h5 h6 hr i ins kbd li mark ol p pre q s samp small span strong sub summary sup ' +
    'table tbody td tfoot th thead tr u ul var input section article header footer nav aside main time cite'
  ).split(' '),
);
const EMBEDS = new Set(['iframe', 'video', 'audio', 'embed', 'object', 'source']);

const hostOf = (url: unknown) => {
  try {
    return new URL(String(url)).host;
  } catch {
    return '';
  }
};

const text = (value: string): Text => ({ type: 'text', value });

function el(tagName: string, className: string, children: ElementContent[], props: Element['properties'] = {}): Element {
  return { type: 'element', tagName, properties: { className: [className], ...props }, children };
}

function imagePlaceholder(node: Element): Element {
  const alt = String(node.properties?.alt ?? '').trim();
  const host = hostOf(node.properties?.src);
  return el('span', 'img-missing', [
    el('span', 'img-missing-icon', [text('🖼')], { ariaHidden: 'true' }),
    el('span', 'img-missing-text', [
      text(alt ? `Hình minh họa: ${alt}` : 'Hình minh họa'),
      el('span', 'img-missing-note', [text(host ? ` (ảnh gốc trên ${host}, không có bản offline)` : ' (không có bản offline)')]),
    ]),
  ], { role: 'img', ariaLabel: alt || 'Hình minh họa không có bản offline' });
}

function embedPlaceholder(node: Element): Element {
  const src = String(node.properties?.src ?? '');
  const host = hostOf(src);
  const label = `Nội dung nhúng${host ? ` từ ${host}` : ''} (mở ở trang gốc)`;
  return el('span', 'embed-missing', src && /^https?:/.test(src)
    ? [el('a', 'embed-missing-link', [text(label)], { href: src, target: '_blank', rel: ['noreferrer'] })]
    : [text(label)]);
}

function literal(node: Element, file: VFile): Text {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start !== undefined && end !== undefined) return text(String(file.value).slice(start, end));
  return text(`<${node.tagName}>`);
}

function clean(node: Element) {
  const props = node.properties ?? {};
  for (const key of Object.keys(props)) {
    if (/^on/i.test(key)) delete props[key];
    if ((key === 'href' || key === 'src') && /^\s*javascript:/i.test(String(props[key]))) delete props[key];
  }
}

export function rehypeSafeHtml() {
  return (tree: Root, file: VFile) => {
    const visit = (parent: Root | Element) => {
      parent.children = parent.children.map((child) => {
        if (child.type !== 'element') return child;
        if (child.tagName === 'img') return imagePlaceholder(child);
        if (EMBEDS.has(child.tagName)) return embedPlaceholder(child);
        // <pre>/<code> come from markdown code blocks too; never touch their content
        if (!ALLOWED.has(child.tagName)) return literal(child, file);
        clean(child);
        if (child.tagName !== 'pre' && child.tagName !== 'code') visit(child);
        return child;
      }) as typeof parent.children;
    };
    visit(tree);
  };
}
