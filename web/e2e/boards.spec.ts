import type { Locator, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';

// The two status boards (Dự án, Thư viện; components/brain/status-board.tsx): four lanes, a move from a card's menu
// (lane, live region, focus) and a pointer drag back. Read-only like every flow: the status PATCH is answered here,
// in the browser (a page route runs before the fixture's context route), with the record as the API has it plus the
// new status, so nothing reaches Django. Skipped when the board has no card.

const BOARDS = [
  { name: 'Dự án', path: '/cong-viec/', record: /^\/api\/projects\/\d+\/?$/ },
  { name: 'Thư viện', path: '/thu-vien/', record: /^\/api\/items\/\d+\/?$/ },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Answers every PATCH of one record in the browser; returns the URLs it answered. */
async function answerPatches(page: Page, record: RegExp): Promise<string[]> {
  const answered: string[] = [];
  await page.route(
    (url) => record.test(url.pathname),
    async (route: Route) => {
      const r = route.request();
      if (r.method() !== 'PATCH') return route.fallback();
      const now = await (await page.request.get(r.url())).json();
      answered.push(r.url());
      await route.fulfill({ json: { ...now, ...r.postDataJSON() } });
    },
  );
  return answered;
}

/** A lane by its status label; its heading reads "<label> , <count> <noun>". */
const lane = (page: Page, label: string) =>
  page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name: new RegExp(`^${escape(label)}\\s*,`) }) });

/** A card by its exact title, on the page or inside one lane (the inner locator is relative to the card). */
const card = (page: Page, title: string, within?: Locator) =>
  (within ?? page)
    .locator('li[draggable]')
    .filter({ has: page.locator('.line-clamp-2', { hasText: new RegExp(`^${escape(title)}$`) }) });

/**
 * A pointer drag in small steps, the way a hand moves (one long jump does not start an HTML5 drag every time), onto
 * the top of the lane: lanes are as tall as the longest one, so a lane's centre can be below the viewport.
 */
async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 4, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + 24, { steps: 20 });
  await page.mouse.up();
}

for (const board of BOARDS) {
  test(`${board.name} board: lanes, a move from the card menu and a drag back`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const answered = await answerPatches(page, board.record);

    await page.goto(`${board.path}?view=board`);
    await expect(page.locator('section h2')).toHaveCount(4);
    await page.waitForLoadState('networkidle');
    const first = page.locator('li[draggable]').first();
    test.skip((await first.count()) === 0, 'no card on this board');

    const title = (await first.locator('.line-clamp-2').first().innerText()).trim();
    const from = (await page.locator('section').filter({ has: card(page, title) }).locator('h2 > *').first().innerText()).trim();

    // Move from the menu: the first other lane it offers
    await card(page, title).getByRole('button', { name: /^Thao tác cho/ }).click();
    const entry = page.getByRole('menuitem', { name: /^Chuyển sang / }).first();
    const to = (await entry.innerText()).replace(/^Chuyển sang\s+/, '').trim();
    await entry.click();
    await expect(card(page, title, lane(page, to))).toHaveCount(1);
    await expect(page.locator('p.sr-only[role="status"]').first()).toHaveText(`Đã chuyển “${title}” sang ${to}`);
    await expect(page.locator(':focus')).toContainText(title);
    // a card whose save is pending is not draggable (aria-busy): wait for the answer
    await expect(card(page, title)).not.toHaveAttribute('aria-busy', 'true');

    // Drag it back to where it was
    await drag(page, card(page, title), lane(page, from));
    await expect(card(page, title, lane(page, from))).toHaveCount(1);
    await expect(page.locator('p.sr-only[role="status"]').first()).toContainText(`sang ${from}`);
    expect(answered, 'status changes answered in the browser').toHaveLength(2);
    expect(errors, 'uncaught errors in the page').toEqual([]);
  });
}
