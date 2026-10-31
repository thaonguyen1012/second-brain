import { searchIndex } from '@/lib/search/fts';

// Full-text search over the SQLite FTS5 index built by `npm run search:rebuild` (and by the importer).
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get('query') ?? '';
  const tag = params.get('tag');
  return Response.json(searchIndex(query, tag ? tag.split(',').filter(Boolean) : []));
}
