// The window look: sizes, the title band, tabs, the bronze rim and the gold buttons.
const { test, expect, openApp, openQuest, openTab } = require('./support/app');

for (const width of [280, 360, 640, 1000]) {
  test('fits a ' + width + ' px window with no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await openApp(page, expect);
    const wide = () => page.evaluate(() => {
      const m = document.getElementById('main');
      return document.documentElement.scrollWidth > innerWidth || m.scrollWidth > m.clientWidth;
    });
    expect(await wide()).toBe(false);
    await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
    for (const t of ['overview', 'items', 'steps']) {
      await openTab(page, t);
      expect(await wide(), t).toBe(false);
    }
  });
}

test('the window is never wider than 640 px', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await openApp(page, expect);
  expect((await page.locator('#app').boundingBox()).width).toBe(640);
});

test('the quest name sits in the middle of the title band', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  const band = await page.locator('.hdr').boundingBox();
  const title = await page.locator('h1.qt').boundingBox();
  expect(Math.abs((title.x + title.width / 2) - (band.x + band.width / 2))).toBeLessThanOrEqual(2);
  await expect(page.locator('h1.qt')).toHaveCSS('text-align', 'center');
  expect(await page.locator('h1.qt').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Cinzel');
});

test('the open tab joins the panel below it', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'items');
  const bg = (sel) => page.locator(sel).evaluate((e) => getComputedStyle(e).backgroundColor);
  const panel = await bg('#main');
  expect(await bg('.tab[aria-selected="true"]')).toBe(panel);
  expect(await page.locator('.tab[aria-selected="true"]').evaluate((e) => getComputedStyle(e).borderBottomColor)).toBe(panel);
  expect(await page.locator('.tab[aria-selected="false"]').first().evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
});

test('a bronze rim around the window', async ({ page }) => {
  await openApp(page, expect);
  const rim = await page.locator('#app').evaluate((e) => getComputedStyle(e, '::after').boxShadow);
  expect(rim.match(/inset/g)).toHaveLength(5);
});

test('gold buttons for the main actions', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'steps');
  const next = page.locator('#next-btn');
  expect(await next.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
  expect(await next.evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Cinzel');
  await expect(page.locator('#next-btn .i')).toBeVisible();
});

test('pinch zoom is off for the page, so it stays put on phones', async ({ page }) => {
  await openApp(page, expect);
  await expect(page.locator('html')).toHaveCSS('touch-action', 'pan-x pan-y');
  const blocked = await page.evaluate(() => {
    const e = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(blocked).toBe(true);
});
