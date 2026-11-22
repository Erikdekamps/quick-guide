// Checks against the real RuneScape Wiki, so we notice when the wiki changes in a way that breaks the app.
// They need the internet. Run them with: npm run test:live
// (GitHub runs them once a week. The normal tests use a fake wiki and never go online.)
const base = require('@playwright/test');
const { addWiki, ORIGIN, serveFile, watchErrors } = require('./support/app');

const test = base.test.extend({
  context: async ({ context }, use) => {
    const checkErrors = watchErrors(context);
    await context.route(ORIGIN + '/**', (route) => serveFile(route));
    await use(context);
    checkErrors();
  }
});
const { expect } = base;

test('the quest list comes from the data', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#qcount')).toHaveText(/^\d+ quests$/);
  const n = parseInt(await page.locator('#qcount').textContent(), 10);
  expect(n).toBeGreaterThan(150);
  const cook = page.locator(".q[data-quest=\"Cook's Assistant\"]");
  await expect(cook).toBeVisible();
  await expect(cook.locator('.q2')).toContainText('Novice');
});

test("Cook's Assistant opens, with details, items and steps", async ({ page }) => {
  await page.goto('/');
  await page.locator(".q[data-quest=\"Cook's Assistant\"]").click();
  await expect(page.locator('h1.qt')).toHaveText("Cook's Assistant");
  await expect(page.locator('[data-ov="details"] .kv dt').first()).toHaveText('Start');
  await page.locator('.tab[data-tab="items"]').click();
  expect(await page.locator('#main li[data-item]').count()).toBeGreaterThan(0);
  await page.locator('.tab[data-tab="steps"]').click();
  expect(await page.locator('section.sec').count()).toBeGreaterThan(0);
  expect(await page.locator('li[data-step]').count()).toBeGreaterThan(2);
});

test('a long guide still reads well', async ({ page }) => {
  await page.goto('/');
  const q = await page.evaluate(() => window.QuickGuide.load({ title: 'While Guthix Sleeps/Quick guide', base: 'While Guthix Sleeps' }));
  const blocks = q.sections.flatMap((s) => s.blocks);
  const stepList = blocks.filter((b) => b.type === 'step');
  expect(q.notQuickGuide).toBe(false);
  expect(q.overview.startPoint).not.toBe('');
  expect(q.overview.skillReqs.length).toBeGreaterThan(4);
  expect(q.overview.questReqs.length).toBeGreaterThan(4);
  expect(q.requiredItems.items.length).toBeGreaterThan(4);
  expect(q.sections.length).toBeGreaterThan(4);
  expect(stepList.length).toBeGreaterThan(40);
  expect(stepList.some((s) => s.dialogue.length > 0)).toBe(true);
  expect(blocks.some((b) => b.type === 'bring') || stepList.some((s) => s.images.length > 0)).toBe(true);
  expect(q.rewards.items.length).toBeGreaterThan(2);
});

test('wiki map tiles load', async ({ page }) => {
  const ok = [];
  page.on('response', (r) => { if (/maps\.runescape\.wiki\/.+\.png/.test(r.url()) && r.status() === 200) ok.push(r.url()); });
  await page.goto('/');
  await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
  await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
  const map = page.locator('[data-ov="details"] details.acc', { hasText: 'Map' }).first();
  // boxes start open, so the map starts by itself when it is on screen
  await map.locator('.map').scrollIntoViewIfNeeded();
  await expect(map.locator('.leaflet-container')).toBeVisible();
  await expect.poll(() => ok.length, { timeout: 30000 }).toBeGreaterThan(0);
});

test('the optimal order comes with the data and matches the quest list', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#qcount')).toHaveText(/^\d+ quests$/);
  // The guide is about quests, so leave the miniquests out.
  await page.locator('.bn[data-home="settings"]').click();
  await page.getByRole('menuitemcheckbox', { name: 'Miniquests' }).click();
  await page.locator('#sort').selectOption('opt');
  await page.keyboard.press('Escape');
  await expect(page.locator('.ghb[data-group="Optimal order"]')).toBeVisible();
  const inGuide = parseInt(await page.locator('.ghb[data-group="Optimal order"] .c').textContent(), 10);
  const total = parseInt(await page.locator('#qcount').textContent(), 10);
  expect(inGuide).toBeGreaterThan(total * 0.8);
  await expect(page.locator('.q .q2').first()).toContainText('#1');
});

