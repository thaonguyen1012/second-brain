// Server mode is the default (output: 'standalone'): content is read from disk at runtime.
// STATIC_EXPORT=1 produces an optional static export (use with BUILD_SUBSET; not the deploy target).
const staticExport = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// The UI language (lib/i18n/README.md): every page is prerendered twice under app/[lang]/, and the `lang` cookie
// (set by the language switch) picks which one a URL shows, so both languages keep one URL and Vietnamese stays the
// default. `afterFiles`: public/ files and Next's own come first. The first segment may not be a language (the
// rewritten path is checked again by the next rule; /en/... also opens a page in English directly) nor a route
// handler (/api/search, /trees/<book>.json) or attachment (/files/).
// A rewrite here, not in a proxy.ts: with HOSTNAME=127.0.0.1 (make dev) Next 16 takes a proxy's rewrite for an
// external URL and fetches it from itself.
const page = '/:first((?!(?:vi|en|api|trees|files|_next)(?:/|$))[^/]+)/:rest*';
const english = [{ type: 'cookie', key: 'lang', value: 'en' }];
const languageRewrites = [
  { source: '/', has: english, destination: '/en' },
  { source: page, has: english, destination: '/en/:first/:rest*' },
  { source: '/', destination: '/vi' },
  { source: page, destination: '/vi/:first/:rest*' },
];

/** @type {import('next').NextConfig} */
const config = {
  output: staticExport ? 'export' : 'standalone',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  reactStrictMode: true,
  // No dev indicator badge over the sidebar in `next dev` (it covered "Hướng dẫn"); build errors still show.
  devIndicators: false,
  // markdown is compiled at request time by the server, keep these packages out of the bundle
  // content/ is read from CONTENT_DIR at runtime, never copied into the standalone bundle
  outputFileTracingExcludes: { '*': ['./content/docs/**'] },
  serverExternalPackages: ['@fumadocs/mdx-remote', 'shiki'],
  // A static export has no server to read the cookie: its pages stay under out/vi/ and out/en/
  ...(staticExport ? {} : { rewrites: async () => ({ afterFiles: languageRewrites }) }),
};

export default config;
