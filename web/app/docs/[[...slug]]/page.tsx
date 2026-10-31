import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { baseOptions } from '@/lib/layout.shared';
import { getNeighbours, getPrunedTree } from '@/lib/page-tree';
import { loadPage } from '@/lib/content/compile';
import type { DocPageData } from '@/lib/content/scan';

// Pages are rendered on first request and cached (ISR); nothing is prerendered at build time.
export const dynamicParams = true;
export const revalidate = false;

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as unknown as DocPageData;
  const { body: MDX, toc } = await loadPage(data.absolutePath);

  return (
    <DocsLayout tree={getPrunedTree(page.url)} {...baseOptions()}>
      <DocsPage toc={toc} footer={{ items: getNeighbours(page.url) }}>
        <DocsTitle>{data.title}</DocsTitle>
        <DocsBody>
          <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
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
