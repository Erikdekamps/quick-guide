// Shared test setup for Quick Guide.
// - The app's files are served from this folder at http://quick-guide.test (no web server needed).
// - The RuneScape Wiki is faked: each test says which pages exist (see tests/fixtures/wiki).
// - Fonts, map tiles and wiki pictures are stubbed, and anything else on the internet is blocked.
const base = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'wiki');
const ORIGIN = 'http://quick-guide.test';
// A 1x1 transparent PNG, for map tiles and wiki pictures.
// The wiki API allows any site to read it (origin=*); the fake one says the same.
const CORS = { 'access-control-allow-origin': '*' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function fixture(name) { return fs.readFileSync(path.join(FIXTURES, name), 'utf8'); }

// The fake wiki. Pages are keyed by title, the way the app asks for them ("X/Quick guide").
class Wiki {
  constructor() {
    this.pages = {};
    this.calls = [];      // every api.php call: { page, prop, url }
    this.player = {};     // fake player data answers, by a part of the URL
    this.playerCalls = [];  // every player data request (URL)
    this.titles = {};     // pages that exist for "is there a page called …": { title: the page it leads to }
    this.lookups = [];    // every "is there a page called …" call: the titles it asked for
    this.lookupFail = false;
  }
  // A page that exists when the app asks whether there is one (My list's wiki links). to: the page a redirect leads to.
  exists(title, to) { this.titles[title] = to || title; return this; }
  // The wiki's answer to action=query&titles=A|B: which of them exist, after its own first capital and redirects.
  answerLookup(route, url) {
    const asked = (url.searchParams.get('titles') || '').split('|');
    this.lookups.push(asked);
    if (this.lookupFail) return route.abort('failed');
    const normalized = [], redirects = [], pages = [], seen = {};
    for (const t of asked) {
      const n = t.charAt(0).toUpperCase() + t.slice(1);
      if (n !== t) normalized.push({ fromencoded: false, from: t, to: n });
      const to = this.titles[n];
      if (to && to !== n) redirects.push({ from: n, to });
      const end = to || n;
      if (seen[end]) continue;
      seen[end] = 1;
      pages.push(to ? { pageid: pages.length + 1, ns: 0, title: end } : { ns: 0, title: end, missing: true });
    }
    return route.fulfill({ headers: CORS, json: { batchcomplete: true, query: { normalized, redirects, pages } } });
  }
  // A page that exists. html is the page body; live is the map data (wgKartographerLiveData).
  page(title, html, live) { this.pages[title] = { html, live: live || {} }; return this; }
  // A page the wiki does not have.
  missing(title) { this.pages[title] = { error: { code: 'missingtitle', info: "The page you specified doesn't exist." } }; return this; }
  // A page that fails: 'http' (500), 'network', 'format' (no parse), 'slow' (never answers).
  fail(title, how) { this.pages[title] = { fail: how }; return this; }
  // The standard set: the quest list and the guides in tests/fixtures/wiki.
  standard() {
    this.page('List of quests', fixture('list-of-quests.html'));
    this.page('Quests/Progression guide', fixture('progression-guide.html'));
    this.page('While Guthix Sleeps/Quick guide', fixture('while-guthix-sleeps.html'), JSON.parse(fixture('while-guthix-sleeps.live.json')));
    this.page("Cook's Assistant/Quick guide", fixture('cooks-assistant.html'));
    this.missing('Rune Mysteries/Quick guide');
    this.page('Rune Mysteries', fixture('rune-mysteries.html'));
    return this;
  }
  // Which pages the app asked for, in order. The miniquest list is left out (the app asks for it
  // next to the quest list); askedAll() has every page.
  asked() { return this.askedAll().filter((p) => p !== 'Miniquests'); }
  askedAll() { return this.calls.map((c) => c.page); }
  // The wiki's miniquest list (not in the standard set, so most tests see quests only).
  minis() { return this.page('Miniquests', fixture('miniquests.html')); }
  async handle(route) {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api.php') {
      if (url.pathname.startsWith('/images/')) return route.fulfill({ body: PNG, contentType: 'image/png' });
      if (url.pathname.startsWith('/cors/')) return this.answerPlayer(route, url);
      return route.fulfill({ status: 404, body: 'not found' });
    }
    if (url.searchParams.get('action') === 'query') return this.answerLookup(route, url);
    const title = url.searchParams.get('page');
    this.calls.push({ page: title, prop: url.searchParams.get('prop'), url: url.href });
    const p = this.pages[title];
    if (!p) return route.fulfill({ headers: CORS, json: { error: { code: 'missingtitle', info: "The page you specified doesn't exist." } } });
    if (p.error) return route.fulfill({ headers: CORS, json: { error: p.error } });
    if (p.fail === 'http') return route.fulfill({ status: 500, headers: CORS, body: 'oops' });
    if (p.fail === 'network') return route.abort('failed');
    if (p.fail === 'format') return route.fulfill({ headers: CORS, json: { batchcomplete: true } });
    if (p.fail === 'slow') return; // never answers
    return route.fulfill({
      headers: CORS,
      json: { parse: { title, pageid: 1, text: '<div class="mw-parser-output">' + p.html + '</div>', jsconfigvars: { wgKartographerLiveData: p.live } } }
    });
  }
  // Player data for one name, the way the wiki passes it on from Jagex.
  // quests: { 'Quest name': 'COMPLETED' | 'STARTED' | 'NOT_STARTED' | 'LOCKED' }, levels: { hiscoreId: level }
  // LOCKED is NOT_STARTED with eligible: false (you do not have what the quest needs).
  setPlayer(name, quests, levels) {
    const q = {};
    Object.keys(quests || {}).forEach((t, i) => {
      const s = quests[t];
      q[String(100 + i)] = { title: t, status: s === 'LOCKED' ? 'NOT_STARTED' : s, eligible: s !== 'LOCKED' };
    });
    this.player['playerQuests/' + encodeURIComponent(name)] = { json: { quests: q } };
    this.player['index_lite.json?player=' + encodeURIComponent(name)] = { json: { name, skills: Object.keys(levels || {}).map((id) => ({ id: +id, level: levels[id] })) } };
    return this;
  }
  // The same player through Jagex's newer Player Data API: quests and skills in one answer, with quest points.
  // levels: { internalSkillName: level } ("hitpoints", "runecraft", ...). o.via: 'wiki' (the wiki passes it on),
  // 'direct' (only Jagex's own address answers) or 'both'.
  setPlayerData(name, quests, levels, o) {
    o = Object.assign({ via: 'wiki', qp: 235, qpMax: 476, canon: name }, o);
    const q = {}, skills = {};
    Object.keys(quests || {}).forEach((t, i) => {
      const s = quests[t];
      q[String(200 + i)] = { title: t, status: s === 'LOCKED' ? 'NOT_STARTED' : s, eligible: s !== 'LOCKED', difficulty: 0, members: false, qp: 1 };
    });
    Object.keys(levels || {}).forEach((k) => { skills[k] = { level: levels[k], fine_xp: 1 }; });
    const json = { name: o.canon, qp: o.qp, qp_max: o.qpMax, quests: q, skills }, key = 'playerData/' + encodeURIComponent(name);
    if (o.via !== 'direct') this.player['runescape.wiki/cors/m=adventurers-log/api/v1/' + key] = { json };
    if (o.via !== 'wiki') this.player['secure.runescape.com/m=adventurers-log/api/v1/' + key] = { json };
    return this;
  }
  async answerPlayer(route, url) {
    this.playerCalls.push(url.href);
    for (const key of Object.keys(this.player)) {
      if (url.href.indexOf(key) >= 0) {
        const a = this.player[key];
        if (a === 'network') return route.abort('failed');
        return route.fulfill({ status: a.status || 200, headers: CORS, json: a.json });
      }
    }
    return route.fulfill({ status: 404, headers: CORS, json: {} });
  }
}

