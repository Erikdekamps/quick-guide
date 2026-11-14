// Running inside the Alt1 Toolkit, and the files Alt1 needs to add the app.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT, openApp, openQuest } = require('./support/app');

// A stand-in for Alt1's window.alt1, recording what the app asks of it.
function fakeAlt1(page, broken) {
  return page.addInitScript((b) => {
    window.alt1Calls = [];
    window.alt1 = {
      identifyAppUrl(u) { window.alt1Calls.push(['identify', u]); if (b) throw new Error('nope'); },
      openBrowser(u) { window.alt1Calls.push(['open', u]); if (b) throw new Error('nope'); return true; }
    };
  }, !!broken);
}
const calls = (page) => page.evaluate(() => window.alt1Calls);

test('tells Alt1 where its app file is', async ({ page }) => {
  await fakeAlt1(page);
  await openApp(page, expect);
  expect(await calls(page)).toEqual([['identify', './appconfig.json']]);
  await expect(page.locator('a[href^="alt1://"]')).toHaveCount(0);
});

test('links open in your normal browser, and the app stays on the guide', async ({ page }) => {
  await fakeAlt1(page);
  await openQuest(page, expect, 'While Guthix Sleeps');
  let popups = 0;
  page.on('popup', () => popups++);
  await page.locator('[data-ov="details"] dd a', { hasText: 'Radimus Erkle' }).click();
  await page.locator('#menu-btn').click();
  await page.getByRole('menuitem', { name: 'Open on wiki' }).click();
  expect(await calls(page)).toEqual([
    ['identify', './appconfig.json'],
    ['open', 'https://runescape.wiki/w/Radimus_Erkle'],
    ['open', 'https://runescape.wiki/w/While_Guthix_Sleeps/Quick_guide']
  ]);
  expect(popups).toBe(0);
  expect(page.url()).toBe('http://quick-guide.test/');
  await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
});

test('the app keeps working if Alt1 throws', async ({ page }) => {
  await fakeAlt1(page, true);
  await openQuest(page, expect, 'While Guthix Sleeps');
  await page.locator('[data-ov="details"] dd a', { hasText: 'Radimus Erkle' }).click();
  await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
  expect(page.errors).toEqual([]);
});

test.describe('appconfig.json', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'appconfig.json'), 'utf8'));

  test('has what Alt1 needs, and the files it names exist', () => {
    for (const k of ['appName', 'description', 'appUrl', 'configUrl', 'iconUrl']) expect(typeof cfg[k]).toBe('string');
    expect(cfg.configUrl).toBe('./appconfig.json');
    for (const k of ['appUrl', 'configUrl', 'iconUrl']) expect(fs.existsSync(path.join(ROOT, cfg[k]))).toBe(true);
    const png = fs.readFileSync(path.join(ROOT, cfg.iconUrl));
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });

  test('sizes make sense, and permissions are a real Alt1 name, never empty', () => {
    expect(cfg.minWidth).toBeLessThanOrEqual(cfg.defaultWidth);
    expect(cfg.defaultWidth).toBeLessThanOrEqual(cfg.maxWidth);
    expect(cfg.minHeight).toBeLessThanOrEqual(cfg.defaultHeight);
    expect(cfg.defaultHeight).toBeLessThanOrEqual(cfg.maxHeight);
    // Alt1 apps in the wild never leave this empty; an empty value may stop Alt1 from adding the app.
    expect(cfg.permissions).not.toBe('');
    for (const p of cfg.permissions.split(',')) expect(['pixel', 'overlay', 'gamestate']).toContain(p);
    expect(cfg.permissions).not.toContain('pixel');   // the app never reads the screen
  });
});
