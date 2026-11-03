import { expect, test } from './fixtures';

// A phrase that appears throughout the business handbooks.
const QUERY = 'khách hàng';

interface SearchResult {
  type: 'page' | 'heading' | 'text';
  url: string;
  content: string;
}

test('Cmd+K finds handbook pages and opens the chosen one', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle'); // the hot key listener is attached on hydration

  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog');
  const input = dialog.getByLabel('Tìm mọi thứ');
  await expect(input).toBeFocused();

  const handbook = page.waitForResponse((r) => {
    const url = new URL(r.url());
    // /api/search is answered after a 308 to /api/search/ (trailingSlash: true): wait for the final response.
    return /^\/api\/search\/?$/.test(url.pathname) && url.searchParams.get('query') === QUERY && r.status() !== 308;
  });
  await input.fill(QUERY);
  const response = await handbook;
  expect(response.ok()).toBe(true);
  const results = (await response.json()) as SearchResult[];
  const first = results.find((r) => r.type === 'page');
  expect(first, 'a handbook page in /api/search results').toBeDefined();
  expect(first!.url).toMatch(/^\/docs\//);

  const option = dialog.getByRole('option').filter({ hasText: first!.content }).first();
  await expect(option).toBeVisible();
  expect(await dialog.getByRole('option').count()).toBeGreaterThan(1);

  await option.click();
  await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === first!.url.replace(/\/$/, ''));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(first!.content);
});
