import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
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
