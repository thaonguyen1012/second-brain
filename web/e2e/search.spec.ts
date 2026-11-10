import { expect, test } from './fixtures';
import { books } from '@/lib/books';

interface TreeNode {
  type: 'page' | 'folder' | 'separator';
  name: string;
  index?: TreeNode;
  children?: TreeNode[];
}

/** Page names of a book's sidebar tree, in order. */
const names = (node: TreeNode): string[] =>
  node.type === 'page' ? [node.name] : [...(node.index ? names(node.index) : []), ...(node.children ?? []).flatMap(names)];

interface SearchResult {
  type: 'page' | 'heading' | 'text';
  url: string;
  content: string;
}

// Searches for a word of a page title of the first handbook, whichever it is: a title is always in the index.
test('Cmd+K finds handbook pages and opens the chosen one', async ({ page, request }) => {
  test.skip(books.length === 0, 'no handbook is imported');
  const tree = await request.get(`/trees/${books[0].slug}`);
  expect(tree.ok()).toBe(true);
  const word = names((await tree.json()) as TreeNode)
    .slice(1)
    .flatMap((name) => name.match(/\p{L}{5,}/gu) ?? [])[0];
  expect(word, 'a word of five letters or more in a page title').toBeTruthy();
  const QUERY = word!;

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
