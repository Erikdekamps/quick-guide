// A slow wiki, and saved pages that are broken.
// A quest, an area or a cape that is read from the wiki opens when the answer is there, but only when you still wait
// for it. A saved page that cannot be drawn does not stop the app: it is dropped, and read again when you open it.
const { test, expect, fixture, seed, stored, storedKeys, openApp, lookUp, withAllAreas, withCapes, deleteEverything } = require('./support/app');

const bar = (page, home) => page.locator('.bn[data-home="' + home + '"]');
const WGS = 'While Guthix Sleeps/Quick guide';
// What is read, where its row is, and what it is saved as.
const KINDS = [
  { what: 'a quest', wikiPage: WGS, home: 'quests', other: 'areas', row: '.q[data-quest="While Guthix Sleeps"]', key: 'quest.' + WGS, title: 'While Guthix Sleeps', setup: () => {} },
  { what: 'an area', wikiPage: 'Ardougne achievements', home: 'areas', other: 'quests', row: '.q[data-area="Ardougne"][data-atier="easy"]', key: 'area.Ardougne', title: 'Ardougne', setup: withAllAreas },
  { what: 'a cape', wikiPage: 'Master Quest Cape (achievement)', home: 'areas', other: 'quests', row: '[data-cape="mqc"]', key: 'cape.mqc', title: 'Master quest cape', setup: withCapes }
];
async function startReading(page, k) {
  await openApp(page, expect);
  await bar(page, k.home).click();
  await page.locator(k.row).first().click();
  await expect(page.locator('.state')).toContainText('from the wiki');
}
// The wiki's answer for a page has arrived, and the app has had its turn with it.
async function answered(page, wikiPage, go) {
  const there = page.waitForResponse((r) => r.url().includes('/api.php') && new URL(r.url()).searchParams.get('page') === wikiPage);
  go();
  await there;
  await page.evaluate(() => new Promise((done) => { setTimeout(done, 50); }));
}

