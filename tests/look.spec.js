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

// Like the game's Hero window (Hero > Achievements).
test('like the game: the name on the left of the title band, in gold capitals, after the back button', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  const back = await page.locator('.hdr [data-act="change"]').boundingBox();
  const title = await page.locator('h1.qt').boundingBox();
  expect(title.x - (back.x + back.width)).toBeGreaterThanOrEqual(4);
  expect(title.x - (back.x + back.width)).toBeLessThanOrEqual(12);
  await expect(page.locator('h1.qt')).toHaveCSS('text-align', 'left');
  await expect(page.locator('h1.qt')).toHaveCSS('color', 'rgb(227, 195, 155)');
  expect(await page.locator('h1.qt').evaluate((e) => getComputedStyle(e).fontFamily)).toContain('Cinzel');
});

test('like the game: the start screen has the app emblem on the left of its name', async ({ page }) => {
  await openApp(page, expect);
  const emb = page.locator('.hdr img.emb');
  await expect(emb).toBeVisible();
  await expect(emb).toHaveAttribute('src', 'icon.png');
  const e = await emb.boundingBox(), t = await page.locator('h1.qt').boundingBox();
  expect(t.x).toBeGreaterThan(e.x + e.width);
  await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
});

test('like the game: square buttons with a bronze edge and a gold sign', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  const btn = page.locator('#cog-btn');
  await expect(btn).toHaveCSS('width', '28px');
  await expect(btn).toHaveCSS('border-top-color', 'rgb(130, 118, 96)');
  await expect(btn).toHaveCSS('color', 'rgb(200, 176, 132)');
  expect(await btn.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
});

test('like the game: the tabs sit on a bronze line, and the open one is lit in warm brown', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'items');
  const on = page.locator('.tab[aria-selected="true"]'), off = page.locator('.tab[aria-selected="false"]').first();
  const img = (l) => l.evaluate((e) => getComputedStyle(e).backgroundImage);
  expect(await img(on)).toContain('linear-gradient');
  expect(await img(off)).toContain('linear-gradient');
  expect(await img(on)).not.toBe(await img(off));
  await expect(on).toHaveCSS('color', 'rgb(240, 232, 220)');
  await expect(off).toHaveCSS('color', 'rgb(155, 147, 143)');
  // all the same height, on the line: the open one does not join the panel
  expect((await on.boundingBox()).height).toBe((await off.boundingBox()).height);
  await expect(page.locator('#main')).toHaveCSS('border-top-color', 'rgb(109, 94, 74)');
});

test('like the game: the panel is a warm dark grey, and tick boxes have a bronze edge and a gold tick', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'items');
  await expect(page.locator('#main')).toHaveCSS('background-color', 'rgb(37, 33, 30)');
  const cb = page.locator('.cb').first();
  await expect(cb).toHaveCSS('border-top-color', 'rgb(110, 96, 74)');
  expect(await cb.evaluate((e) => getComputedStyle(e, '::before').borderRightColor)).toBe('rgb(223, 190, 137)');
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
