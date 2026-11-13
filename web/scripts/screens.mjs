#!/usr/bin/env node
// Screenshot tool for design passes: shoots every app page at desktop and phone width, light and dark.
//
//   node web/scripts/screens.mjs --base http://127.0.0.1:8080 --out <dir> [--only home,tuan] [--workers 3]
//
// Needs the whole stack on one origin (make dev: proxy :8080 -> Django + Next). Uses the installed Google Chrome
// (channel 'chrome'); never downloads a browser. Read-only: it never clicks anything that writes, and every
// non-GET request to /api/ is aborted and reported. Files are named <slug>--<width>--<theme>.png. Against `next dev`
// the dev overlay (nextjs-portal) is hidden from the shots; issues it reports are listed as a warning instead.
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { CONTENT_DIR } from './lib/book-import.mjs';

const SEARCH_QUERY = 'progress';

/** The first lesson page on disk (a page of a handbook that is not its index), or null without handbooks. */
function firstLesson() {
  if (!existsSync(CONTENT_DIR)) return null;
  const walk = (dir) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.isDirectory()) {
        const found = walk(path.join(dir, e.name));
        if (found) return found;
      } else if (e.name.endsWith('.md') && e.name !== 'index.md') return path.join(dir, e.name);
    }
    return null;
  };
  const file = walk(CONTENT_DIR);
  return file ? `/docs/${path.relative(CONTENT_DIR, file).split(path.sep).join('/').replace(/\.md$/, '')}/` : null;
}
const LESSON = firstLesson();

/** slug -> path; `search` is the Cmd+K dialog opened on the home page. */
const PAGES = [
  ['home', '/'],
  ['inbox', '/inbox/'],
  ['inbox-them', '/inbox/them/?url=https://example.com&title=Example'],
  ['thu-vien', '/thu-vien/'],
  ['thu-vien-bang', '/thu-vien/?view=board'],
  ['thu-vien-ghi-chu', '/thu-vien/ghi-chu/'],
  ['phat-trien', '/phat-trien/'],
  ['phat-trien-ky-nang', '/phat-trien/ky-nang/'],
  ['phat-trien-cong-cu', '/phat-trien/cong-cu/'],
  ['phat-trien-thi-truong', '/phat-trien/thi-truong/'],
  ['phat-trien-thanh-tuu', '/phat-trien/thanh-tuu/'],
  ['tuan', '/tuan/'], // opens Kế hoạch, the same view as ?tab=ke-hoach
  ['tuan-ke-hoach', '/tuan/?tab=ke-hoach'],
  ['tuan-nhin-lai', '/tuan/?tab=nhin-lai'],
  ['co-hoi', '/co-hoi/'],
  ['cong-viec', '/cong-viec/'],
  ['cong-viec-bang', '/cong-viec/?view=board'],
  ['cong-viec-gio', '/cong-viec/gio/'],
  ['gioi-thieu', '/gioi-thieu/'],
  ['huong-dan', '/huong-dan/'],
  ['lo-trinh', '/lo-trinh/'],
  ...(LESSON ? [['docs-lesson', LESSON]] : []),
  ['search', '/', { search: SEARCH_QUERY }],
];

const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
];
const THEMES = ['light', 'dark'];

function parseArgs(argv) {
  const args = { base: 'http://127.0.0.1:8080', out: null, only: null, workers: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') args.base = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--only') args.only = new Set(argv[++i].split(','));
    else if (a === '--workers') args.workers = Math.max(1, Number(argv[++i]) || 1);
    else if (a === '--help' || a === '-h') {
      console.log('usage: node web/scripts/screens.mjs --base <origin> --out <dir> [--only slug,slug] [--workers n]');
      process.exit(0);
    } else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  if (!args.out) {
    console.error('--out <dir> is required');
    process.exit(2);
  }
  args.base = args.base.replace(/\/$/, '');
  return args;
}

/** Waits until client data has loaded: no busy regions, no skeletons, fonts ready. */
async function waitForData(page, timeout = 15_000) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  const settled = await page
    .waitForFunction(
      () => !document.querySelector('[aria-busy="true"], [data-slot="skeleton"]'),
      undefined,
      { timeout, polling: 200 },
    )
    .then(() => true)
    .catch(() => false);
  await page.evaluate(() => document.fonts.ready);
  return settled;
}

/**
 * Hides the Next dev overlay (`next dev` only; the badge and issue pill would sit over the sidebar) and returns
 * the number of issues it reported, so a hidden error still shows up as a warning.
 */
