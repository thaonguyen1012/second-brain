import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // Pages are prerendered at /vi/... and /en/... behind rewrites: the path without the language comes from
    // lib/use-app-pathname.ts (lib/i18n/README.md).
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    ignores: ['lib/use-app-pathname.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/navigation',
              importNames: ['usePathname'],
              message: 'Use useAppPathname from @/lib/use-app-pathname (the path without /vi or /en).',
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.source/**',
    // Vendored mermaid copy (scripts/prepare-vendor.mjs), gitignored, not our code.
    'public/vendor/**',
    // Playwright output (gitignored).
    'test-results/**',
    'playwright-report/**',
    'blob-report/**',
  ]),
]);

export default eslintConfig;
