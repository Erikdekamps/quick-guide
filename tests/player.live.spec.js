// Player lookup against the real wiki. Needs the internet: npm run test:live
// The wiki passes on Jagex's quest and level data, and lets any web page read it.
// (Tried and dropped: WikiSync and Jagex's own servers do not answer a page on GitHub Pages.)
const base = require('@playwright/test');
const { ORIGIN, serveFile } = require('./support/app');

const test = base.test.extend({
  context: async ({ context }, use) => {
    await context.route(ORIGIN + '/**', (route) => serveFile(route));
    await use(context);
  }
});
const { expect } = base;
// A well-known public character.
const NAME = 'Zezima';

test('the wiki passes on quests and levels to any web page', async ({ page }) => {
  await page.goto('/');
  const p = await page.evaluate((n) => window.QuickGuide.loadPlayer(n), NAME);
  expect(Object.keys(p.quests).length).toBeGreaterThan(150);
  expect(p.done).toBeGreaterThan(50);
  expect(p.levels.magic).toBeGreaterThan(1);
  expect(Object.keys(p.levels).length).toBeGreaterThan(20);
});

test('looking up a player marks quests in the list', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#qcount')).toHaveText(/^\d+ quests$/);
  await page.locator('#player-name').fill(NAME);
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.locator('#player')).toContainText(/\d+ quests done/);
  // the game's quest names match the wiki's list names for most quests
  const total = await page.locator('.q').count();
  const done = await page.locator('.q.done').count();
  expect(done).toBeGreaterThan(total * 0.5);
  await expect(page.locator(".q[data-quest=\"Cook's Assistant\"]")).toHaveClass(/\bdone\b/);
});
