// Checks against the real RuneScape Wiki, so we notice when the wiki changes in a way that breaks the app.
// They need the internet. Run them with: npm run test:live
// (GitHub runs them once a week. The normal tests use a fake wiki and never go online.)
const base = require('@playwright/test');
const { ORIGIN, serveFile } = require('./support/app');

const test = base.test.extend({
  context: async ({ context }, use) => {
    await context.route(ORIGIN + '/**', (route) => serveFile(route));
    await use(context);
  }
});
const { expect } = base;

test('the quest list is read from the wiki', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#qcount')).toHaveText(/^\d+ quests$/);
  const n = parseInt(await page.locator('#qcount').textContent(), 10);
  expect(n).toBeGreaterThan(150);
  const cook = page.locator(".q[data-quest=\"Cook's Assistant\"]");
  await expect(cook).toBeVisible();
  await expect(cook.locator('.q2')).toContainText('Novice');
});

test("Cook's Assistant opens, with details, items and steps", async ({ page }) => {
  await page.goto('/');
  await page.locator(".q[data-quest=\"Cook's Assistant\"]").click();
  await expect(page.locator('h1.qt')).toHaveText("Cook's Assistant");
  await expect(page.locator('[data-ov="details"] .kv dt').first()).toHaveText('Start');
  await page.locator('.tab[data-tab="items"]').click();
  expect(await page.locator('#main li[data-item]').count()).toBeGreaterThan(0);
  await page.locator('.tab[data-tab="steps"]').click();
  expect(await page.locator('section.sec').count()).toBeGreaterThan(0);
  expect(await page.locator('li[data-step]').count()).toBeGreaterThan(2);
});

test('a long guide still reads well', async ({ page }) => {
  await page.goto('/');
  const q = await page.evaluate(() => window.QuickGuide.load({ title: 'While Guthix Sleeps/Quick guide', base: 'While Guthix Sleeps' }));
  const blocks = q.sections.flatMap((s) => s.blocks);
  const stepList = blocks.filter((b) => b.type === 'step');
  expect(q.notQuickGuide).toBe(false);
  expect(q.overview.startPoint).not.toBe('');
  expect(q.overview.skillReqs.length).toBeGreaterThan(4);
  expect(q.overview.questReqs.length).toBeGreaterThan(4);
  expect(q.requiredItems.items.length).toBeGreaterThan(4);
  expect(q.sections.length).toBeGreaterThan(4);
  expect(stepList.length).toBeGreaterThan(40);
  expect(stepList.some((s) => s.dialogue.length > 0)).toBe(true);
  expect(blocks.some((b) => b.type === 'bring') || stepList.some((s) => s.images.length > 0)).toBe(true);
  expect(q.rewards.items.length).toBeGreaterThan(2);
});

test('wiki map tiles load', async ({ page }) => {
  const ok = [];
  page.on('response', (r) => { if (/maps\.runescape\.wiki\/.+\.png/.test(r.url()) && r.status() === 200) ok.push(r.url()); });
  await page.goto('/');
  await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
  await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
  const map = page.locator('[data-ov="details"] details.acc', { hasText: 'Map' }).first();
  await map.locator('summary').click();
  await expect(map.locator('.leaflet-container')).toBeVisible();
  await expect.poll(() => ok.length, { timeout: 30000 }).toBeGreaterThan(0);
});
