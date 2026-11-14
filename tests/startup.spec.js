// Starting the app: missing files, the cache numbers in index.html, and a clean run.
const fs = require('fs');
const path = require('path');
const { test, expect, ROOT, openApp, openQuest, openTab, part } = require('./support/app');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

test.describe('a file that does not load', () => {
  for (const [file, message] of [
    ['parser.js', 'The app could not start: parser.js is missing. Upload all the files again, then reload.'],
    ['quests.js', 'The app could not start: quests.js is missing. Upload all the files again, then reload.']
  ]) {
    test(file + ': the app says so', async ({ page }) => {
      await page.route('**/' + file + '?*', (r) => r.abort());
      await page.goto('/');
      await expect(page.locator('#app')).toHaveText(message);
    });
  }

  test('app.js: the page says so', async ({ page }) => {
    await page.route('**/app.js?*', (r) => r.abort());
    await page.goto('/');
    await expect(page.locator('#app')).toHaveText(/^The app could not start\. This file did not load: http:\/\/quick-guide\.test\/app\.js\?v=[\d.]+ Upload all the files again, then reload\.$/);
  });

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
});

test('a normal session has no errors', async ({ page }) => {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  await openApp(page, expect);
  await page.locator('#sort').selectOption('dif');
  await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
  for (const t of ['items', 'steps', 'overview']) await openTab(page, t);
  await page.getByRole('button', { name: 'All quests' }).click();
  expect(page.errors).toEqual([]);
  expect(problems).toEqual([]);
});
