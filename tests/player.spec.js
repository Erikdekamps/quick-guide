// Player lookup: type your character name, and the app marks the quests you have done
// and shows which skill levels you still miss. The data comes through the RuneScape Wiki.
const { test, expect, seed, stored, openApp, openQuest, part, lookUp, openSettings, closeSettings, row } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
const ov = (page, id) => page.locator('section[data-ov="' + id + '"] .secb');

// Zezima: finished two quests, started one. Magic 80 (id 7), Herblore 60 (id 16).
function zezima(wiki) {
  return wiki.setPlayer('Zezima', {
    "Cook's Assistant": 'COMPLETED', 'Defender of Varrock': 'COMPLETED', 'Dragon Slayer': 'STARTED', 'Imp Catcher': 'NOT_STARTED'
  }, { 7: 80, 16: 60 });
}

test.describe('looking up a player', () => {
  test('the settings ask for your character name', async ({ page }) => {
    await openApp(page, expect);
    await openSettings(page);
    await expect(page.locator('#player-name')).toHaveAttribute('placeholder', 'Your character name');
    await expect(page.getByRole('button', { name: 'Look up' })).toBeVisible();
  });

  test('marks finished and started quests in the list, and saves the player', async ({ page, wiki }) => {
    zezima(wiki);
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await expect(page.locator('#player')).toContainText('2 quests done');
    await closeSettings(page);
    // finished: green, with a tick
    await expect(row(page, "Cook's Assistant")).toHaveClass(/\bdone\b/);
    await expect(row(page, "Cook's Assistant").locator('.qs.ok')).toHaveText('✓ Done');
    await expect(row(page, "Cook's Assistant").locator('.q1 b')).toHaveCSS('color', 'rgb(102, 211, 92)');
    // started: yellow, in the "In progress" group
    await expect(page.locator('.ghb .n').first()).toHaveText('In progress');
    await expect(row(page, 'Dragon Slayer').locator('.q1 b')).toHaveCSS('color', 'rgb(245, 225, 90)');
    await expect(row(page, 'Dragon Slayer').locator('.qs')).toHaveText('Started');
    // not started: as before
    await expect(row(page, 'Imp Catcher')).not.toHaveClass(/\bdone\b/);
    await expect(row(page, 'Imp Catcher').locator('.qs')).toHaveCount(0);
    const p = await stored(page, 'player');
    expect(p).toMatchObject({ name: 'Zezima', done: 2, started: 1, levels: { magic: 80, herblore: 60 } });
    // Player Data is tried first (through the wiki, then at Jagex); this wiki has neither, so RuneMetrics is used
    expect(wiki.playerCalls).toEqual([
      'https://runescape.wiki/cors/m=adventurers-log/api/v1/playerData/Zezima?includeQuests=true&includeSkills=true',
      'https://secure.runescape.com/m=adventurers-log/api/v1/playerData/Zezima?includeQuests=true&includeSkills=true',
      'https://runescape.wiki/cors/m=adventurers-log/api/v1/playerQuests/Zezima',
      'https://runescape.wiki/cors/m=hiscore/index_lite.json?player=Zezima'
    ]);
    expect(p.source).toBe('RuneMetrics');
  });

  test('Enter works, and spaces around the name are dropped', async ({ page, wiki }) => {
    zezima(wiki);
    await openApp(page, expect);
    await openSettings(page);
    await page.locator('#player-name').fill('  Zezima ');
    await page.locator('#player-name').press('Enter');
    await expect(page.locator('#player')).toContainText('2 quests done');
  });

  test('a name with a space', async ({ page, wiki }) => {
    wiki.setPlayer('Iron Bob', { 'Imp Catcher': 'COMPLETED' }, {});
    await openApp(page, expect);
    await lookUp(page, 'Iron Bob');
    await expect(page.locator('#player')).toContainText('Iron Bob');
    await expect(page.locator('#player')).toContainText('1 quest done');
    await closeSettings(page);
    await expect(row(page, 'Imp Catcher').locator('.qs.ok')).toHaveText('✓ Done');
  });

  test('shows a message while it looks', async ({ page, wiki }) => {
    await openApp(page, expect);
    await page.route('https://runescape.wiki/cors/**', () => {});   // never answers
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player-msg')).toHaveText('Looking up Zezima…');
    await expect(page.getByRole('button', { name: 'Look up' })).toBeDisabled();
  });

  test('the player is still there after a reload, without asking again', async ({ page, wiki }) => {
    zezima(wiki);
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('2 quests done');
    const before = wiki.playerCalls.length;
    await page.reload();
    await openSettings(page);
    await expect(page.locator('#player')).toContainText('2 quests done');
    await closeSettings(page);
    await expect(row(page, "Cook's Assistant").locator('.qs.ok')).toHaveText('✓ Done');
    expect(wiki.playerCalls.length).toBe(before);
  });

  test('data older than a day is fetched again quietly at start', async ({ page, wiki }) => {
    zezima(wiki);
    await seed(page, { player: { name: 'Zezima', at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(), quests: {}, levels: {}, done: 0, started: 0 } });
    await openApp(page, expect);
    await openSettings(page);
    await expect(page.locator('#player')).toContainText('2 quests done');
    expect(wiki.playerCalls.length).toBe(4);
  });

  test('data from an older version, without the quests\' names, is fetched again quietly at start', async ({ page, wiki }) => {
    zezima(wiki);
    await seed(page, { player: { name: 'Zezima', at: new Date().toISOString(), quests: { cooksassistant: 2 }, levels: {}, done: 1, started: 0 } });
    await openApp(page, expect);
    await openSettings(page);
    await expect(page.locator('#player')).toContainText('2 quests done');
    expect((await stored(page, 'player')).titles).toMatchObject({ cooksassistant: "Cook's Assistant", dragonslayer: 'Dragon Slayer' });
  });

  test('Update fetches the player again', async ({ page, wiki }) => {
    zezima(wiki);
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('2 quests done');
    wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED', 'Defender of Varrock': 'COMPLETED', 'Dragon Slayer': 'COMPLETED' }, { 7: 81 });
    await page.getByRole('button', { name: 'Update player' }).click();
    await expect(page.locator('#player')).toContainText('3 quests done');
    await closeSettings(page);
    await expect(row(page, 'Dragon Slayer').locator('.qs.ok')).toHaveText('✓ Done');
  });

  test('Forget removes the player and the marks', async ({ page, wiki }) => {
    zezima(wiki);
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('2 quests done');
    await page.getByRole('button', { name: 'Forget this player' }).click();
    await expect(page.locator('#player-name')).toBeVisible();
    await closeSettings(page);
    await expect(row(page, "Cook's Assistant")).not.toHaveClass(/\bdone\b/);
    expect(await stored(page, 'player')).toBeNull();
  });

  test('an empty name asks for one', async ({ page, wiki }) => {
    await openApp(page, expect);
    await openSettings(page);
    await page.getByRole('button', { name: 'Look up' }).click();
    await expect(page.locator('#player-msg')).toHaveText('Type your character name first.');
    expect(wiki.playerCalls).toEqual([]);
  });

  test('a name with no data says what to check', async ({ page }) => {
    await openApp(page, expect);
    await lookUp(page, 'Nobody Here');
    await expect(page.locator('#player-msg')).toHaveText('Found no player called “Nobody Here”. Check the spelling.');
    await expect(page.locator('#player-name')).toHaveValue('Nobody Here');
  });

  test('no internet says so', async ({ page, wiki }) => {
    wiki.player['playerQuests/Zezima'] = 'network';
    wiki.player['index_lite.json?player=Zezima'] = 'network';
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player-msg')).toHaveText('Could not reach the wiki. Check your internet, then try again.');
  });

  test('a failed Update keeps the old data', async ({ page, wiki }) => {
    zezima(wiki);
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('2 quests done');
    wiki.player['playerQuests/Zezima'] = 'network';
    wiki.player['index_lite.json?player=Zezima'] = 'network';
    await page.getByRole('button', { name: 'Update player' }).click();
    await expect(page.locator('#toast')).toHaveText('Could not update Zezima. Could not reach the wiki. Check your internet, then try again.');
    await expect(page.locator('#player')).toContainText('2 quests done');
  });
});

