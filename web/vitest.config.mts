// Unit tests for the pure helpers in lib/ (DECISIONS.md 10.3). Node environment: no DOM library is installed;
// a test that needs one must say so in the owner's report first. Playwright flows live in e2e/ (playwright.config.ts).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': root } },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // Unit tests never read the handbook content: an empty CONTENT_DIR keeps them independent of it. The base path
    // is pinned too, so an exported NEXT_PUBLIC_BASE_PATH in the shell does not change expected URLs.
    env: { CONTENT_DIR: '/nonexistent/alex-brain-unit-tests', NEXT_PUBLIC_BASE_PATH: '' },
  },
});
