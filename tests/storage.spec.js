// What the app saves on your computer, and how it copes with old, broken, blocked or full storage.
const { test, expect, seed, stored, storedKeys, openApp, openQuest, openTab, step, item, part, parsedQuest } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';

test('what is saved while you use a quest', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await page.locator('[data-ov-btn="enemies"]').click();
  await openTab(page, 'items');
  await item(page, 'sapphire lantern').locator('.cb').click();
  await openTab(page, 'steps');
  await step(page, 'In Taverley').locator('.cb').first().click();
  await part(page, "Catching Lucien's spy").locator('.sech').click();
  const p = await stored(page, 'prog.' + WGS);
  expect(p).toEqual({
    steps: { [Object.keys(p.steps)[0]]: 1 },
    items: { [Object.keys(p.items)[0]]: 1 },
    tab: 'steps',
    open: { 'ov:enemies': false, 'catching-lucien-s-spy': false },
    acc: {}
  });
  expect((await stored(page, 'meta'))[WGS]).toMatchObject({ title: 'While Guthix Sleeps', done: 1, total: 12 });
  expect(await stored(page, 'last')).toBe(WGS);
  // settings are saved once you change one, and only these three
  expect(await stored(page, 'settings')).toBeNull();
  await page.locator('#cog-btn').click();
  await page.getByRole('button', { name: 'Bigger text' }).click();
  expect(await stored(page, 'settings')).toEqual({ showDone: false, hideDone: false, fontSize: 16, sort: 'name' });
  expect(await storedKeys(page)).toEqual(['last', 'list', 'meta', 'prog.' + WGS, 'quest.' + WGS, 'settings']);
});

test('the old "recent" list is moved into the new saved list', async ({ page }) => {
  await seed(page, { recent: [{ key: WGS, title: 'While Guthix Sleeps', done: 2, total: 12 }] });
  await openApp(page, expect);
  expect(await stored(page, 'recent')).toBeNull();
  expect((await stored(page, 'meta'))[WGS]).toMatchObject({ title: 'While Guthix Sleeps', done: 2, total: 12 });
  await expect(page.locator('.ghb .n').first()).toHaveText('In progress');
});

test('a "Bring" line saved by the first version still shows', async ({ page }) => {
  const q = await parsedQuest(page, 'while-guthix-sleeps.html', WGS);
  const b = q.sections[1].blocks[0];
  b.needed = 'Any logs and a <a href="https://runescape.wiki/w/Tinderbox">tinderbox</a>';
  b.recommended = '';
  await seed(page, { ['quest.' + WGS]: q, last: WGS, list: { at: Date.now(), quests: [] }, ['prog.' + WGS]: { tab: 'steps', steps: {}, open: { 'finding-movario-s-base': true } } });
  await page.goto('/');
  const box = page.locator('details.bring');
  await expect(box.locator('li[data-item] .t')).toHaveText(['Any logs and a tinderbox']);
  await expect(box.locator('.bl')).toHaveText(['Needed']);
  await expect(box.locator('li[data-item]')).toHaveAttribute('data-item', 'finding-movario-s-base:bring:v1-0needed');
});

test('broken saved player data is ignored', async ({ page }) => {
  await seed(page, { player: { name: 'Zezima' } });   // no quests
  await openApp(page, expect);
  await expect(page.locator('#player-name')).toBeVisible();
  expect(page.errors).toEqual([]);
});

test('a last quest that is gone opens the start screen', async ({ page }) => {
  await seed(page, { last: 'Gone/Quick guide' });
  await openApp(page, expect);
  await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
});

test('broken saved data does not stop the app', async ({ page }) => {
  await page.goto('/__blank');
  await page.evaluate(() => { localStorage.setItem('qg1.settings', '{broken'); localStorage.setItem('qg1.meta', '[1,2]'); localStorage.setItem('qg1.list', '"text"'); });
  await openApp(page, expect);
  await expect(page.locator('#qcount')).toHaveText('11 quests');
  await expect(page.locator('html')).toHaveCSS('font-size', '14px');
  expect(page.errors).toEqual([]);
});

test('the app still works when the browser blocks storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await openQuest(page, expect, 'While Guthix Sleeps');
  await openTab(page, 'steps');
  await page.locator('#next-btn').click();
  await expect(page.locator('#pg-cnt')).toHaveText('1 / 12 steps');
  await page.getByRole('button', { name: 'All quests' }).click();
  await expect(page.locator('.q[data-quest="While Guthix Sleeps"] .qs')).toHaveText('1 / 12');
  expect(page.errors).toEqual([]);
  // nothing was kept: after a reload it starts fresh
  await page.reload();
  await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
});

test('when storage is full, the guide opened longest ago is dropped, but not its ticks', async ({ page }) => {
  const q = await parsedQuest(page, 'cooks-assistant.html', "Cook's Assistant/Quick guide");
  const copy = (name) => Object.assign({}, q, { page: name + '/Quick guide', title: name });
  await seed(page, {
    'quest.A/Quick guide': copy('A'), 'quest.B/Quick guide': copy('B'), 'quest.C/Quick guide': copy('C'),
    'prog.A/Quick guide': { steps: { x: 1 } },
    meta: { 'A/Quick guide': { title: 'A', done: 1, total: 4, at: 1000 }, 'B/Quick guide': { title: 'B', done: 0, total: 4, at: 3000 }, 'C/Quick guide': { title: 'C', done: 0, total: 4, at: 2000 } }
  });
  // This browser only has room for three guides.
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      const guides = Object.keys(this).filter((x) => x.startsWith('qg1.quest.') && x !== k);
      if (k.startsWith('qg1.quest.') && guides.length >= 3) throw new DOMException('Full', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  await openQuest(page, expect, 'While Guthix Sleeps');
  const keys = await storedKeys(page);
  expect(keys).toContain('quest.' + WGS);
  expect(keys).not.toContain('quest.A/Quick guide');
  expect(keys).toEqual(expect.arrayContaining(['quest.B/Quick guide', 'quest.C/Quick guide', 'prog.A/Quick guide']));
  expect((await stored(page, 'meta'))['A/Quick guide']).toMatchObject({ done: 1 });
});
