import { expect, test as base } from '@playwright/test';

/**
 * Every flow runs against the owner's real data (make dev on :8080), so it must only read. This automatic fixture
 * fails a test that sends anything but GET/HEAD/OPTIONS to the backend.
 */
export const test = base.extend<{ readOnly: void }>({
  readOnly: [
    async ({ page }, run) => {
      const writes: string[] = [];
      page.on('request', (r) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && new URL(r.url()).pathname.startsWith('/api/'))
          writes.push(`${r.method()} ${r.url()}`);
      });
      await run();
      expect(writes, 'requests that would change data').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