// Jagex's Player Data API: quests and skill levels in one answer, fresher than the hiscores, with quest points.
test.describe('the Player Data lookup', () => {
  const QUESTS = { "Cook's Assistant": 'COMPLETED', 'Defender of Varrock': 'COMPLETED', 'Dragon Slayer': 'STARTED', 'Imp Catcher': 'LOCKED' };

  test('through the wiki: one request for quests, levels and quest points', async ({ page, wiki }) => {
    wiki.setPlayerData('zezima', QUESTS, { magic: 81, herblore: 60, hitpoints: 99, runecraft: 50 }, { canon: 'Zezima' });
    await openApp(page, expect);
    await lookUp(page, 'zezima');
    // the name as the game writes it, and the quest points
    await expect(page.locator('#player .pn')).toHaveText('Zezima · 2 quests done · 235 QP');
    await closeSettings(page);
    await expect(row(page, "Cook's Assistant")).toHaveClass(/\bdone\b/);
    await expect(row(page, 'Dragon Slayer').locator('.qs')).toHaveText('Started');
    const p = await stored(page, 'player');
    expect(p).toMatchObject({ name: 'Zezima', source: 'Player Data', done: 2, started: 1, qp: 235, qpMax: 476 });
    // the game's own skill names are turned into the ones the wiki uses
    expect(p.levels).toEqual({ magic: 81, herblore: 60, constitution: 99, runecrafting: 50 });
    expect(p.locked).toEqual({ impcatcher: 1 });
    expect(p.titles.cooksassistant).toBe("Cook's Assistant");
    expect(wiki.playerCalls).toEqual(['https://runescape.wiki/cors/m=adventurers-log/api/v1/playerData/zezima?includeQuests=true&includeSkills=true']);
  });

  test('the wiki does not pass it on: Jagex is asked itself', async ({ page, wiki }) => {
    wiki.setPlayerData('Zezima', QUESTS, { magic: 81 }, { via: 'direct' });
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('2 quests done');
    expect((await stored(page, 'player')).source).toBe('Player Data');
    expect(wiki.playerCalls.map((u) => new URL(u).host)).toEqual(['runescape.wiki', 'secure.runescape.com']);
  });

  test('neither answers: the older lookup still works', async ({ page, wiki }) => {
    zezima(wiki);
    wiki.player['playerData/Zezima'] = 'network';
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player .pn')).toHaveText('Zezima · 2 quests done');   // no quest points known
    expect(await stored(page, 'player')).toMatchObject({ source: 'RuneMetrics', levels: { magic: 80, herblore: 60 } });
  });

  test('the game says there is no such player: it says so, and asks nothing more', async ({ page, wiki }) => {
    wiki.player['playerData/Nobody'] = { status: 404, json: { error: 'PLAYER_NOT_FOUND' } };
    wiki.setPlayer('Nobody', { 'Imp Catcher': 'COMPLETED' }, {});   // RuneMetrics would find something
    await openApp(page, expect);
    await lookUp(page, 'Nobody');
    await expect(page.locator('#player-msg')).toHaveText('Found no player called “Nobody”. Check the spelling.');
    expect(wiki.playerCalls).toHaveLength(1);
  });

  test('an answer without quests is not used', async ({ page, wiki }) => {
    zezima(wiki);
    wiki.player['playerData/Zezima'] = { json: { name: 'Zezima', error: 'INTERNAL_ERROR' } };
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('2 quests done');
    expect((await stored(page, 'player')).source).toBe('RuneMetrics');
  });

  test('the quest points go out in an export and come back', async ({ page, wiki }) => {
    wiki.setPlayerData('Zezima', QUESTS, { magic: 81 });
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('235 QP');
    const p = await stored(page, 'player');
    await page.evaluate(() => localStorage.removeItem('qg1.player'));
    await page.reload();
    await openSettings(page);
    await page.getByRole('button', { name: 'Import state' }).click();
    await page.locator('#bk-text').fill(JSON.stringify({ app: 'Quick Guide', format: 2, player: p }));
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    expect(await stored(page, 'player')).toMatchObject({ name: 'Zezima', qp: 235, qpMax: 476, source: 'Player Data' });
  });
});

