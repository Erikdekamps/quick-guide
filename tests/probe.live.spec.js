// Temporary: how the wiki pages look that the next features need.
const base = require('@playwright/test');
const { ORIGIN, serveFile } = require('./support/app');
const test = base.test.extend({ context: async ({ context }, use) => { await context.route(ORIGIN + '/**', (r) => serveFile(r)); await use(context); } });
const api = (p) => 'https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=' + encodeURIComponent(p);

test('probe: miniquests page', async ({ page }) => {
  await page.goto('/__blank');
  const out = await page.evaluate(async (u) => {
    const d = await (await fetch(u)).json();
    const doc = new DOMParser().parseFromString(d.parse.text, 'text/html');
    const L = ['TITLE ' + d.parse.title];
    Array.from((doc.querySelector('.mw-parser-output') || doc.body).children).forEach((el, i) => {
      let s = i + ' <' + el.tagName + ' class="' + (el.className || '') + '"> ';
      if (el.tagName === 'TABLE') s += 'rows=' + el.rows.length + ' HEAD: ' + Array.from(el.rows[0].cells).map((x) => x.tagName + ':' + x.textContent.trim().slice(0, 30) + (x.getAttribute('title') ? '[t=' + x.getAttribute('title') + ']' : '')).join(' | ');
      else s += el.textContent.trim().replace(/\s+/g, ' ').slice(0, 100);
      L.push(s);
    });
    Array.from(doc.querySelectorAll('table')).forEach((t, ti) => {
      L.push('--- TABLE ' + ti + ' class=' + t.className + ' rows=' + t.rows.length);
      Array.from(t.rows).slice(0, 4).forEach((r) => L.push('ROW ' + r.outerHTML.replace(/\s+/g, ' ').slice(0, 900)));
    });
    return L;
  }, api('Miniquests'));
  for (const l of out) console.log('PROBE ' + l);
});

test('probe: league region and details rows', async ({ page }) => {
  await page.goto('/');
  const out = await page.evaluate(async () => {
    const L = [];
    for (const t of ['While Guthix Sleeps/Quick guide', "Cook's Assistant/Quick guide", 'Desert Treasure/Quick guide']) {
      const q = await window.QuickGuide.load({ title: t, base: t.replace('/Quick guide', '') });
      L.push('QUEST ' + t + ' EXTRA ' + JSON.stringify(q.overview.extra));
      L.push('QUEST ' + t + ' OTHER ' + JSON.stringify(q.overview.otherReqs).slice(0, 600));
    }
    const u = 'https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=While_Guthix_Sleeps/Quick_guide';
    const d = await (await fetch(u)).json();
    const doc = new DOMParser().parseFromString(d.parse.text, 'text/html');
    Array.from(doc.querySelectorAll('table.questdetails tr')).forEach((tr) => {
      const th = tr.querySelector('th');
      if (th && /league|region/i.test(th.textContent)) L.push('ROWHTML ' + tr.outerHTML.replace(/\s+/g, ' ').slice(0, 2500));
    });
    return L;
  });
  for (const l of out) console.log('PROBE ' + l);
});

test('probe: RuneMetrics quest fields', async ({ page }) => {
  await page.goto('/__blank');
  const out = await page.evaluate(async () => {
    const d = await (await fetch('https://runescape.wiki/cors/m=adventurers-log/api/v1/playerQuests/Zezima')).json();
    const q = Object.values(d.quests);
    const keys = {};
    q.forEach((x) => Object.keys(x).forEach((k) => { keys[k] = (keys[k] || 0) + 1; }));
    return ['COUNT ' + q.length, 'KEYS ' + JSON.stringify(keys), 'NOTSTARTED ' + JSON.stringify(q.filter((x) => x.status !== 'COMPLETED').slice(0, 6)),
      'INELIGIBLE ' + q.filter((x) => !x.eligible).length, 'MINI? ' + JSON.stringify(q.filter((x) => /rocking out|curse of the empty lord|tears of guthix/i.test(x.title)))];
  });
  for (const l of out) console.log('PROBE ' + l);
});
