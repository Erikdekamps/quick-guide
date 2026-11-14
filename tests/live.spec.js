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
  // boxes start open, so the map starts by itself
  await expect(map.locator('.leaflet-container')).toBeVisible();
  await expect.poll(() => ok.length, { timeout: 30000 }).toBeGreaterThan(0);
});

test('the optimal order is read from the wiki and matches the quest list', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#qcount')).toHaveText(/^\d+ quests$/);
  // The guide is about quests, so leave the miniquests out.
  await page.locator('#cog-btn').click();
  await page.locator('#kind').selectOption('quest');
  await page.locator('#sort').selectOption('opt');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ghb[data-group="Optimal order"]')).toBeVisible();
  const inGuide = parseInt(await page.locator('.ghb[data-group="Optimal order"] .c').textContent(), 10);
  const total = parseInt(await page.locator('#qcount').textContent(), 10);
  expect(inGuide).toBeGreaterThan(total * 0.8);
  await expect(page.locator('.q .q2').first()).toContainText('#1');
});

test('miniquests are read from the wiki, from the main table only', async ({ page }) => {
  await page.goto('/__blank');
  await page.addScriptTag({ url: '/quests.js' });
  const l = await page.evaluate(() => window.QuickGuideData.loadMinis());
  expect(l.quests.length).toBeGreaterThan(40);
  expect(l.quests.length).toBeLessThan(80);
  const bar = l.quests.find((q) => q.t === 'Bar Crawl (miniquest)');
  expect(bar).toMatchObject({ mini: true, m: true });
  expect(bar.dif).toBeTruthy();
  // the "one-off content" table is left out
  expect(l.quests.find((q) => q.t === 'Ali the Trader')).toBeUndefined();
});

test('League rows show region names', async ({ page }) => {
  await page.goto('/__blank');
  await page.addScriptTag({ url: '/parser.js' });
  const q = await page.evaluate(() => window.QuickGuide.load({ title: 'While Guthix Sleeps/Quick guide', base: 'While Guthix Sleeps' }));
  const row = q.overview.extra.find((x) => /league region/i.test(x.label));
  // If the wiki drops the League rows, there is nothing to check.
  if (row) {
    expect(row.html).toMatch(/^(<span class="reg">[A-Z][a-z]+<\/span> ?)+$/);
  }
});
