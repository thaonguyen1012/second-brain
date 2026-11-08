import { expect, test } from './fixtures';
import { books } from '@/lib/books';

// The UI languages (DECISIONS 9.9): the top bar switch sets the `lang` cookie and reloads the same URL in the other
// language; the lesson pages follow it; /en/... opens a page in English directly. The context starts without the
// cookie, so the app starts Vietnamese. Reads only (the cookie is the browser's, nothing is sent to Django).
test('the language switch turns the app English and back, lesson pages included', async ({ page, context }) => {
  await page.goto('/tuan/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: /^Hôm nay/ })).toBeVisible();
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Switch to English/ }).click();
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(page).toHaveURL(/\/tuan\/$/);
  await expect(page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: /^Today/ })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'lang')?.value).toBe('en');

  // A lesson keeps its Vietnamese content but its frame speaks English.
  await page.goto(`/docs/${books[0].track}/${books[0].slug}/`);
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(page.getByText(/min read/).first()).toBeVisible();

  await page.goto('/tuan/');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Chuyển sang tiếng Việt/ }).click();
  await expect(html).toHaveAttribute('lang', 'vi');
  expect((await context.cookies()).find((c) => c.name === 'lang')?.value).toBe('vi');
});

test('/en/... opens a page in English whatever the cookie says', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'lang', value: 'vi', url: baseURL! }]);
  await page.goto('/en/thu-vien/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
});

test('/en/... stays English when the page changes its own URL', async ({ page }) => {
  // A remembered board is written into the URL on load (lib/use-board-view.ts): it must keep /en/, since the plain
  // URL would come back in the cookie's language (none here, so Vietnamese).
  await page.addInitScript(() => window.localStorage.setItem('alex-brain:library-view', 'board'));
  await page.goto('/en/thu-vien/');
  await expect(page).toHaveURL(/\/en\/thu-vien\/\?view=board$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
});
