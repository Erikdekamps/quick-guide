// The quest list in the wiki's optimal order (Quests/Progression guide), hiding done quests,
// and the border of the next step.
const { test, expect, fixture, seed, stored, openApp, openQuest, openTab, step, choose, openCog, closeCog, lookUp, toggle } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
const GUIDE = 'Quests/Progression guide';
const names = (page) => page.locator('.q .q1 b');
const groups = (page) => page.locator('.ghb .n');
const ORDER = ["Cook's Assistant", 'Imp Catcher', 'Rune Mysteries', 'Demon Slayer', 'Dragon Slayer', 'Druidic Ritual', 'Desert Treasure', 'While Guthix Sleeps'];
const REST = ['101 Test Quest', "'Phite Club", 'Recipe for Disaster: Freeing King Awowogei'];

const cog = toggle;

test.describe('optimal order', () => {
  test('quests.js reads the order from the wiki page', async ({ page }) => {
    await page.goto('/__blank');
    await page.addScriptTag({ url: '/quests.js' });
    const order = await page.evaluate((h) => window.QuickGuideData.parseOrder(h), fixture('progression-guide.html'));
    expect(order).toEqual(["Cook's Assistant", 'Imp Catcher', 'Rune Mysteries', 'Demon Slayer', 'The Blood Pact', 'Dragon Slayer', 'Druidic Ritual', 'Desert Treasure', 'While Guthix Sleeps']);
  });

  test('the sort menu offers it; choosing it reads the wiki once and sorts the list', async ({ page, wiki }) => {
    await openApp(page, expect);
    await expect(page.locator('#sort option')).toHaveText(['A to Z', 'Optimal order', 'Difficulty', 'Length', 'Series', 'Newest']);
    expect(wiki.asked()).toEqual(['List of quests']);
    await choose(page, '#sort', 'opt');
    await expect(names(page)).toHaveText(ORDER.concat(REST));
    await expect(groups(page)).toHaveText(['Optimal order', 'Not in the guide']);
    await expect(page.locator('.ghb[data-group="Optimal order"] .c')).toHaveText('8');
    expect(wiki.asked()).toEqual(['List of quests', GUIDE]);
    const saved = await stored(page, 'order');
    expect(saved.order).toHaveLength(9);
    expect(Date.now() - saved.at).toBeLessThan(60000);
  });

  test('each quest shows its place in the order', async ({ page }) => {
    await openApp(page, expect);
    await choose(page, '#sort', 'opt');
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"] .q2")).toHaveText('#1 · Novice · Short · Free · 1 QP');
    await expect(page.locator('.q[data-quest="While Guthix Sleeps"] .q2')).toContainText('#8 · Grandmaster');
    await expect(page.locator('.q[data-quest="101 Test Quest"] .q2')).toHaveText('Special · Very Short · Free');
  });

  test('it is remembered, and not read again after a reload', async ({ page, wiki }) => {
    await openApp(page, expect);
    await choose(page, '#sort', 'opt');
    await expect(names(page).first()).toHaveText("Cook's Assistant");
    await page.reload();
    await expect(page.locator('#sort')).toHaveValue('opt');
    await expect(names(page)).toHaveText(ORDER.concat(REST));
    expect(wiki.asked().filter((x) => x === GUIDE)).toHaveLength(1);
  });

  test('shows a message while it loads', async ({ page, wiki }) => {
    wiki.fail(GUIDE, 'slow');
    await openApp(page, expect);
    await choose(page, '#sort', 'opt');
    await expect(page.locator('#qarea .state')).toHaveText('Getting the optimal order…');
  });

  test('shows an error and can try again', async ({ page, wiki }) => {
    wiki.fail(GUIDE, 'network');
    await openApp(page, expect);
    await choose(page, '#sort', 'opt');
    await expect(page.locator('#qarea .err')).toHaveText('Could not get the optimal order. Could not reach the wiki. Check your internet, then try again.');
    wiki.page(GUIDE, fixture('progression-guide.html'));
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(names(page).first()).toHaveText("Cook's Assistant");
  });

  test('a wiki page without the order table is an error', async ({ page, wiki }) => {
    wiki.page(GUIDE, '<p>Nothing here.</p>');
    await openApp(page, expect);
    await choose(page, '#sort', 'opt');
    await expect(page.locator('#qarea .err')).toHaveText('Could not get the optimal order. Could not read the order on the wiki. Try again in a moment.');
  });

  test('quests in progress still come first; search still works', async ({ page }) => {
    await seed(page, { meta: { [WGS]: { title: 'While Guthix Sleeps', done: 4, total: 12, at: 1 } } });
    await openApp(page, expect);
    await choose(page, '#sort', 'opt');
    await expect(groups(page)).toHaveText(['In progress', 'Optimal order', 'Not in the guide']);
    await expect(names(page).first()).toHaveText('While Guthix Sleeps');
    await page.locator('#quest-link').fill('slay');
    await expect(names(page)).toHaveText(['Demon Slayer', 'Dragon Slayer']);
  });

  test('"Update quest list" updates the order too', async ({ page, wiki }) => {
    await openApp(page, expect);
    await choose(page, '#sort', 'opt');
    await expect(names(page).first()).toHaveText("Cook's Assistant");
    wiki.page(GUIDE, fixture('progression-guide.html').replace('data-rowid="Cook\'s Assistant"', 'data-rowid="Nothing"').replace('</tbody>', '<tr data-rowid="Cook\'s Assistant"><td>Cook\'s Assistant</td></tr></tbody>'));
    await page.locator('#cog-btn').click();
    await page.getByRole('button', { name: 'Update quest list' }).click();
    await expect(page.locator('#toast')).toHaveText('Quest list updated.');
    await expect(names(page).first()).toHaveText('Imp Catcher');
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"] .q2")).toContainText('#8');
  });

  test('an order older than a week is read again quietly', async ({ page, wiki }) => {
    await seed(page, { order: { at: Date.now() - 8 * 24 * 3600 * 1000, order: ['Dragon Slayer'] }, settings: { sort: 'opt' } });
    await openApp(page, expect);
    await expect(names(page).first()).toHaveText("Cook's Assistant");
    expect(wiki.asked()).toContain(GUIDE);
  });
});

