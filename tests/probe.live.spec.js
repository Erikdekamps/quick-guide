// Temporary: shows how the wiki's quest progression guide page is built.
const base = require('@playwright/test');
const { ORIGIN, serveFile } = require('./support/app');
const test = base.test.extend({ context: async ({ context }, use) => { await context.route(ORIGIN + '/**', (r) => serveFile(r)); await use(context); } });

test('probe: progression guide', async ({ page }) => {
  await page.goto('/__blank');
  const out = await page.evaluate(async () => {
    const u = 'https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=' + encodeURIComponent('Quests/Progression guide');
    const d = await (await fetch(u)).json();
    if (!d.parse) return ['NO PARSE ' + JSON.stringify(d).slice(0, 300)];
    const doc = new DOMParser().parseFromString(d.parse.text, 'text/html');
    const lines = ['TITLE ' + d.parse.title + ' LEN ' + d.parse.text.length];
    const root = doc.querySelector('.mw-parser-output') || doc.body;
    Array.from(root.children).forEach((el, i) => {
      const t = el.tagName, c = el.className || '';
      let s = i + ' <' + t + (c ? ' class="' + c + '"' : '') + '> ';
      if (t === 'TABLE') s += 'rows=' + el.rows.length + ' HEAD: ' + Array.from(el.rows[0].cells).map((x) => x.tagName + ':' + x.textContent.trim().slice(0, 25)).join(' | ');
      else s += el.textContent.trim().replace(/\s+/g, ' ').slice(0, 110);
      lines.push(s);
    });
    Array.from(doc.querySelectorAll('table')).slice(0, 4).forEach((tb, ti) => {
      lines.push('--- TABLE ' + ti + ' class=' + tb.className + ' rows=' + tb.rows.length);
      Array.from(tb.rows).slice(0, 9).forEach((r) => lines.push('ROW ' + r.outerHTML.replace(/\s+/g, ' ').slice(0, 700)));
      Array.from(tb.rows).slice(60, 64).forEach((r) => lines.push('ROW60+ ' + r.outerHTML.replace(/\s+/g, ' ').slice(0, 500)));
    });
    return lines;
  });
  for (const l of out) console.log('PROBE ' + l);
});
