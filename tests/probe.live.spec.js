// Temporary: uses the real web version in Firefox and WebKit (Safari), to find what goes wrong there. Remove before the PR.
const base = require('@playwright/test');
const { execSync } = require('child_process');
const pw = require('playwright');
const test = base.test;
const SITE = 'https://erikdekamps.github.io/quick-guide/';

test('probe: firefox and webkit', async () => {
  test.setTimeout(600000);
  try { execSync('npx playwright install --with-deps firefox webkit', { stdio: 'pipe', timeout: 400000 }); } catch (e) { console.log('PROBE install failed', String(e.stdout || e).slice(-500)); }
  for (const name of ['firefox', 'webkit']) {
    let b;
    try { b = await pw[name].launch(); } catch (e) { console.log('PROBE', name, 'launch failed', e.message.slice(0, 300)); continue; }
    const page = await b.newPage();
    const log = [];
    page.on('pageerror', (e) => log.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
    page.on('console', (m) => { if (m.type() === 'error') log.push('CONSOLE ' + m.text()); });
    page.on('requestfailed', (r) => log.push('REQFAIL ' + r.url().slice(0, 140) + ' ' + (r.failure() && r.failure().errorText)));
    const st = async (tag) => {
      const s = await page.evaluate(() => ({ title: (document.querySelector('h1.qt') || {}).textContent, err: (document.querySelector('#load-err') || {}).textContent,
        state: (document.querySelector('.state') || {}).textContent, qcount: (document.querySelector('#qcount') || {}).textContent,
        tasks: document.querySelectorAll('li[data-task]').length, rows: document.querySelectorAll('.q').length })).catch((e) => ({ evalErr: e.message }));
      console.log('PROBE', name, tag, JSON.stringify(s));
      log.splice(0).forEach((l) => console.log('PROBE', name, tag, l));
    };
    try {
      await page.goto(SITE); await page.waitForTimeout(4000); await st('start');
      await page.locator('.tab[data-home="areas"]').click(); await page.waitForTimeout(1000); await st('areas');
      await page.locator('.q[data-area="Ardougne"]').first().click(); await page.waitForTimeout(8000); await st('ardougne');
      await page.locator('.tab[data-tier="medium"]').click().catch(() => {}); await page.waitForTimeout(500); await st('medium');
      await page.locator('[data-act="change"]').click().catch(() => {}); await page.waitForTimeout(500);
      await page.locator('#quest-link').fill('yoink'); await page.waitForTimeout(20000); await st('search');
      await page.locator('#quest-link').fill(''); await page.waitForTimeout(300);
      await page.locator('.tab[data-home="quests"]').click(); await page.waitForTimeout(500);
      await page.locator('.q[data-quest="Cook\'s Assistant"]').click(); await page.waitForTimeout(5000); await st('cook');
      await page.locator('#cog-btn').click(); await page.getByRole('button', { name: 'Export state' }).click(); await page.waitForTimeout(8000);
      console.log('PROBE', name, 'export length', (await page.locator('#bk-text').inputValue().catch(() => '')).length);
      await st('export');
    } catch (e) { console.log('PROBE', name, 'STEP FAILED', e.message.slice(0, 300)); await st('fail'); }
    await b.close();
  }
});
