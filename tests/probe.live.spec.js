// Temporary: what the wiki sends to a phone. Remove before the PR.
const base = require('@playwright/test');
const test = base.test;
test.use({ ...base.devices['iPhone 13'], browserName: 'chromium' });
test('probe: the wiki on a phone', async ({ page }) => {
  test.setTimeout(120000);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('https://erikdekamps.github.io/quick-guide/');
  await page.waitForTimeout(3000);
  const r = await page.evaluate(async () => {
    const u = 'https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text%7Cjsconfigvars&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=Ardougne%20achievements';
    const d = await (await fetch(u, { credentials: 'omit' })).json();
    const h = d.parse.text;
    const i = h.indexOf('Easy_achievements');
    return { len: h.length, sections: (h.match(/<section/g) || []).length, start: h.slice(0, 300), around: h.slice(Math.max(0, i - 400), i + 1200) };
  });
  console.log('PROBE len', r.len, 'sections', r.sections);
  console.log('PROBE start', r.start.replace(/\s+/g, ' '));
  console.log('PROBE around', r.around.replace(/\s+/g, ' '));
  await page.locator('.tab[data-home="areas"]').click();
  await page.locator('.q[data-area="Ardougne"]').first().click();
  await page.waitForTimeout(6000);
  console.log('PROBE app', await page.evaluate(() => ({ title: document.querySelector('h1.qt').textContent, err: (document.querySelector('#load-err') || {}).textContent })));
  const q = await page.evaluate(async () => {
    const u = "https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=Cook's%20Assistant/Quick%20guide";
    const d = await (await fetch(u, { credentials: 'omit' })).json();
    return (d.parse.text.match(/<section/g) || []).length;
  });
  console.log('PROBE quest sections', q, 'errors', JSON.stringify(errs));
});
