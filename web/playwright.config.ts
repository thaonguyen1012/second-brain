// Browser flows of DECISIONS.md 10.3 (home, lesson, search, dark mode), run with `npm run e2e` / `make e2e`.
// They need the whole stack on one origin (make dev: proxy :8080 -> Django + Next) and only read: no flow creates,
// changes or deletes data. Uses the installed Google Chrome (channel 'chrome'); Playwright never downloads a browser
// here (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 when installing).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE ?? 'http://127.0.0.1:8080',
    channel: 'chrome',
    headless: true,
    locale: 'vi-VN',
    timezoneId: 'Europe/Prague',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