test.describe('you went on while the wiki was slow', () => {
  for (const k of KINDS) {
    test(k.what + ': its answer is saved, and does not open over Settings', async ({ page, wiki }) => {
      k.setup(wiki);
      const go = wiki.hold(k.wikiPage);
      await startReading(page, k);
      await bar(page, 'settings').click();
      await expect(page.locator('h1.qt')).toHaveText('Settings');
      go();
      await expect.poll(() => stored(page, k.key).then((v) => !!v)).toBe(true);
      await expect(page.locator('h1.qt')).toHaveText('Settings');
      // back on the list: no more waiting, and it opens at once, without asking the wiki again
      await bar(page, k.home).click();
      await expect(page.locator('.state')).toHaveCount(0);
      await page.locator(k.row).first().click();
      await expect(page.locator('h1.qt')).toHaveText(k.title);
      expect(wiki.askedAll().filter((x) => x === k.wikiPage)).toHaveLength(1);
      // a reload stays there
      await page.reload();
      await expect(page.locator('h1.qt')).toHaveText(k.title);
      expect(page.errors).toEqual([]);
    });

    test(k.what + ': when the read fails, nothing is said on the screen you went to', async ({ page, wiki }) => {
      k.setup(wiki);
      wiki.fail(k.wikiPage, 'http');
      const go = wiki.hold(k.wikiPage);
      await startReading(page, k);
      await bar(page, k.other).click();
      await expect(page.locator('.state')).toHaveCount(0);
      await answered(page, k.wikiPage, go);
      await expect(bar(page, k.other)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#load-err')).toHaveCount(0);
      await expect(page.locator('.state')).toHaveCount(0);
      expect(page.errors).toEqual([]);
    });
  }

  test('while you wait, another answer (the miniquests) does not bring the list back', async ({ page, wiki }) => {
    wiki.minis();
    const minis = wiki.hold('Miniquests'), guide = wiki.hold(WGS);
    await startReading(page, KINDS[0]);
    await answered(page, 'Miniquests', minis);
    await expect(page.locator('.state')).toContainText('from the wiki');
    await expect(page.locator('#qarea')).toBeEmpty();
    guide();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
  });

  test('you still wait: it opens, as before', async ({ page, wiki }) => {
    const go = wiki.hold(WGS);
    await startReading(page, KINDS[0]);
    go();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
  });
});

test.describe('a saved page that is broken', () => {
  // The mistake still shows in the browser's console.
  test.use({ pageErrors: [/Cannot read properties|is not a function|is not iterable/] });
  const SAYS = 'What was saved of that page could not be shown. Open it again: it is read from the wiki.';
  const broken = [
    ['a quest', { ['quest.' + WGS]: { page: WGS, title: 'While Guthix Sleeps', version: 1, sections: [{}] }, ['prog.' + WGS]: { steps: { x: 1 } }, last: WGS }, 'quest.' + WGS, 'prog.' + WGS],
    ['an area', { 'area.Ardougne': { name: 'Ardougne', tiers: [{}] }, 'aprog.Ardougne': { tasks: { 448: 1 } }, last: 'area:Ardougne' }, 'area.Ardougne', 'aprog.Ardougne'],
    ['a cape', { 'cape.mqc': { cheevos: [null] }, 'cprog.mqc': { ticks: { 1: 1 } }, last: 'cape:mqc' }, 'cape.mqc', 'cprog.mqc']
  ];
  for (const [what, data, key, ticks] of broken) {
    test(what + ' that was open last: the app starts on the list, says so, and keeps your ticks', async ({ page }) => {
      await seed(page, data);
      await page.goto('/');
      await expect(page.locator('#load-err')).toHaveText(SAYS);
      await expect(page.locator('#qcount')).toBeVisible();
      const keys = await storedKeys(page);
      expect(keys).not.toContain(key);
      expect(keys).not.toContain('last');
      expect(keys).toContain(ticks);
      // the next start is a normal one
      await page.reload();
      await expect(page.locator('#qcount')).toBeVisible();
      await expect(page.locator('#load-err')).toHaveCount(0);
    });
  }

  test('a broken guide opened from the list: it says so, and the next click reads it from the wiki', async ({ page, wiki }) => {
    await seed(page, { ['quest.' + WGS]: { page: WGS, title: 'While Guthix Sleeps', version: 1, sections: [{}] }, meta: { [WGS]: { title: 'While Guthix Sleeps', done: 0, total: 12, at: 1 } }, upd: { at: Date.now() } });
    await openApp(page, expect);
    await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
    await expect(page.locator('#load-err')).toHaveText(SAYS);
    await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    expect(wiki.asked()).toContain(WGS);
  });
});

test.describe('things that happen while an answer is on its way', () => {
  const COOK = "Cook's Assistant/Quick guide";

  test('a guide that is read again waits with drawing while the Add to list box is open', async ({ page, wiki }) => {
    await openApp(page, expect);
    await page.locator('.q[data-quest="Cook\'s Assistant"]').click();
    await page.locator('.tab[data-tab="steps"]').click();
    await expect(page.locator('#main')).toContainText('Talk to the Cook');
    wiki.edit(COOK, fixture('cooks-assistant.html').replace('Talk to the Cook', 'Talk to the Lumbridge Cook'));
    const go = wiki.hold(COOK);
    await page.locator('#menu-btn').click();
    await page.locator('#menu .mi', { hasText: 'Refresh from wiki' }).click();
    await page.locator('#menu-btn').click();
    await page.locator('#menu .mi', { hasText: 'Add to list…' }).click();
    await page.locator('#ta-name').fill('Cooking');
    await answered(page, COOK, go);
    // the box and what you typed are still there, over the guide as it was
    await expect(page.locator('#ta-name')).toHaveValue('Cooking');
    await expect(page.locator('#main')).toContainText('Talk to the Cook');
    await expect(page.locator('#main')).not.toContainText('Talk to the Lumbridge Cook');
    // the box closes: now the new guide shows
    await page.locator('#td').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#main')).toContainText('Talk to the Lumbridge Cook');
    expect((await stored(page, 'todo')).lists.map((l) => l.name)).toEqual(['Cooking']);
    expect(page.errors).toEqual([]);
  });

  for (const fails of [false, true]) {
    test('Forget while the character is looked up' + (fails ? ' (and the lookup fails)' : '') + ': it stays forgotten', async ({ page, wiki }) => {
      wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED' }, { 7: 80 });
      await openApp(page, expect);
      await lookUp(page, 'Zezima');
      await expect(page.locator('#player')).toContainText('1 quest done');
      const go = wiki.holdPlayer();
      if (fails) Object.keys(wiki.player).forEach((k) => { wiki.player[k] = 'network'; });
      await page.getByRole('button', { name: 'Update player' }).click();
      await page.getByRole('button', { name: 'Forget this player' }).click();
      await expect(page.locator('#player-name')).toBeEnabled();
      const calls = wiki.playerCalls.length;
      go();
      await page.evaluate(() => new Promise((done) => { setTimeout(done, 300); }));
      expect(wiki.playerCalls.length).toBeGreaterThanOrEqual(calls);
      await expect(page.locator('#player-name')).toBeEnabled();
      await expect(page.locator('#toast')).toBeHidden();
      expect(await stored(page, 'player')).toBeNull();
      // and a new lookup works
      wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED' }, { 7: 80 });
      await lookUp(page, 'Zezima');
      await expect(page.locator('#player')).toContainText('1 quest done');
      expect(page.errors).toEqual([]);
    });
  }

  test('Delete everything while a guide is read: its answer is not saved after all', async ({ page, wiki }) => {
    const go = wiki.hold(WGS);
    await startReading(page, KINDS[0]);
    await bar(page, 'settings').click();
    await deleteEverything(page);
    await expect(page.locator('#toast')).toHaveText('Everything is deleted.');
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    go();
    await page.evaluate(() => new Promise((done) => { setTimeout(done, 300); }));
    expect(await storedKeys(page)).toEqual(['list']);
    // the address is clean again, so a reload does not say it twice
    expect(new URL(page.url()).hash).toBe('');
    expect(page.errors).toEqual([]);
  });
});

test('a saved character without its quests is forgotten, and the app starts', async ({ page }) => {
  await seed(page, { player: { name: 'Zezima', quests: null } });
  await openApp(page, expect);
  await expect(page.locator('#qcount')).toHaveText('11 quests');
  expect(page.errors).toEqual([]);
});
