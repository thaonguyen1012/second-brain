import { expect, test } from './fixtures';
import { books } from '@/lib/books';

// The context starts with prefers-color-scheme: light (playwright.config.ts), so the page starts light.
test('dark mode toggle switches the theme and survives a reload', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const toggle = page.locator('button[data-theme-toggle]');
  await expect(html).not.toHaveClass(/\bdark\b/);
  await page.waitForLoadState('networkidle');

  await toggle.click();
  await expect(html).toHaveClass(/\bdark\b/);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(background);

  // Lesson pages (the docs layout) share the setting: same next-themes storage on the same origin.
  await page.goto(`/docs/${books[0].track}/${books[0].slug}/`);
  await expect(html).toHaveClass(/\bdark\b/);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await toggle.click();
  await expect(html).not.toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);
});