test.describe('hide done quests', () => {
  const done = { meta: { "Cook's Assistant/Quick guide": { title: "Cook's Assistant", done: 4, total: 4, at: 2 }, [WGS]: { title: 'While Guthix Sleeps', done: 4, total: 12, at: 1 } } };

  test('a setting in the cog menu, off at first', async ({ page }) => {
    await seed(page, done);
    await openApp(page, expect);
    await page.locator('#cog-btn').click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Hide completed' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"]")).toBeVisible();
  });

  test('on: done quests leave the list, started ones stay; it is remembered', async ({ page }) => {
    await seed(page, done);
    await openApp(page, expect);
    await cog(page, 'Hide completed');
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"]")).toHaveCount(0);
    await expect(page.locator('.q[data-quest="While Guthix Sleeps"]')).toBeVisible();
    await expect(page.locator('#qcount')).toHaveText('10 of 11 quests · 1 done hidden');
    await expect(groups(page)).not.toContainText(['C']);
    expect((await stored(page, 'settings')).hideDone).toBe(true);
    await page.reload();
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"]")).toHaveCount(0);
    await page.locator('#cog-btn').click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Hide completed' })).toHaveAttribute('aria-checked', 'true');
  });

  test('off again: they come back', async ({ page }) => {
    await seed(page, Object.assign({ settings: { hideDone: true } }, done));
    await openApp(page, expect);
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"]")).toHaveCount(0);
    await cog(page, 'Hide completed');
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"]")).toBeVisible();
    await expect(page.locator('#qcount')).toHaveText('11 quests');
  });

  test('quests the game says are done are hidden too', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', { 'Imp Catcher': 'COMPLETED', 'Dragon Slayer': 'STARTED' }, {});
    await seed(page, { settings: { hideDone: true } });
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('1 quest done');
    await expect(page.locator('.q[data-quest="Imp Catcher"]')).toHaveCount(0);
    await expect(page.locator('.q[data-quest="Dragon Slayer"]')).toBeVisible();
  });

  test('a search still finds a hidden quest, so you can open it', async ({ page }) => {
    await seed(page, Object.assign({ settings: { hideDone: true } }, done));
    await openApp(page, expect);
    await page.locator('#quest-link').fill('cook');
    await expect(page.locator(".q[data-quest=\"Cook's Assistant\"]")).toBeVisible();
  });

  test('when every quest is done and hidden, it says so', async ({ page }) => {
    await seed(page, { settings: { hideDone: true }, list: { at: Date.now(), quests: [{ t: "Cook's Assistant" }] }, meta: done.meta });
    await page.goto('/');
    await expect(page.locator('#qarea .empty')).toHaveText('All quests are done. Turn off “Hide completed” in the settings to see them.');
  });
});

test.describe('the next step keeps its border', () => {
  test('hovering the next step does not paint over its gold border', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'steps');
    const cur = step(page, 'In Taverley');
    await expect(cur).toHaveClass(/\bcur\b/);
    const edge = async () => {
      const b = await cur.boundingBox();
      const shot = await page.screenshot({ clip: { x: Math.round(b.x), y: Math.round(b.y + b.height / 2), width: 1, height: 1 } });
      return shot.toString('base64');
    };
    await page.mouse.move(2, 2);
    const before = await edge();
    await cur.locator(':scope > .row').hover();
    expect(await edge()).toBe(before);
    // and the border is drawn above the row, not under it
    const after = await cur.evaluate((e) => { const s = getComputedStyle(e, '::after'); return [s.borderLeftWidth, s.pointerEvents, s.position]; });
    expect(after).toEqual(['1px', 'none', 'absolute']);
  });
});
