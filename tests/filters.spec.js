// Miniquests, locked quests, search, quests you can open from a guide, and League rows.
const { test, expect, fixture, stored, openApp, openQuest, choose, openCog, closeCog, lookUp, toggle } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
const row = (page, name) => page.locator('.q[data-quest="' + name + '"]');
const names = (page) => page.locator('.q .q1 b');
const details = (page) => page.locator('section[data-ov="details"] .secb');
const rewards = (page) => page.locator('section[data-ov="rewards"] .secb');
const MINIS = ['A Guild of Our Own', 'Bar Crawl', "Benedict's World Tour", 'Curse of the Empty Lord'];

const cog = toggle;
async function lookUpDone(page, name) {
  await lookUp(page, name);
  await expect(page.locator('#player')).toContainText(name);
  await closeCog(page);
}

test.describe('miniquests', () => {
  test('quests.js reads only the main table of the Miniquests page', async ({ page }) => {
    await page.goto('/__blank');
    await page.addScriptTag({ url: '/quests.js' });
    const l = await page.evaluate((h) => window.QuickGuideData.parseMinis(h), fixture('miniquests.html'));
    expect(l.map((q) => q.t)).toEqual(['A Guild of Our Own (miniquest)', 'Bar Crawl (miniquest)', "Benedict's World Tour (miniquest)", 'Curse of the Empty Lord (miniquest)']);
    expect(l[0]).toEqual({ t: 'A Guild of Our Own (miniquest)', mini: true, m: true, len: 'Short to Medium', age: 'Ambiguous', dif: 'Master', cb: 'None', qp: 0, ser: "Thieves' Guild", rel: '28 April 2010' });
    expect(l[2].m).toBe(false);
  });

  test('they are in the list, marked as miniquests, and saved', async ({ page, wiki }) => {
    wiki.minis();
    await openApp(page, expect);
    await expect(page.locator('#qcount')).toHaveText('15 quests');
    await expect(row(page, 'Bar Crawl (miniquest)').locator('.q1 b')).toHaveText('Bar Crawl');
    await expect(row(page, 'Bar Crawl (miniquest)').locator('.q2')).toHaveText('Miniquest · Intermediate · Short to Medium · Members');
    expect(wiki.askedAll()).toEqual(['List of quests', 'Miniquests']);
    expect((await stored(page, 'minis')).quests).toHaveLength(4);
    // saved: no second visit after a reload
    await page.reload();
    await expect(page.locator('#qcount')).toHaveText('15 quests');
    expect(wiki.askedAll()).toEqual(['List of quests', 'Miniquests']);
  });

  test('the filter shows all, quests only, or miniquests only, and is remembered', async ({ page, wiki }) => {
    wiki.minis();
    await openApp(page, expect);
    await expect(page.locator('#kind option')).toHaveText(['Quests + miniquests', 'Quests only', 'Miniquests only']);
    await choose(page, '#kind', 'mini');
    await expect(names(page)).toHaveText(MINIS);
    await expect(page.locator('#qcount')).toHaveText('4 of 15 quests');
    await choose(page, '#kind', 'quest');
    await expect(page.locator('#qcount')).toHaveText('11 of 15 quests');
    await expect(page.locator('.q[data-quest$="(miniquest)"]')).toHaveCount(0);
    expect((await stored(page, 'settings')).kind).toBe('quest');
    await page.reload();
    await expect(page.locator('#kind')).toHaveValue('quest');
  });

  test('search finds them by name', async ({ page, wiki }) => {
    wiki.minis();
    await openApp(page, expect);
    await page.locator('#quest-link').fill('bar crawl');
    await expect(names(page)).toHaveText(['Bar Crawl']);
  });

  test('if the miniquest page fails, the quests still show', async ({ page, wiki }) => {
    wiki.fail('Miniquests', 'http');
    await openApp(page, expect);
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    expect(page.errors).toEqual([]);
  });

  test('a done miniquest from the game is marked done', async ({ page, wiki }) => {
    wiki.minis().setPlayer('Zezima', { 'Curse of the Empty Lord (miniquest)': 'COMPLETED', 'Bar Crawl': 'STARTED' });
    await openApp(page, expect);
    await lookUpDone(page, 'Zezima');
    await expect(row(page, 'Curse of the Empty Lord (miniquest)').locator('.qs')).toHaveText('✓ Done');
    await expect(row(page, 'Bar Crawl (miniquest)').locator('.qs')).toHaveText('Started');
  });
});

