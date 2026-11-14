// Temporary: uses the real web version on GitHub Pages, to find what goes wrong there. Remove before the PR.
const base = require('@playwright/test');
const test = base.test;
const { expect } = base;
const SITE = 'https://erikdekamps.github.io/quick-guide/';

function watch(page) {
  const log = [];
  page.on('pageerror', (e) => log.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push('CONSOLE ' + m.type() + ' ' + m.text()); });
  page.on('requestfailed', (r) => log.push('REQFAIL ' + r.url().slice(0, 160) + ' ' + (r.failure() && r.failure().errorText)));
  page.on('response', (r) => { if (r.status() >= 400) log.push('HTTP ' + r.status() + ' ' + r.url().slice(0, 160)); });
  return log;
}
async function dump(page, log, tag) {
  const st = await page.evaluate(() => ({
    title: (document.querySelector('h1.qt') || {}).textContent, err: (document.querySelector('#load-err') || {}).textContent,
    state: (document.querySelector('.state') || {}).textContent, qcount: (document.querySelector('#qcount') || {}).textContent,
    scripts: [...document.scripts].map((s) => s.src.split('/').pop()), keys: Object.keys(localStorage).filter((k) => k.startsWith('qg1.')).map((k) => k + ':' + localStorage.getItem(k).length)
  }));
  console.log('PROBE', tag, JSON.stringify(st));
  log.splice(0).forEach((l) => console.log('PROBE', tag, l));
}

test('probe: the web version, areas', async ({ page }) => {
  test.setTimeout(120000);
  const log = watch(page);
  await page.goto(SITE);
  await page.waitForTimeout(3000);
  await dump(page, log, 'start');
  await page.locator('.tab[data-home="areas"]').click();
  await page.waitForTimeout(1000);
  await dump(page, log, 'areas-tab');
  await page.locator('.q[data-area="Ardougne"]').first().click();
  await page.waitForTimeout(8000);
  await dump(page, log, 'open-ardougne');
  await page.screenshot({ path: 'test-results/probe-ardougne.png' });
  if (await page.locator('[data-act="change"]').count()) await page.locator('[data-act="change"]').click();
  await page.waitForTimeout(500);
  await page.locator('#quest-link').fill('yoink');
  await page.waitForTimeout(15000);
  await dump(page, log, 'search');
  const sizes = await page.evaluate(() => { let t = 0; for (const k of Object.keys(localStorage)) t += localStorage.getItem(k).length; return t; });
  console.log('PROBE storage chars', sizes);
});

test('probe: the web version, quests and export', async ({ page }) => {
  test.setTimeout(120000);
  const log = watch(page);
  await page.goto(SITE);
  await page.waitForTimeout(3000);
  await page.locator('.q[data-quest="Cook\'s Assistant"]').click();
  await page.waitForTimeout(5000);
  await dump(page, log, 'open-cook');
  for (const t of ['items', 'steps', 'overview']) { const b = page.locator('.tab[data-tab="' + t + '"]'); if (await b.count()) await b.click(); }
  await dump(page, log, 'tabs');
  await page.locator('#cog-btn').click();
  await page.getByRole('button', { name: 'Export state' }).click();
  await page.waitForTimeout(20000);
  const v = await page.locator('#bk-text').inputValue().catch(() => '');
  console.log('PROBE export length', v.length, (await page.locator('#bk-note').textContent().catch(() => '')));
  await dump(page, log, 'export');
});
