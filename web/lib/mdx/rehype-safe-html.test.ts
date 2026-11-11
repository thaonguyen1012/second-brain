import type { Element, ElementContent, Root } from 'hast';
import type { VFile } from 'vfile';
import { describe, expect, it, vi } from 'vitest';
import { books } from '../books';
import { CONTENT_DIR } from '../content/config';
import { rehypeSafeHtml } from './rehype-safe-html';

// Fixture handbooks: the real registry is the owner's data and may be empty
vi.mock('../books', async (importOriginal) => {
  const { mockRegistry } = await import('../books.fixture');
  return mockRegistry(await importOriginal<typeof import('../books')>());
});

// Hand-built hast trees, as rehype-raw hands them over. CONTENT_DIR points at an empty path (vitest.config.mts),
// so the image -> lesson map is empty and only the book's course link can be used.
const h = (tagName: string, properties: Element['properties'] = {}, children: ElementContent[] = []): Element => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const t = (value: string) => ({ type: 'text' as const, value });

function run(children: ElementContent[], file: Partial<VFile> = {}): Root {
  const tree: Root = { type: 'root', children };
  rehypeSafeHtml()(tree, { value: '', ...file } as VFile);
  return tree;
}

/** Every element of the tree, depth first. */
function elements(node: Root | Element): Element[] {
  return node.children.flatMap((c) => (c.type === 'element' ? [c, ...elements(c)] : []));
}
const textOf = (node: Root | ElementContent): string =>
  node.type === 'text' ? node.value : 'children' in node ? node.children.map((c) => textOf(c as ElementContent)).join('') : '';

describe('unknown and unsafe tags', () => {
  it('shows a raw <script> as literal source text', () => {
    const source = 'Trước <script>alert(1)</script> sau';
    const script = h('script', {}, [t('alert(1)')]);
    script.position = { start: { line: 1, column: 7, offset: 6 }, end: { line: 1, column: 32, offset: 31 } };
    const tree = run([h('p', {}, [t('Trước '), script, t(' sau')])], { value: source });
    expect(elements(tree).map((e) => e.tagName)).toEqual(['p']);
    expect(textOf(tree)).toBe(source);
  });

  it('falls back to "<tag>" when there is no source position', () => {
    const tree = run([h('style', {}, [t('body{display:none}')]), h('form', {}, [h('input')])]);
    expect(tree.children).toEqual([t('<style>'), t('<form>')]);
  });

  it('removes nested unknown tags inside allowed ones', () => {
    const tree = run([h('div', {}, [h('section', {}, [h('svg', {}, [h('script')])])])]);
    expect(elements(tree).map((e) => e.tagName)).toEqual(['div', 'section']);
  });
});

describe('attributes', () => {
  it('drops event handlers in any case', () => {
    const [a] = run([h('a', { href: 'https://a.cz/', onClick: 'x()', ONMOUSEOVER: 'y()', title: 'ok' })]).children as Element[];
    expect(a.properties).toEqual({ href: 'https://a.cz/', title: 'ok' });
  });

  it('drops javascript: URLs, also with spaces or capitals', () => {
    const [a, b, c] = run([
      h('a', { href: 'javascript:alert(1)' }),
      h('a', { href: '  JavaScript:alert(1)' }),
      h('a', { href: '/docs/it/' }),
    ]).children as Element[];
    expect(a.properties).toEqual({});
    expect(b.properties).toEqual({});
    expect(c.properties).toEqual({ href: '/docs/it/' });
  });

  it('keeps the text of code blocks and cleans elements inside them (security audit P-01)', () => {
    // a markdown code block reaches this plugin as pre > code > text (before Shiki): its text is untouched
    const fenced = run([h('pre', {}, [h('code', { className: ['language-html'] }, [t('<script>x</script>')])])]);
    expect(elements(fenced).map((e) => e.tagName)).toEqual(['pre', 'code']);
    expect(textOf(fenced)).toBe('<script>x</script>');
    // a raw <script> element inside raw <pre><code> is shown as text, like anywhere else
    const raw = run([h('pre', {}, [h('code', {}, [h('script', {}, [t('x')])])])]);
    expect(elements(raw).map((e) => e.tagName)).toEqual(['pre', 'code']);
  });

  it('walks into MDX nodes with children (a ::: Callout)', () => {
    const callout = { type: 'mdxJsxFlowElement', name: 'Callout', attributes: [], children: [h('script', {}, [t('x')])] };
    const tree = run([callout as unknown as ElementContent]);
    expect(elements(tree).some((e) => e.tagName === 'script')).toBe(false);
  });
});