test.describe('locked quests', () => {
  function player(wiki) {
    return wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED', 'Desert Treasure': 'LOCKED', 'While Guthix Sleeps': 'LOCKED', 'Imp Catcher': 'NOT_STARTED' });
  }

  test('quests you do not have the needs for are grayed out and say Locked', async ({ page, wiki }) => {
    player(wiki);
    await openApp(page, expect);
    await lookUpDone(page, 'Zezima');
    await expect(row(page, 'Desert Treasure')).toHaveClass(/\blocked\b/);
    await expect(row(page, 'Desert Treasure').locator('.qs')).toHaveText('Locked');
    await expect(row(page, 'Desert Treasure')).toHaveCSS('opacity', '0.55');
    await expect(row(page, 'Imp Catcher')).not.toHaveClass(/\blocked\b/);
    expect((await stored(page, 'player')).locked).toEqual({ deserttreasure: 1, whileguthixsleeps: 1 });
    // you can still open one
    wiki.page('Desert Treasure/Quick guide', fixture('cooks-assistant.html'));
    await row(page, 'Desert Treasure').click();
    await expect(page.locator('h1.qt')).toHaveText('Desert Treasure');
  });

  test('"Hide locked quests" leaves them out, and says how many', async ({ page, wiki }) => {
    player(wiki);
    await openApp(page, expect);
    await lookUpDone(page, 'Zezima');
    await cog(page, 'Hide locked quests');
    await expect(row(page, 'Desert Treasure')).toHaveCount(0);
    await expect(page.locator('#qcount')).toHaveText('9 of 11 quests · 2 locked hidden');
    expect((await stored(page, 'settings')).hideLocked).toBe(true);
    // together with "Hide done quests"
    await cog(page, 'Hide done quests');
    await expect(page.locator('#qcount')).toHaveText('8 of 11 quests · 1 done hidden · 2 locked hidden');
    // off again
    await cog(page, 'Hide locked quests');
    await expect(row(page, 'Desert Treasure')).toHaveCount(1);
  });

  test('a quest you started is never locked', async ({ page, wiki }) => {
    wiki.player['playerQuests/Zezima'] = { json: { quests: { 1: { title: 'Dragon Slayer', status: 'STARTED', eligible: false } } } };
    await openApp(page, expect);
    await lookUpDone(page, 'Zezima');
    await expect(row(page, 'Dragon Slayer')).not.toHaveClass(/\blocked\b/);
  });

  test('without a player nothing is locked', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('.q.locked')).toHaveCount(0);
  });
});

test.describe('search', () => {
  test('the box is for quest names only', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('#quest-link')).toHaveAttribute('placeholder', 'Search quests');
    await expect(page.locator('label[for="quest-link"]')).toHaveText('Search quests');
  });

  test('a link is searched like any text: nothing matches, and nothing is read', async ({ page, wiki }) => {
    await openApp(page, expect);
    await page.locator('#quest-link').fill('https://runescape.wiki/w/Dragon_Slayer');
    await expect(page.locator('#qarea .empty')).toHaveText('No quests match “https://runescape.wiki/w/Dragon_Slayer”.');
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('h1.qt')).toHaveText('Quick Guide');
    expect(wiki.asked()).toEqual(['List of quests']);
  });

  test('a name that is not in the list is not looked up on the wiki', async ({ page, wiki }) => {
    await openApp(page, expect);
    await page.locator('#quest-link').fill('shield of arrav');
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('#load-err')).toHaveText('No quest matches “shield of arrav”.');
    expect(wiki.asked()).toEqual(['List of quests']);
  });

  test('an empty box asks for a name', async ({ page }) => {
    await openApp(page, expect);
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('#load-err')).toHaveText('Type a quest name first.');
  });
});

