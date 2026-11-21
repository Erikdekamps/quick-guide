// Starting the app: missing files, the version, and a clean run. (What index.html loads: tests/unit/code.spec.js.)
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT, WIKI_FILES, openApp, openQuest, openTab, choose, openSettings } = require('./support/app');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
// The files of the app, in the order index.html loads them.
const appFiles = [...html.matchAll(/<script src="(js\/app\/[^"?]+)/g)].map((m) => m[1]);

test.describe('a file that does not load', () => {
  // Any one file of the wiki reader missing: the app says which, and does not start.
  for (const file of WIKI_FILES.map((f) => f.split('/').pop())) {
    test(file + ': the app says so', async ({ page }) => {
      await page.route('**/js/wiki/' + file + '?*', (r) => r.abort());
      await page.goto('/');
      await expect(page.locator('#app')).toHaveText('The app could not start: ' + file + ' is missing. Upload all the files again, then reload.');
    });
  }

  // Any one file of the app missing (core.js first, main.js last), the page says which, and nothing half-works under it.
  for (const file of appFiles) {
    test(file + ': the page says so', async ({ page }) => {
      await page.route('**/' + file + '?*', (r) => r.abort());
      await page.clock.install();
      await page.goto('/');
      await expect(page.locator('#app')).toHaveText(new RegExp('^The app could not start\\. This file did not load: http://quick-guide\\.test/' + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=[\\d.]+ Upload all the files again, then reload\\.$'));
      // Later too: nothing the app set a timer for draws a screen.
      await page.clock.runFor(5000);
      await expect(page.locator('#app .hdr')).toHaveCount(0);
    });
  }

  test('the map library: only maps are missing', async ({ page }) => {
    await page.route('**/leaflet.js?*', (r) => r.abort());
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'steps');
    const box = page.locator('details.acc', { hasText: 'Map: Location of the Khazard launderer' });
    await box.locator('.map').scrollIntoViewIfNeeded();
    await expect(box.locator('.map')).toHaveText('The map could not load. Use the wiki link below.');
  });
});

test('Settings ends with the version', async ({ page }) => {
  await openApp(page, expect);
  await openSettings(page);
  await expect(page.locator('#settings > :last-child')).toHaveText('Quick Guide ' + version);
});

test('without a cache number on core.js, Settings shows no version', async ({ page }) => {
  const plain = html.replace('js/app/core.js?v=', 'js/app/core.js?x=');
  await page.route('http://quick-guide.test/', (r) => r.fulfill({ body: plain, contentType: 'text/html; charset=utf-8' }));
  await openApp(page, expect);
  await openSettings(page);
  await expect(page.locator('#settings > :last-child')).toHaveText('Delete everything');
  await expect(page.locator('#settings .ver')).toHaveCount(0);
});

test('a normal session has no errors', async ({ page }) => {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  await openApp(page, expect);
  await choose(page, '#sort', 'dif');
  await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
  for (const t of ['items', 'steps', 'overview']) await openTab(page, t);
  await page.getByRole('button', { name: 'All quests' }).click();
  expect(page.errors).toEqual([]);
  expect(problems).toEqual([]);
});

test("the fonts are the app's own: it draws with no font service, and uses them", async ({ page }) => {
  const asked = [];
  page.on('request', (r) => { if (!r.url().startsWith('http://quick-guide.test/') && /font/.test(r.url())) asked.push(r.url()); });
  await openApp(page, expect);
  await page.evaluate(() => document.fonts.ready);
  expect(asked).toEqual([]);
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '') + ' ' + f.weight));
  expect(loaded).toEqual(expect.arrayContaining(['Cinzel 700', 'Fira Sans 400']));
  expect(await page.locator('h1.qt').evaluate((h) => getComputedStyle(h).fontFamily)).toMatch(/^"?Cinzel/);
});