async function hideDevOverlay(page) {
  return page
    .evaluate(() => {
      const portal = document.querySelector('nextjs-portal');
      if (!portal) return 0;
      // the issue pill is always in the shadow DOM; it has a size only while it shows issues
      const pill = portal.shadowRoot?.querySelector('[data-issues]');
      const issues = pill && pill.getBoundingClientRect().width > 0 ? 1 : 0;
      for (const el of document.querySelectorAll('nextjs-portal')) el.style.setProperty('display', 'none', 'important');
      return issues;
    })
    .catch(() => 0);
}

/** Scrolls through the page so lazy images and on-view guides load, then back to the top. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
}

async function shoot(browser, base, outDir, job) {
  const { slug, url, opts, viewport, theme } = job;
  const file = `${slug}--${viewport.width}--${theme}.png`;
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'vi-VN',
    timezoneId: 'Europe/Prague',
    colorScheme: theme,
    reducedMotion: 'reduce',
    isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600,
  });
  // next-themes reads localStorage 'theme' before hydration; set it before any page script runs.
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {}
  }, theme);

  const blocked = [];
  const failed = [];
  await context.route('**/api/**', (route) => {
    const r = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(r.method())) return route.continue();
    blocked.push(`${r.method()} ${new URL(r.url()).pathname}`);
    return route.abort();
  });

  const page = await context.newPage();
  page.on('response', (r) => {
    if (r.status() >= 500 && new URL(r.url()).origin === base) failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  const notes = [];
  try {
    const res = await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (!res || res.status() >= 400) notes.push(`HTTP ${res ? res.status() : 'no response'}`);
    if (!(await waitForData(page))) notes.push('still loading after 15 s');

    if (opts?.search) {
      await page.keyboard.press('ControlOrMeta+k');
      const input = page.getByRole('dialog').getByLabel('Tìm mọi thứ');
      await input.waitFor({ state: 'visible', timeout: 10_000 });
      const answered = page
        .waitForResponse(
          (r) => /^\/api\/search\/?$/.test(new URL(r.url()).pathname) && r.status() !== 308,
          { timeout: 15_000 },
        )
        .catch(() => notes.push('no /api/search answer'));
      await input.fill(opts.search);
      await answered;
      await waitForData(page, 10_000);
      await page.waitForTimeout(300);
      if (await hideDevOverlay(page)) notes.push('Next dev overlay reports issues');
      await page.screenshot({ path: path.join(outDir, file), animations: 'disabled' });
    } else {
      await scrollThrough(page);
      await waitForData(page, 5_000);
      const theClass = await page.evaluate(() => document.documentElement.className);
      if (/\bdark\b/.test(theClass) !== (theme === 'dark')) notes.push(`theme not applied (html class "${theClass}")`);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      if (scrollWidth > viewport.width) notes.push(`horizontal overflow: scrollWidth ${scrollWidth} > ${viewport.width}`);
      if (await hideDevOverlay(page)) notes.push('Next dev overlay reports issues');
      await page.screenshot({ path: path.join(outDir, file), fullPage: true, animations: 'disabled' });
    }
  } catch (err) {
    notes.push(`error: ${String(err.message || err).split('\n')[0]}`);
  } finally {
    await context.close();
  }
  if (failed.length) notes.push(`5xx: ${[...new Set(failed)].join(', ')}`);
  // Expected on lesson pages (PUT /api/progress/last-visited on visit): aborted so a shot never moves "Học tiếp".
  const info = blocked.length ? `blocked writes: ${[...new Set(blocked)].join(', ')}` : '';
  return { file, notes, info };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(args.out);
  mkdirSync(outDir, { recursive: true });

  const jobs = [];
  for (const [slug, url, opts] of PAGES) {
    if (args.only && !args.only.has(slug)) continue;
    for (const viewport of VIEWPORTS) for (const theme of THEMES) jobs.push({ slug, url, opts, viewport, theme });
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const r = await shoot(browser, args.base, outDir, job);
      results.push(r);
      const extra = [...r.notes, r.info].filter(Boolean).join('; ');
      console.log(`${r.notes.length ? 'WARN' : 'ok  '} ${r.file}${extra ? `  (${extra})` : ''}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(args.workers, jobs.length) }, worker));
  await browser.close();

  results.sort((a, b) => a.file.localeCompare(b.file));
  console.log(`\n${results.length} shots in ${outDir}:`);
  for (const r of results) console.log(path.join(outDir, r.file));
  const problems = results.filter((r) => r.notes.length);
  if (problems.length) {
    console.log(`\n${problems.length} with warnings:`);
    for (const r of problems) console.log(`  ${r.file}: ${r.notes.join('; ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