test.describe('quests you can open from a guide', () => {
  test('"Needed for later quests" opens those quests in the app', async ({ page, wiki }) => {
    wiki.page("Nomad's Elegy/Quick guide", fixture('cooks-assistant.html'));
    await openQuest(page, expect, 'While Guthix Sleeps');
    const later = rewards(page).locator('details.acc', { hasText: 'Needed for later quests' });
    await expect(later.locator('button.qlink')).toHaveText(["Nomad's Elegy", 'Ritual of the Mahjarrat', 'Fate of the Gods']);
    await expect(later.locator('a')).toHaveCount(0);
    await later.getByRole('button', { name: "Nomad's Elegy" }).click();
    await expect(page.locator('h1.qt')).toHaveText("Nomad's Elegy");
    expect(wiki.asked()).toContain("Nomad's Elegy/Quick guide");
  });

  test('quests in the quest tree open in the app too', async ({ page, wiki }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    const tree = details(page).locator('.tree');
    await expect(tree.locator('button.qlink')).toHaveText(['Defender of Varrock', 'Shield of Arrav', "The Knight's Sword", 'The Hand in the Sand']);
    wiki.page('Shield of Arrav/Quick guide', fixture('cooks-assistant.html'));
    await tree.getByRole('button', { name: 'Shield of Arrav' }).click();
    await expect(page.locator('h1.qt')).toHaveText('Shield of Arrav');
  });
});

test('League rows show the region names, once, without the badge text', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  const kv = details(page).locator('.kv.wide');
  await expect(kv.locator('dt')).toHaveText(['League region required', 'League auto-complete', 'Ironman concerns']);
  await expect(kv.locator('dd').nth(0).locator('.reg')).toHaveText(['Kandarin', 'Asgarnia', 'Misthalin']);
  await expect(kv.locator('dd').nth(0)).toHaveText('Kandarin Asgarnia Misthalin');
  await expect(kv.locator('dd').nth(1)).toHaveText('Unlocking Misthalin will auto-complete the quest.');
  await expect(kv.locator('dd').nth(1).locator('.reg')).toHaveText(['Misthalin']);
});

test.describe('the settings menu holds the player, sorting and filters', () => {
  test('the start screen has only the search box and the list', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('#main #sort, #main #kind, #main #player-name, #main .filters')).toHaveCount(0);
    await expect(page.locator('#cog #sort')).toHaveCount(1);
    await expect(page.locator('#cog #kind')).toHaveCount(1);
    await expect(page.locator('#cog #player-name')).toHaveCount(1);
  });

  test('the same settings are there inside a quest', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openCog(page);
    await expect(page.locator('#cog .mh')).toHaveText(['Player', 'Quest list', 'Display']);
    await expect(page.getByLabel('Sort by')).toBeVisible();
    await expect(page.getByLabel('Show', { exact: true })).toBeVisible();
    // a sort picked in a quest is used by the list
    await page.locator('#sort').selectOption('dif');
    await closeCog(page);
    await page.getByRole('button', { name: 'All quests' }).click();
    await expect(page.locator('.ghb .n').first()).toHaveText('Novice');
  });

  test('a line under the search box says how the list is set up', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED' });
    await openApp(page, expect);
    await expect(page.locator('.qmeta')).toHaveText('11 quests · A to Z');
    await choose(page, '#sort', 'opt');
    await choose(page, '#kind', 'quest');
    await lookUpDone(page, 'Zezima');
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    await expect(page.locator('.qmeta')).toHaveText('11 quests · Optimal order · Quests only · Zezima');
  });

  test('the menu stays open while you look up a player, and shows the answer', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED' });
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#cog #player')).toContainText('Zezima · 1 quest done');
    await expect(page.locator('#cog')).toBeVisible();
  });

  test('looking up a player inside a quest updates the quest', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', { 'Defender of Varrock': 'COMPLETED' }, { 7: 80 });
    await openQuest(page, expect, 'While Guthix Sleeps');
    await lookUp(page, 'Zezima');
    await expect(page.locator('#cog #player')).toContainText('Zezima');
    await expect(page.locator('#cog')).toBeVisible();
    await expect(page.locator('section[data-ov="skills"] .chip').first()).toHaveClass(/\bok\b/);
    await expect(page.locator('section[data-ov="details"] .tree li').first()).toHaveClass(/\bgot\b/);
  });
});