test('miniquests are read from the wiki, from the main table only', async ({ page }) => {
  await page.goto('/__blank');
  await addWiki(page);
  const l = await page.evaluate(() => window.QuickGuideData.loadMinis());
  expect(l.quests.length).toBeGreaterThan(40);
  expect(l.quests.length).toBeLessThan(80);
  const bar = l.quests.find((q) => q.t === 'Bar Crawl (miniquest)');
  expect(bar).toMatchObject({ mini: true, m: true });
  expect(bar.dif).toBeTruthy();
  // the "one-off content" table is left out
  expect(l.quests.find((q) => q.t === 'Ali the Trader')).toBeUndefined();
});

test('the wiki says which pages it has, after its own capitals and redirects (My list\'s wiki links)', async ({ page }) => {
  await page.goto('/__blank');
  await addWiki(page);
  const found = await page.evaluate(() => window.QuickGuide.findPages(['Crystal hatchet', 'crystal hatchet', 'Soul Split', 'No such page at all 12345']));
  expect(found['Crystal hatchet']).toBe('Crystal hatchet');
  expect(found['crystal hatchet']).toBe('Crystal hatchet');
  expect(found['Soul Split']).toBeTruthy();
  expect(found['No such page at all 12345']).toBeUndefined();
});

test('League rows show region names', async ({ page }) => {
  await page.goto('/__blank');
  await addWiki(page);
  const q = await page.evaluate(() => window.QuickGuide.load({ title: 'While Guthix Sleeps/Quick guide', base: 'While Guthix Sleeps' }));
  const row = q.overview.extra.find((x) => /league region/i.test(x.label));
  // If the wiki drops the League rows, there is nothing to check.
  if (row) {
    expect(row.html).toMatch(/^(<span class="reg">[A-Z][a-z]+<\/span> ?)+$/);
  }
});

test('every area page reads into its tiers, with tasks', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/__blank');
  await addWiki(page);
  const out = await page.evaluate(async () => {
    const res = [];
    for (const a of window.QuickGuide.AREAS) {
      try {
        const r = await window.QuickGuide.loadArea(a.name);
        res.push({ name: a.name, want: a.tiers, got: r.tiers.map((t) => t.name), tasks: r.tiers.map((t) => t.tasks.length),
          needs: r.tiers.some((t) => t.skills.length + t.quests.length > 0), perks: r.tiers.some((t) => t.reward.perks.length > 0) });
      } catch (e) { res.push({ name: a.name, error: String(e && e.message) }); }
    }
    return res;
  });
  for (const r of out) {
    expect(r.error, r.name).toBeUndefined();
    expect(r.got, r.name).toEqual(r.want);
    for (const n of r.tasks) expect(n, r.name).toBeGreaterThan(0);
    expect(r.needs, r.name).toBe(true);
  }
});

test('the wiki still lists the same 13 areas', async ({ page }) => {
  await page.goto('/__blank');
  await addWiki(page);
  const names = await page.evaluate(async () => {
    const r = await fetch('https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=links&origin=*&page=Area_Tasks_achievements');
    const d = await r.json();
    return d.parse.links.map((l) => l.title).filter((t) => / achievements$/.test(t)).map((t) => t.replace(/ achievements$/, ''));
  });
  const ours = await page.evaluate(() => window.QuickGuide.AREAS.map((a) => a.name));
  for (const n of ours) expect(names, n).toContain(n);
});

test('an area task with steps: Red, Red Pies of Summer has its 4 steps', async ({ page }) => {
  await page.goto('/__blank');
  await addWiki(page);
  const t = await page.evaluate(async () => {
    const a = await window.QuickGuide.loadArea('Varrock');
    return a.tiers.flatMap((x) => x.tasks).find((x) => x.name === 'Red, Red Pies of Summer');
  });
  expect(t, 'the task is still on the Varrock page').toBeTruthy();
  expect(t.subs).toHaveLength(4);
  expect(t.subs[0].id).toBe(t.id + ':1');
  expect(t.notes).toContain('Required items');
});

test('area tasks: the steps of a task are found on every area page', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/__blank');
  await addWiki(page);
  const n = await page.evaluate(async () => {
    let withSteps = 0, tasks = 0;
    for (const a of window.QuickGuide.AREAS) {
      const r = await window.QuickGuide.loadArea(a.name);
      r.tiers.forEach((t) => t.tasks.forEach((x) => { tasks++; if (x.subs.length) withSteps++; }));
    }
    return { withSteps, tasks };
  });
  expect(n.tasks).toBeGreaterThan(500);
  // A numbered list of two or more lines becomes the steps of a task (11 tasks in November 2026). A tip stays a tip,
  // however long (since 1.29.0). Most tasks are one line.
  expect(n.withSteps).toBeGreaterThan(5);
  expect(n.withSteps).toBeLessThan(n.tasks / 2);
});

