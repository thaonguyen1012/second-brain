import Link from 'next/link';
import { Fragment } from 'react';
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

// Pages are rendered on first request and cached (ISR); nothing is prerendered at build time.
export const dynamicParams = true;
export const revalidate = false;

function Breadcrumb({ url }: { url: string }) {
  const crumbs = [{ name: 'Trang chủ', url: '/' }, ...getCrumbs(url)];
  return (
    <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-fd-muted-foreground">
      {crumbs.map((c, i) => (
        <Fragment key={`${i}-${c.name}`}>
          {i > 0 && <span aria-hidden>›</span>}
          {c.url ? (
            <Link href={c.url} className="truncate hover:text-fd-primary">
              {c.name}
            </Link>
          ) : (
            <span className="truncate">{c.name}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as unknown as DocPageData;
  const { body: MDX, toc, codeCss, readingMinutes } = await loadPage(data.absolutePath);
  const { tree, book } = getShellTree(page.url);

  return (
    <LazyDocsLayout tree={tree} book={book} {...baseOptions()}>
      {codeCss && <style>{codeCss}</style>}
      <DocsPage toc={toc} breadcrumb={{ enabled: false }} footer={{ items: getNeighbours(page.url) }}>
        <Breadcrumb url={page.url} />
        <DocsTitle>{data.title}</DocsTitle>
        <p className="text-sm text-fd-muted-foreground">≈ {readingMinutes} phút đọc</p>
        <DocsBody>
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

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const data = page.data as unknown as DocPageData;
  return { title: data.title, description: data.description };
}
