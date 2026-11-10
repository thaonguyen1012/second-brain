import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from './fixtures';
import { navRows, otherNav } from '@/lib/app-nav';

/** The Lộ trình row shows only while the roadmap file exists (lib/content/roadmap.ts; the flows run from web/). */
const roadmap = fs.existsSync(process.env.ROADMAP_FILE ?? path.join(process.cwd(), 'content/roadmap.json'));

test('home page renders "Hôm nay" inside the app shell', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Alex's Brain/);
  await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible();

  // Every sidebar row of lib/app-nav.ts is a link to its page; a row with a count says it after a comma. The
  // context starts without the language cookie, so the titles are the Vietnamese texts (msgid).
  const sidebar = page.getByRole('navigation', { name: 'Menu' });
  for (const link of [...navRows, ...otherNav.links]) {
    const row = sidebar.getByRole('link', { name: new RegExp(`^${link.title.msgid}(,|$)`) });
    if (link.href === '/lo-trinh/' && !roadmap) await expect(row).toHaveCount(0);
    else await expect(row).toHaveAttribute('href', link.href);
  }
  // Top bar: search trigger and theme toggle are hydrated and usable.
  await expect(page.getByRole('button', { name: /Tìm mọi thứ/ })).toBeVisible();
  await expect(page.locator('button[data-theme-toggle]')).toBeEnabled();

  await page.waitForLoadState('networkidle');
  expect(errors, 'uncaught errors in the page').toEqual([]);
});
