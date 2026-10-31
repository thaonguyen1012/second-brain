#!/usr/bin/env node
// Rebuild the search index from web/content/docs without re-importing any zip.
// Usage: npm run search:rebuild [-- --book <slug> ...]
import { parseArgs } from 'node:util';
import { rebuildSearch, SEARCH_DB } from './lib/search-db.mjs';

const { values } = parseArgs({ options: { book: { type: 'string', multiple: true, default: [] } } });
const t = performance.now();
const { pages, rows } = rebuildSearch(values.book);
console.log(
  `search index: ${pages} pages, ${rows} sections${values.book.length ? ` (books: ${values.book.join(', ')})` : ''} -> ${SEARCH_DB} in ${((performance.now() - t) / 1000).toFixed(1)} s`,
);
