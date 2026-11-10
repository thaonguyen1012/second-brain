import { expect, test } from './fixtures';
import { books } from '@/lib/books';

interface TreeNode {
  type: 'page' | 'folder' | 'separator';
  name: string;
  url?: string;
  index?: TreeNode;
  children?: TreeNode[];
}

/** Pages of a book in sidebar order (folder index first), like fumadocs' flattenTree. */
function flatten(node: TreeNode): { name: string; url: string }[] {
  if (node.type === 'page' && node.url) return [{ name: node.name, url: node.url }];
  if (node.type !== 'folder') return [];
  return [...(node.index ? flatten(node.index) : []), ...(node.children ?? []).flatMap(flatten)];
}

const withSlash = (url: string) => (url.endsWith('/') ? url : `${url}/`);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Runs on the first handbook of the registry, whichever it is (a clone ships with the sample handbook).
test('a lesson page renders its headings and prev/next links within the book', async ({ page, request }) => {
  test.skip(books.length === 0, 'no handbook is imported');
  const book = books[0];
  const tree = await request.get(`/trees/${book.slug}`);
  expect(tree.ok()).toBe(true);
  const pages = flatten((await tree.json()) as TreeNode);
  expect(pages.length).toBeGreaterThan(3);
  const [, previous, current, next] = pages;

  const res = await page.goto(current.url);
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${escape(withSlash(current.url))}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(current.name);

  const article = page.locator('article');
  await expect(article.locator('h2').first()).toBeVisible();
  expect(await article.locator('h2').count()).toBeGreaterThan(1);
  // Table of contents lists the same headings.
  await expect(page.getByText('Trên trang này').first()).toBeVisible();

  const prevLink = page.getByRole('link', { name: /Bài trước/ });
  const nextLink = page.getByRole('link', { name: /Bài tiếp/ });
  await expect(prevLink).toHaveAttribute('href', withSlash(previous.url));
  await expect(prevLink).toContainText(previous.name);
  await expect(nextLink).toHaveAttribute('href', withSlash(next.url));
  await expect(nextLink).toContainText(next.name);

  await nextLink.click();
  await expect(page).toHaveURL(new RegExp(`${escape(withSlash(next.url))}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(next.name);
});
