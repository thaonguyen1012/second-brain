import { expect, test as base } from '@playwright/test';

/**
 * Background writes a page sends on its own when it is only viewed. They are aborted like every other write, but
 * do not fail the test: a lesson page saves "Tiếp tục học" (PUT /api/progress/last-visited, 1.5 s after the visit).
 */
const EXPECTED_WRITES = [{ method: 'PUT', path: /^\/api\/progress\/last-visited\/?$/ }];

/**
 * Every flow runs against the owner's real data (make dev on :8080), so it must only read. This automatic fixture
 * aborts every request to /api/ that is not GET/HEAD/OPTIONS before it leaves the browser, so nothing reaches
 * Django, and then fails the test if any of them was not an expected background write.
 */
export const test = base.extend<{ readOnly: void }>({
  readOnly: [
    async ({ context }, run) => {
      const writes: string[] = [];
      await context.route(
        (url) => url.pathname.startsWith('/api/'),
        (route) => {
          const r = route.request();
          const method = r.method();
          if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return route.continue();
          const { pathname } = new URL(r.url());
          if (!EXPECTED_WRITES.some((w) => w.method === method && w.path.test(pathname)))
            writes.push(`${method} ${r.url()}`);
          return route.abort();
        },
      );
      await run();
      expect(writes, 'requests that would change data (aborted)').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
