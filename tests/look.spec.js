// The window look: sizes, the title band, tabs, the bronze rim and the gold buttons.
const { test, expect, openApp, openQuest, openTab, openCog, choose, seed, stored } = require('./support/app');

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
test('like the game: in the title band, the quest\'s name on the left in gold capitals, after the back button', async ({ page }) => {
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
  await expect(emb).toHaveAttribute('src', 'icon.svg');
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
  const on = page.locator('.tab[data-tab][aria-selected="true"]'), off = page.locator('.tab[data-tab][aria-selected="false"]').first();
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

// The blue interface skin, the game's look before the brown one: a setting, kept after a reload.
test.describe('theme', () => {
  const shade = (page, sel, prop) => page.locator(sel).first().evaluate((e, p) => getComputedStyle(e)[p], prop);
  // Blue is cool: more blue than red.
  const cool = (rgb) => { const [r, , b] = rgb.match(/\d+/g).map(Number); return b > r; };

  test('brown at first; Blue turns the whole window blue, and it stays after a reload', async ({ page }) => {
    await openApp(page, expect);
    await openCog(page);
    await expect(page.locator('#theme')).toHaveValue('brown');
    await expect(page.locator('#theme option')).toHaveText(['Brown', 'Blue']);
    expect(cool(await shade(page, '#main', 'backgroundColor'))).toBe(false);
    await choose(page, '#theme', 'blue');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'blue');
    for (const [sel, prop] of [['#main', 'backgroundColor'], ['.hdr', 'borderBottomColor'], ['#cog-btn', 'borderTopColor'], ['.bnav', 'borderTopColor'], ['.bn[aria-current="page"]', 'color'], ['h1.qt', 'color']]) {
      expect(cool(await shade(page, sel, prop)), sel + ' ' + prop).toBe(true);
    }
    // what the game shows in colour keeps its colour: done is green
    expect((await stored(page, 'settings')).theme).toBe('blue');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'blue');
    await openCog(page);
    await expect(page.locator('#theme')).toHaveValue('blue');
    await choose(page, '#theme', 'brown');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'brown');
    expect(cool(await shade(page, '#main', 'backgroundColor'))).toBe(false);
  });

  test('a quest and an area look blue too, and done stays green', async ({ page, wiki }) => {
    await seed(page, { settings: { theme: 'blue' } });
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'steps');
    expect(cool(await shade(page, '.cb', 'borderTopColor'))).toBe(true);
    expect(cool(await shade(page, '.tab[aria-selected="true"]', 'borderTopColor'))).toBe(true);
    expect(cool(await shade(page, '.btn', 'backgroundColor') === 'rgba(0, 0, 0, 0)' ? await shade(page, '.btn', 'borderTopColor') : await shade(page, '.btn', 'backgroundColor'))).toBe(true);
    await page.getByRole('button', { name: 'All quests' }).click();
    await page.locator('.bn[data-home="areas"]').click();
    expect(cool(await shade(page, '.ghb', 'borderTopColor'))).toBe(true);
    await expect(page.locator('.mk.ok').first().or(page.locator('#main'))).toBeVisible();
  });

  test('a saved theme the app does not know is brown', async ({ page }) => {
    await seed(page, { settings: { theme: 'pink' } });
    await openApp(page, expect);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'brown');   // only themes the app knows
  });
});
