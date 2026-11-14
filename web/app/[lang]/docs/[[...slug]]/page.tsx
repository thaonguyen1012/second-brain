import Link from 'next/link';
import { Fragment, type ComponentProps } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import { source } from '@/lib/source';
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { baseOptions } from '@/lib/layout.shared';
import { getCrumbs, getNeighbours, getShellTree } from '@/lib/page-tree';
import { loadPage } from '@/lib/content/compile';
import type { DocPageData } from '@/lib/content/scan';
import { LazyDocsLayout } from '@/components/lazy-docs-layout';
import { DoneCheckbox, VisitTracker } from '@/components/progress';
import { contentText } from '@/lib/i18n/content-lang';
import { getT } from '@/lib/i18n/server';
import type { T } from '@/lib/i18n/translate';

// Pages are rendered on first request and cached (ISR); nothing is prerendered at build time.
export const dynamicParams = true;
export const revalidate = false;

function Breadcrumb({ url, t }: { url: string; t: T }) {
  const crumbs = [{ name: t('Trang chủ'), url: '/' }, ...getCrumbs(url)];
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground">
      {crumbs.map((c, i) => {
        // after "Trang chủ", the book and its folders: handbook titles
        const name = i === 0 ? c.name : contentText(c.name, t.locale);
        return (
          <Fragment key={`${i}-${c.name}`}>
            {i > 0 && <span aria-hidden>›</span>}
            {c.url ? (
              <Link href={c.url} className="truncate hover:text-fd-primary">
                {name}
              </Link>
            ) : (
              <span className="truncate">{name}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

/** A previous/next link: its title and description (the book's first page has one) are handbook text. */
function neighbour(item: PageTree.Item | undefined, t: T): PageTree.Item | undefined {
  if (!item) return undefined;
  const text = (s: PageTree.Item['name']) => (typeof s === 'string' ? contentText(s, t.locale) : s);
  return { ...item, name: text(item.name), description: text(item.description) };
}

export default async function Page(props: PageProps<'/[lang]/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as unknown as DocPageData;
  const t = await getT();
  const { body: MDX, toc, codeCss, readingMinutes } = await loadPage(data.absolutePath, t);
  const { tree, book } = getShellTree(page.url);
  const { previous, next } = getNeighbours(page.url);
  // Below xl Fumadocs draws the table of contents as a popover inside a <header>, outside the page's main: a banner,
  // the second one beside the 390 px top bar. Its box (Base UI's Collapsible root, which takes `render`) is drawn as
  // the same navigation as the contents beside the lesson, a <nav> with its name (one of the two shows at a time), so
  // the header in it is no banner. A div with role="navigation" would do for a screen reader, but axe still takes a
  // <header> that only an ARIA role scopes for a banner, then nested in a landmark.
  const tocPopover = { render: <nav />, 'aria-label': t('Trên trang này') } as ComponentProps<'div'>;

  return (
    <LazyDocsLayout tree={tree} book={book} {...baseOptions(t)}>
      {codeCss && <style>{codeCss}</style>}
      {/* The lesson (title, headings, body) is Vietnamese whatever the UI language: lang="vi" on it. Its article
          (#nd-page) takes the focus from the skip link (lazy-docs-layout.tsx), focusable only while it holds it
          (skip-link.tsx), without a ring: it is not a control. The table of contents beside it is the lesson's own
          navigation, named by its heading: Fumadocs draws it as a plain div, which left its links outside every
          landmark. Below xl it is a popover under the top edge (tocPopover above) */}
      <DocsPage
        className="outline-none"
        toc={toc.map((i) => ({ ...i, title: <span lang="vi">{i.title}</span> }))}
        tableOfContent={{ container: { role: 'navigation', 'aria-labelledby': 'toc-title' } }}
        tableOfContentPopover={{ container: tocPopover }}
        breadcrumb={{ enabled: false }}
        footer={{ items: { previous: neighbour(previous, t), next: neighbour(next, t) } }}
      >
        <Breadcrumb url={page.url} t={t} />
        <DocsTitle lang="vi">{data.title}</DocsTitle>
        <p className="text-sm text-fd-muted-foreground">{t('≈ {n} phút đọc', { n: readingMinutes })}</p>
        <DocsBody lang="vi">
          <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
        </DocsBody>
        <DoneCheckbox url={page.url} />
        <VisitTracker url={page.url} title={data.title} />
      </DocsPage>
    </LazyDocsLayout>
  );
}

export async function generateStaticParams() {
  // static export only (optional tool): every page of the loaded subset
  return process.env.STATIC_EXPORT === '1' ? source.generateParams() : [];
}

export async function generateMetadata(props: PageProps<'/[lang]/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const data = page.data as unknown as DocPageData;
  return { title: data.title, description: data.description };
}
