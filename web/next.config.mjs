// Server mode is the default (output: 'standalone'): content is read from disk at runtime.
// STATIC_EXPORT=1 produces an optional static export (use with BUILD_SUBSET; not the deploy target).
const staticExport = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const config = {
  output: staticExport ? 'export' : 'standalone',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  reactStrictMode: true,
  // markdown is compiled at request time by the server, keep these packages out of the bundle
  // content/ is read from CONTENT_DIR at runtime, never copied into the standalone bundle
  outputFileTracingExcludes: { '*': ['./content/docs/**'] },
  serverExternalPackages: ['@fumadocs/mdx-remote', 'shiki'],
};

export default config;