const test = base.test.extend({
  wiki: async ({}, use) => { await use(new Wiki().standard()); },
  // Map tile requests, so a test can check them.
  tiles: async ({}, use) => { await use([]); },
  context: async ({ context, wiki, tiles }, use) => {
    // Routes run newest first, so this catch-all only gets what nothing else handles.
    await context.route(/^https?:\/\//, (route) => route.abort('blockedbyclient'));
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.fulfill({ body: '', contentType: 'text/css' }));
    await context.route(/^https:\/\/maps\.runescape\.wiki\//, (route) => { tiles.push(route.request().url()); return route.fulfill({ body: PNG, contentType: 'image/png' }); });
    await context.route(/^https:\/\/runescape\.wiki\//, (route) => wiki.handle(route));
    await context.route(/^https:\/\/sync\.runescape\.wiki\//, (route) => wiki.answerPlayer(route, new URL(route.request().url())));
    await context.route(/^https:\/\/secure\.runescape\.com\//, (route) => wiki.answerPlayer(route, new URL(route.request().url())));
    await context.route(ORIGIN + '/**', (route) => serveFile(route));
    await use(context);
  },
  page: async ({ page }, use, info) => {
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    // QG_COVERAGE=dir: save which code of the app each test ran (see tests/support/coverage.js).
    // A new page drops what the old page's scripts ran, so it is kept before every goto and reload.
    const cov = process.env.QG_COVERAGE, ran = [];
    if (cov) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false });
      for (const name of ['goto', 'reload']) {
        const go = page[name].bind(page);
        page[name] = async (...args) => {
          ran.push(...await page.coverage.stopJSCoverage());
          await page.coverage.startJSCoverage({ resetOnNavigation: false });
          return go(...args);
        };
      }
    }
    await use(page);
    if (cov) {
      ran.push(...await page.coverage.stopJSCoverage());
      const out = ran.filter((e) => /^http:\/\/quick-guide\.test\/js\/[a-z-]+\/[a-z-]+\.js/.test(e.url))
        .map((e) => ({ url: e.url.replace(/\?.*$/, ''), functions: e.functions }));
      fs.mkdirSync(cov, { recursive: true });
      fs.writeFileSync(path.join(cov, info.testId + '.json'), JSON.stringify(out));
    }
  }
});

function serveFile(route) {
  const url = new URL(route.request().url());
  if (url.pathname === '/__blank') return route.fulfill({ body: '<!doctype html><meta charset="utf-8"><title>blank</title>', contentType: 'text/html; charset=utf-8' });
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, path.normalize(rel));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'not found' });
  // Like GitHub Pages: text files say they are UTF-8.
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown' };
  const type = types[path.extname(file).toLowerCase()];
  return route.fulfill(type ? { path: file, contentType: type + '; charset=utf-8' } : { path: file });
}