describe('images', () => {
  it('keeps local /img/ images with only src, alt and lazy loading', () => {
    const [img] = run([h('img', { src: '/img/a.webp', alt: 'Sơ đồ', onError: 'x()', width: 900 })]).children as Element[];
    expect(img).toMatchObject({ tagName: 'img', properties: { src: '/img/a.webp', alt: 'Sơ đồ', loading: 'lazy' } });
    expect(Object.keys(img.properties)).toHaveLength(3);
  });

  it('turns an external image into a placeholder with its alt text and no <img>', () => {
    const tree = run([h('img', { src: 'https://evil.example/pixel.gif', alt: 'Biểu đồ doanh thu' })]);
    const [box] = tree.children as Element[];
    expect(box).toMatchObject({ tagName: 'span', properties: { role: 'img', ariaLabel: 'Biểu đồ doanh thu' } });
    expect(elements(tree).some((e) => e.tagName === 'img' || e.properties.href)).toBe(false);
    expect(textOf(tree)).toContain('Hình minh họa: Biểu đồ doanh thu');
  });

  it('treats a protocol-relative or /imgx/ path as external', () => {
    for (const src of ['//cdn.example/a.png', '/imgx/a.png', 'img/a.png'])
      expect((run([h('img', { src })]).children[0] as Element).tagName, src).toBe('span');
  });

  it("links a Coursera image to the book's course when the lesson is unknown", () => {
    const book = books.find((b) => b.courseraUrls.some((c) => c.url))!;
    const tree = run([h('img', { src: 'https://d3c33hcgiwev3.cloudfront.net/x.png?Expires=1' })], {
      path: `${CONTENT_DIR}/${book.track}/${book.slug}/m1.md`,
    });
    const link = elements(tree).find((e) => e.tagName === 'a');
    expect(link?.properties).toMatchObject({ href: book.courseraUrls.find((c) => c.url)!.url, target: '_blank' });
    expect(textOf(link!)).toBe('Xem khóa học trên Coursera');
  });

  it('gives no link for a non-Coursera image or an unknown book', () => {
    const book = books[0];
    const other = run([h('img', { src: 'https://example.com/a.png' })], {
      path: `${CONTENT_DIR}/${book.track}/${book.slug}/m1.md`,
    });
    expect(elements(other).some((e) => e.tagName === 'a')).toBe(false);
    const unknown = run([h('img', { src: 'https://coursera.org/a.png' })], { path: `${CONTENT_DIR}/it/nope/m1.md` });
    expect(elements(unknown).some((e) => e.tagName === 'a')).toBe(false);
  });
});

describe('embeds', () => {
  it('turns an iframe into a link to its http(s) source', () => {
    const tree = run([h('iframe', { src: 'https://www.youtube.com/embed/abc', allow: 'autoplay' })]);
    const link = elements(tree).find((e) => e.tagName === 'a');
    expect(elements(tree).some((e) => e.tagName === 'iframe')).toBe(false);
    expect(link?.properties).toMatchObject({ href: 'https://www.youtube.com/embed/abc', rel: ['noreferrer'] });
    expect(textOf(link!)).toBe('Nội dung nhúng từ www.youtube.com (mở ở trang gốc)');
  });

  it('turns video, audio, embed, object and source into placeholders', () => {
    const tree = run(['video', 'audio', 'embed', 'object', 'source'].map((tag) => h(tag, { src: 'https://a.cz/m.mp4' })));
    expect(tree.children.every((c) => c.type === 'element' && c.tagName === 'span')).toBe(true);
  });

  it('gives no link for a non-http embed source', () => {
    const tree = run([h('iframe', { src: 'javascript:alert(1)' }), h('iframe', {})]);
    expect(elements(tree).some((e) => e.tagName === 'a')).toBe(false);
    expect(textOf(tree)).toBe('Nội dung nhúng (mở ở trang gốc)'.repeat(2));
  });
});
