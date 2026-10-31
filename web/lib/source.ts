import { loader } from 'fumadocs-core/source';
import { docsRoute } from './shared';
import { scanContent, type DocPageData } from './content/scan';

// Built once per server process from the files on disk (frontmatter only, bodies load on demand).
export const source = loader({
  baseUrl: docsRoute,
  source: { files: scanContent() } as { files: ReturnType<typeof scanContent> } & {
    files: { data: DocPageData }[];
  },
});