// ---------- helpers ----------

// Puts things in the app's storage before it starts. Keys are without the "qg1." prefix.
async function seed(page, data) {
  await page.goto('/__blank');
  await page.evaluate((d) => {
    localStorage.clear();
    for (const k of Object.keys(d)) localStorage.setItem('qg1.' + k, JSON.stringify(d[k]));
  }, data);
}
// Reads one value from the app's storage (key without "qg1.").
function stored(page, key) {
  return page.evaluate((k) => { const v = localStorage.getItem('qg1.' + k); return v == null ? null : JSON.parse(v); }, key);
}
async function storedKeys(page) {
  return page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('qg1.')).map((k) => k.slice(4)).sort());
}
// Opens the start screen and waits for the quest list.
async function openApp(page, expect) {
  await page.goto('/');
  await expect(page.locator('#qcount')).toBeVisible();
}
// The settings menu (the cog). It holds the player lookup, sorting, filters and display settings.
async function openCog(page) {
  if (await page.locator('#cog').isHidden()) await page.locator('#cog-btn').click();
}
async function closeCog(page) {
  if (await page.locator('#cog').isVisible()) await page.keyboard.press('Escape');
}
// Picks a value in a menu of the settings (#sort or #kind), then closes the settings.
async function choose(page, id, value) {
  await openCog(page);
  await page.locator(id).selectOption(value);
  await closeCog(page);
}
// Flips a switch in the settings, like "Hide done quests", then closes the settings.
async function toggle(page, name) {
  await openCog(page);
  await page.getByRole('menuitemcheckbox', { name }).click();
  await closeCog(page);
}
// Looks up a character in the settings. The settings stay open, so you can see the answer.
async function lookUp(page, name) {
  await openCog(page);
  await page.locator('#player-name').fill(name);
  await page.getByRole('button', { name: 'Look up' }).click();
}
// A small "<Area> achievements" page, for tests that need many areas. tiers: [{ name, tasks: [{ id, name, desc }] }]
function areaPage(tiers) {
  return tiers.map((t) => {
    const rows = t.tasks.map((x, i) => '<tr data-rowid="' + x.id + '"><td>' + (i + 1) + '</td><td data-sort-value="' + x.name.toUpperCase() + '"><a href="/w/' + x.name.replace(/ /g, '_') +
      '" title="' + x.name + '">' + x.name + '</a></td><td>' + (x.desc || 'Do it.') + '</td><td></td><td><ul><li>None</li></ul></td><td><p>Do it.</p></td><td>5</td></tr>').join('');
    return '<div class="mw-heading mw-heading2"><h2 id="' + t.name + '_achievements">' + t.name + ' achievements</h2></div> ' +
      '<div class="mw-heading mw-heading3"><h3 id="Requirements">Requirements</h3></div> ' +
      '<table class="achievementsdetails"><tbody><tr><th class="achievementsdetails-header">Requirements</th><td><ul><li>None</li></ul></td></tr></tbody></table> ' +
      '<div class="mw-heading mw-heading3"><h3 id="List_of_achievements">List of achievements</h3></div> ' +
      '<table class="wikitable"><tbody><tr><th>#</th><th>Name</th><th>Description</th><th>Members</th><th>Requirements</th><th>Notes</th><th>RuneScore</th></tr>' + rows + '</tbody></table> ' +
      '<div class="mw-heading mw-heading3"><h3 id="Rewards">Rewards</h3></div> <p>Claim it.</p> <ul><li>A reward</li></ul>';
  }).join('');
}
const AREAS = ['Ardougne', 'Daemonheim', 'Desert', 'Falador', 'Fremennik', 'Karamja', 'Lumbridge', 'Morytania', "Seers' Village", 'Tirannwn', 'Underworld', 'Varrock', 'Wilderness'];
// All 13 areas on the fake wiki: Ardougne and Lumbridge are real pages, Varrock is an excerpt, the rest have one small task each.
function withAllAreas(wiki) {
  wiki.page('Ardougne achievements', fixture('ardougne-achievements.html'));
  wiki.page('Lumbridge achievements', fixture('lumbridge-achievements.html'));
  wiki.page('Varrock achievements', fixture('varrock-excerpt.html'));
  AREAS.filter((n) => !['Ardougne', 'Lumbridge', 'Varrock'].includes(n)).forEach((n, i) => {
    wiki.page(n + ' achievements', areaPage([{ name: 'Easy', tasks: [{ id: 5000 + i, name: n + ' filler task', desc: 'A task in ' + n + '.' }] }]));
  });
  return wiki;
}
// Opens a quest from the list, as a person would.
async function openQuest(page, expect, name) {
  if (!(await page.locator('#qcount').count())) await openApp(page, expect);
  await closeCog(page);
  await page.locator('button.q[data-quest="' + name + '"]').click();
  await expect(page.locator('h1.qt')).toHaveText(name);
}
async function openTab(page, name) {
  await page.locator('.tab[data-tab="' + name + '"]').click();
}
// The list item of the step (or sub-step) whose own text contains the given words.
function step(page, text) {
  return page.locator('li[data-step] > .row > .rb > .t').filter({ hasText: text }).first().locator('xpath=ancestor::li[@data-step][1]');
}
// The list item of an item (Items tab or a "Bring" box) whose own text contains the given words.
function item(page, text) {
  return page.locator('li[data-item] > .row > .rb > .t').filter({ hasText: text }).first().locator('xpath=ancestor::li[@data-item][1]');
}
// A part of the Steps tab, or of the Overview tab, by its title.
function part(page, title) {
  return page.locator('section.sec').filter({ has: page.locator('.sech .n', { hasText: title }) }).first();
}
// A quest, parsed by the app's own parser from a fixture, ready to put in storage.
async function parsedQuest(page, file, title, live) {
  await page.goto('/__blank');
  await page.addScriptTag({ url: '/js/wiki/parser.js' });
  return page.evaluate(([h, t, l]) => window.QuickGuide.parse('<div class="mw-parser-output">' + h + '</div>',
    { title: t, base: t.replace(/\/Quick guide$/, ''), live: l || {} }), [fixture(file), title, live]);
}
// The text of a bit of HTML, for comparing: tags taken out until none is left (so "<<b>b>" does not leave a "<b>").
function plain(html) {
  let s = String(html), was;
  do { was = s; s = s.replace(/<[^<>]*>/g, ''); } while (s !== was);
  return s.replace(/\s+/g, ' ').trim();
}
// On the start screen: a quest's row, every quest name in the list, and the group headers.
const row = (page, name) => page.locator('.q[data-quest="' + name + '"]');
const names = (page) => page.locator('.q .q1 b');
const groups = (page) => page.locator('.ghb .n');

module.exports = { test, expect: base.expect, ORIGIN, ROOT, fixture, serveFile, seed, stored, storedKeys, openApp, openQuest, openTab, openCog, closeCog, choose, toggle, lookUp, areaPage, withAllAreas, AREAS, step, item, part, row, names, groups, parsedQuest, plain };
