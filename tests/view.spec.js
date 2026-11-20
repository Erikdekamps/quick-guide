// The view is kept across a reload: the screen and its tab, where each list is scrolled, the search text, and the
// groups you folded. Each tab keeps its own place.
const { test, expect, openApp, openQuest, openTab, withAllAreas, stored } = require('./support/app');

async function reload(page) {
  await page.reload();
  await expect(page.locator('#main')).toBeVisible();
}
const scrollTo = (page, y) => page.locator('#main').evaluate((m, v) => { m.scrollTop = v; m.dispatchEvent(new Event('scroll')); }, y);
const scrolled = (page) => page.locator('#main').evaluate((m) => m.scrollTop);
// The view is saved a moment after the last change: wait until what is saved is what the app has now. (Something
// saved is not enough: an earlier change may be saved while the last one still waits.)
const saved = (page) => expect.poll(() => page.evaluate(() => {
  const v = JSON.parse(localStorage.getItem('qg1.view') || 'null'), S = window.QuickGuideApp.S;
  return !!v && JSON.stringify([v.input, v.closed, v.scroll]) === JSON.stringify([S.input, S.closed, S.scroll]);
})).toBe(true);

test.describe('a reload keeps the view', () => {
  test('the start screen: its tab, the search text, folded groups and where the list is scrolled', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await scrollTo(page, 120);
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.ghb').first().click();
    await expect(page.locator('.ghb').first()).toHaveAttribute('aria-expanded', 'false');
    await scrollTo(page, 80);
    await saved(page);
    await reload(page);
    await expect(page.locator('.bn[data-home="areas"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.ghb').first()).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => scrolled(page)).toBe(80);
    // the other tab kept its own place
    await page.locator('.bn[data-home="quests"]').click();
    await expect.poll(() => scrolled(page)).toBe(120);
    // the search text
    await page.locator('#quest-link').fill('guthix');
    await expect.poll(async () => (await stored(page, 'view')).input).toBe('guthix');
    await reload(page);
    await expect(page.locator('#quest-link')).toHaveValue('guthix');
    await expect(page.locator('.q')).toHaveCount(1);
  });

  test('a quest: its tab, and each tab where you left it', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 500 });
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'overview');
    await scrollTo(page, 300);
    await openTab(page, 'steps');
    await scrollTo(page, 500);
    await openTab(page, 'overview');
    await expect.poll(() => scrolled(page)).toBe(300);
    await openTab(page, 'steps');
    await expect.poll(() => scrolled(page)).toBe(500);
    await saved(page);
    await reload(page);
    await expect(page.locator('.tab[data-tab="steps"]')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => scrolled(page)).toBe(500);
    await openTab(page, 'overview');
    await expect.poll(() => scrolled(page)).toBe(300);
  });

  test('an area: its tier, and each tier where you left it', async ({ page, wiki }) => {
    await page.setViewportSize({ width: 360, height: 500 });
    withAllAreas(wiki);
    await openApp(page, expect);
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await scrollTo(page, 250);
    await page.locator('.tab[data-tier="hard"]').click();
    await expect.poll(() => scrolled(page)).toBe(0);
    await scrollTo(page, 150);
    await saved(page);
    await reload(page);
    await expect(page.locator('.tab[data-tier="hard"]')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => scrolled(page)).toBe(150);
    await page.locator('.tab[data-tier="easy"]').click();
    await expect.poll(() => scrolled(page)).toBe(250);
    // ticking a task keeps the place (clicked in the page: Playwright would scroll the box into view first)
    const box = page.locator('#main input[data-acb]').nth(3);
    await box.evaluate((e) => e.click());
    await expect(box).toBeChecked();
    expect(await scrolled(page)).toBe(250);
  });

  test('back on the list, a reload stays on the list', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.getByRole('button', { name: 'All quests' }).click();
    await expect(page.locator('#qcount')).toBeVisible();
    await reload(page);
    await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
    await expect(page.locator('#qcount')).toBeVisible();
  });

  test('a quest opened for the first time starts at the next step', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'steps');
    await expect(page.locator('li.step.cur').first()).toBeInViewport();
  });
});
