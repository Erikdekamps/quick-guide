// Starting the app: missing files, the cache numbers in index.html, the version, and a clean run.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT, openApp, openQuest, openTab, choose, openSettings } = require('./support/app');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
// The files of the app, in the order index.html loads them.
const appFiles = [...html.matchAll(/<script src="(js\/app\/[^"?]+)/g)].map((m) => m[1]);

test.describe('a file that does not load', () => {
  for (const [file, message] of [
    ['parser.js', 'The app could not start: parser.js is missing. Upload all the files again, then reload.'],
    ['quests.js', 'The app could not start: quests.js is missing. Upload all the files again, then reload.']
  ]) {
    test(file + ': the app says so', async ({ page }) => {
      await page.route('**/js/wiki/' + file + '?*', (r) => r.abort());
      await page.goto('/');
      await expect(page.locator('#app')).toHaveText(message);
    });
  }

  // Any one file of the app missing (core.js first, main.js last), the page says which, and nothing half-works under it.
  for (const file of appFiles) {
    test(file + ': the page says so', async ({ page }) => {
      await page.route('**/' + file + '?*', (r) => r.abort());
      await page.goto('/');
      await expect(page.locator('#app')).toHaveText(new RegExp('^The app could not start\\. This file did not load: http://quick-guide\\.test/' + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=[\\d.]+ Upload all the files again, then reload\\.$'));
      await page.waitForTimeout(300);
      await expect(page.locator('#app .hdr')).toHaveCount(0);
    });
  }

  test('the map library: only maps are missing', async ({ page }) => {
    await page.route('**/leaflet.js?*', (r) => r.abort());
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'steps');
    const box = page.locator('details.acc', { hasText: 'Map: Location of the Khazard launderer' });
    await expect(box.locator('.map')).toHaveText('The map could not load. Use the wiki link below.');
  });
});

test.describe('index.html', () => {
  const local = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:)?\/\//.test(u));

  test('every file it names exists', () => {
    expect(local.length).toBeGreaterThanOrEqual(6);
    for (const u of local) expect(fs.existsSync(path.join(ROOT, u.split('?')[0])), u).toBe(true);
  });

  test('scripts and styles share one cache number, so Alt1 loads new copies together', () => {
    const versions = local.filter((u) => /\.(js|css)(\?|$)/.test(u)).map((u) => (u.split('?v=')[1] || ''));
    expect(versions.length).toBeGreaterThanOrEqual(5);
    expect(versions.every((v) => /^\d+\.\d+\.\d+$/.test(v))).toBe(true);
    expect(new Set(versions).size).toBe(1);
  });

  test('the cache number is the version in package.json', () => {
    expect([...new Set(html.match(/\?v=[^"]+/g))]).toEqual(['?v=' + version]);
  });
});

test('Settings ends with the version, and a link to what changed', async ({ page }) => {
  await openApp(page, expect);
  await openSettings(page);
  const ver = page.locator('#settings > :last-child');
  await expect(ver).toHaveText('Quick Guide ' + version + ' \u00b7 What\u2019s new');
  await expect(ver.getByRole('link', { name: 'What\u2019s new' })).toHaveAttribute('href', 'https://github.com/Erikdekamps/quick-guide/blob/main/CHANGELOG.md');
  await expect(ver.getByRole('link')).toHaveAttribute('target', '_blank');
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
