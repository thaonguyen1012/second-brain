import { getBookTree } from '@/lib/page-tree';

// /trees/<book>.json — the full sidebar tree of one book, fetched once by the browser (R1).
export async function GET(_req: Request, { params }: RouteContext<'/trees/[book]'>) {
  const { book } = await params;
  const tree = getBookTree(book.replace(/\.json$/, ''));
  if (!tree) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json(tree, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' },
  });
}