test.describe('your own ticks and the player data together', () => {
  test('a quest you ticked halfway that the game says is done counts as done', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', { 'While Guthix Sleeps': 'COMPLETED' }, {});
    await seed(page, { meta: { [WGS]: { title: 'While Guthix Sleeps', done: 3, total: 12, at: 1 } } });
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await closeSettings(page);
    await expect(row(page, 'While Guthix Sleeps')).toHaveClass(/\bdone\b/);
    await expect(row(page, 'While Guthix Sleeps').locator('.qs.ok')).toHaveText('✓ 3 / 12');
    await expect(page.locator('.ghb .n')).not.toContainText(['In progress']);
  });

  test('a quest you are ticking stays in progress, with its bar', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', { 'While Guthix Sleeps': 'STARTED' }, {});
    await seed(page, { meta: { [WGS]: { title: 'While Guthix Sleeps', done: 3, total: 12, at: 1 } } });
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await closeSettings(page);
    await expect(row(page, 'While Guthix Sleeps').locator('.qs')).toHaveText('3 / 12');
    await expect(row(page, 'While Guthix Sleeps').locator('progress')).toHaveCount(1);
  });
});

test.describe('inside a quest', () => {
  test.beforeEach(async ({ page, wiki }) => {
    zezima(wiki);
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('2 quests done');
    await openQuest(page, expect, 'While Guthix Sleeps');
  });

  test('skills show your level: enough, too low, or unknown', async ({ page }) => {
    const chips = ov(page, 'skills').locator('ul.skl-list li');
    await expect(chips.nth(0)).toHaveClass(/\bok\b/);          // Magic 75, you have 80: a green tick
    await expect(chips.nth(0).locator('.mk.ok')).toHaveCount(1);
    await expect(chips.nth(1)).toHaveClass(/\blow\b/);         // Herblore 65, you have 60: a red cross, your level in its tooltip
    await expect(chips.nth(1).locator('.mk.no')).toHaveAttribute('title', 'Too low: you have 60');
    await expect(chips.nth(2)).not.toHaveClass(/\b(ok|low)\b/); // Hunter: no data, no mark
    await expect(chips.nth(2).locator('.mk')).toHaveCount(0);
    await expect(page.locator('[data-ovc="skills"]')).toHaveText('1 too low');
  });

  test('the quest tree ticks the quests you have done', async ({ page }) => {
    const tree = ov(page, 'details').locator('details.acc', { hasText: 'Quest tree' });
    await expect(tree.locator('summary .m')).toHaveText('1 / 4 done');
    await tree.locator('summary').click();
    await expect(tree.locator('.tree li').nth(0)).toHaveClass(/\bgot\b/);
    await expect(tree.locator('.tree li').nth(0)).toHaveText('Defender of Varrock');
    await expect(tree.locator('.tree li').nth(0).locator('.mk.ok')).toHaveCSS('color', 'rgb(102, 211, 92)');
    // one you have not done: a red cross
    await expect(tree.locator('.tree li').nth(1)).not.toHaveClass(/\bgot\b/);
    await expect(tree.locator('.tree li').nth(1).locator('.mk.ok')).toHaveCount(0);
    await expect(tree.locator('.tree li').nth(1).locator('.mk.no')).toHaveAttribute('title', 'Not done yet');
    await expect(tree.locator('.tree li').nth(1).locator('.mk.no')).toHaveCSS('color', 'rgb(255, 91, 73)');
    // bullets, and a quest needed for another sits one step further in
    await expect(tree.locator('.tree')).toHaveCSS('list-style-type', 'disc');
  });

  test('without a player, nothing extra shows', async ({ page }) => {
    await page.getByRole('button', { name: 'All quests' }).click();
    await openSettings(page);
    await page.getByRole('button', { name: 'Forget this player' }).click();
    await openQuest(page, expect, 'While Guthix Sleeps');
    await expect(ov(page, 'skills').locator('.you')).toHaveCount(0);
    await expect(page.locator('[data-ovc="skills"]')).toHaveText('4');
    await expect(ov(page, 'details').locator('details.acc', { hasText: 'Quest tree' }).locator('summary .m')).toHaveText('4 entries');
  });
});
