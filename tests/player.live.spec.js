// Can a web page on GitHub Pages look up a player? This tries each place that has player data,
// from a real browser, and says which ones answer. Needs the internet: npm run test:live
// "Readable" means the browser let the page read the answer, even if the answer is "no such player".
const base = require('@playwright/test');
const { ORIGIN, serveFile } = require('./support/app');

const test = base.test.extend({
  context: async ({ context }, use) => {
    await context.route(ORIGIN + '/**', (route) => serveFile(route));
    await use(context);
  }
});
const { expect } = base;
// A well-known public character name.
const NAME = 'Zezima';

// Plain fetch, the way parser.js does it.
function viaFetch(page, url) {
  return page.evaluate((u) => fetch(u, { credentials: 'omit' }).then(
    (r) => r.text().then((t) => ({ readable: true, status: r.status, body: t.slice(0, 400) })),
    (e) => ({ readable: false, error: String(e) })
  ), url);
}
// JSONP: the answer comes as a script that calls our function. Works without the server allowing fetch.
function viaScript(page, url) {
  return page.evaluate((u) => new Promise((done) => {
    const cb = 'qgcb' + Date.now();
    const s = document.createElement('script');
    const timer = setTimeout(() => done({ readable: false, error: 'no answer in 20 seconds' }), 20000);
    window[cb] = (data) => { clearTimeout(timer); done({ readable: true, body: JSON.stringify(data).slice(0, 400) }); };
    s.onerror = () => { clearTimeout(timer); done({ readable: false, error: 'the script did not load' }); };
    s.src = u + (u.indexOf('?') < 0 ? '?' : '&') + 'callback=' + cb;
    document.head.appendChild(s);
  }), url);
}

const sources = [
  ['WikiSync', viaFetch, 'https://sync.runescape.wiki/runescape/player/' + NAME + '/STANDARD'],
  ['wiki pass-through: quests', viaFetch, 'https://runescape.wiki/cors/m=adventurers-log/api/v1/playerQuests/' + NAME],
  ['wiki pass-through: levels', viaFetch, 'https://runescape.wiki/cors/m=hiscore/index_lite.json?player=' + NAME],
  ['Jagex RuneMetrics quests, as a script', viaScript, 'https://apps.runescape.com/runemetrics/quests?user=' + NAME],
  ['Jagex RuneMetrics profile, as a script', viaScript, 'https://apps.runescape.com/runemetrics/profile/profile?user=' + NAME + '&activities=0'],
  ['Jagex RuneMetrics quests, plain fetch', viaFetch, 'https://apps.runescape.com/runemetrics/quests?user=' + NAME],
  ['Jagex hiscores, plain fetch', viaFetch, 'https://secure.runescape.com/m=hiscore/index_lite.ws?player=' + NAME]
];

for (const [name, how, url] of sources) {
  test('player data source: ' + name, async ({ page }) => {
    await page.goto('/__blank');
    const r = await how(page, url);
    console.log('SOURCE ' + name + ' -> ' + JSON.stringify(r));
    expect(r.readable, r.error).toBe(true);
  });
}