// What the wiki sends to a phone: asked with an iPhone's browser name (user agent). The page must read the same.
test('an area page as the wiki sends it to a phone reads into its tiers and tasks', async ({ page, request }) => {
  const UA = base.devices['iPhone 13'].userAgent;
  const url = 'https://runescape.wiki/api.php?action=parse&format=json&formatversion=2&prop=text%7Cjsconfigvars&redirects=1&disableeditsection=1&disablelimitreport=1&origin=*&page=Ardougne%20achievements';
  const r = await request.get(url, { headers: { 'User-Agent': UA, Origin: 'https://erikdekamps.github.io' } });
  console.log('phone answer:', r.status(), r.headers()['content-type']);
  const body = await r.text();
  console.log('phone answer: sections', (body.match(/<section/g) || []).length, 'start', body.slice(0, 200).replace(/\s+/g, ' '));
  const d = JSON.parse(body);
  await page.goto('/__blank');
  await addWiki(page);
  const t = await page.evaluate((h) => window.QuickGuide.parseArea(h, 'Ardougne').tiers.map((x) => [x.name, x.tasks.length]), d.parse.text);
  expect(t.map((x) => x[0])).toEqual(['Easy', 'Medium', 'Hard', 'Elite']);
  for (const x of t) expect(x[1]).toBeGreaterThan(0);
});

test('the three capes read from the wiki, with what each achievement needs and a tip', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const Q = window.QuickGuide, out = {};
    for (const c of Q.CAPES) {
      const cape = await Q.loadCape(c.key), xs = cape.cheevos;
      const words = (x) => (x.other || []).concat((x.links || []).map((l) => l.name), (x.oneOf || []).map((o) => o.text), (x.skills || []).map((s) => s.skill));
      out[c.key] = {
        n: xs.length, levels: cape.levels.length, skiller: cape.skiller.length, names: xs.map((x) => x.name),
        tips: xs.filter((x) => x.tip).length,
        needs: xs.filter((x) => words(x).length).length,
        also: xs.filter((x) => (x.also || []).length).length,
        // wiki markup that was not turned into words
        raw: xs.flatMap(words).filter((t) => /[{}[\]|<>]/.test(t))
      };
    }
    return out;
  });
  expect(r.mqc.n).toBeGreaterThan(250);
  expect(r.comp.n).toBeGreaterThan(80);
  expect(r.trim.n).toBeGreaterThan(60);
  // the master quest cape's levels, and Master Skiller's
  expect(r.mqc.levels).toBeGreaterThan(20);
  expect(r.comp.skiller).toBeGreaterThan(25);
  // the achievements that tick themselves are found by their names
  expect(r.mqc.names).toContain('Quest Cape');
  expect(r.comp.names).toEqual(expect.arrayContaining(['Quest Cape', 'Master Skiller']));
  expect(r.trim.names).toEqual(expect.arrayContaining(['Master Quest Cape', 'Completionist Cape']));
  for (const k of ['mqc', 'comp', 'trim']) {
    expect(r[k].tips / r[k].n, k + ': tips').toBeGreaterThan(0.9);
    expect(r[k].needs / r[k].n, k + ': needs').toBeGreaterThan(0.5);
    expect(r[k].raw, k + ': wiki markup in needs').toEqual([]);
  }
  // some count for two capes
  expect(r.mqc.also).toBeGreaterThan(10);
});

test('the data says what it has of the pages the app keeps (for Update from the wiki)', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => window.QuickGuide.pageInfo(["Cook's Assistant/Quick guide", 'Master Quest Cape (achievement)', 'Ardougne achievements', 'No such page at all 7x/Quick guide']));
  expect(r["Cook's Assistant/Quick guide"].rev).toBeGreaterThan(0);
  expect(r["Cook's Assistant/Quick guide"].hash).toMatch(/^[0-9a-f]{10}$/);
  expect(r['Master Quest Cape (achievement)'].hash).toMatch(/^[0-9a-f]{10}$/);
  expect(r['Ardougne achievements'].hash).toMatch(/^[0-9a-f]{10}$/);
  // a page the data does not know is left out
  expect(r['No such page at all 7x/Quick guide']).toBeUndefined();
});
