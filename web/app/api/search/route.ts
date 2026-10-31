import { createSearchAPI } from 'fumadocs-core/search/server';
import { buildIndexes } from '@/lib/content/search-index';

export const { GET } = createSearchAPI('advanced', {
  indexes: () => buildIndexes(),
});
