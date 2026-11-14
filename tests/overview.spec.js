// The Overview tab: Details, Skills, Enemies and Rewards.
const { test, expect, stored, openQuest } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
const ov = (page, id) => page.locator('section[data-ov="' + id + '"]');
const head = (page, id) => page.locator('[data-ov-btn="' + id + '"]');
const body = (page, id) => ov(page, id).locator('.secb');
const box = (scope, label) => scope.locator('details.acc').filter({ has: scope.page().locator('summary .sl', { hasText: label }) });

test('four parts, in order, all open at first, with counts', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await expect(page.locator('[data-ov-btn] .n')).toHaveText(['Details', 'Skills', 'Enemies', 'Rewards']);
  for (const id of ['details', 'skills', 'enemies', 'rewards']) {
    await expect(head(page, id)).toHaveAttribute('aria-expanded', 'true');
    await expect(body(page, id)).toBeVisible();
  }
  await expect(page.locator('[data-ovc]')).toHaveText(['', '4', '3', '3']);
  await expect(page.locator('section[data-ov="items"]')).toHaveCount(0);
});

test('a part you close stays closed; the others stay open', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await head(page, 'skills').click();
  await expect(head(page, 'skills')).toHaveAttribute('aria-expanded', 'false');
  await expect(body(page, 'skills')).toBeHidden();
  expect((await stored(page, 'prog.' + WGS)).open).toEqual({ 'ov:skills': false });
  await page.reload();
  await expect(body(page, 'skills')).toBeHidden();
  await expect(body(page, 'details')).toBeVisible();
  await head(page, 'skills').click();
  await expect(body(page, 'skills')).toBeVisible();
});

test('reset progress opens all parts again', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  await head(page, 'enemies').click();
  await page.locator('#menu-btn').click();
  await page.locator('[data-act="reset"]').click();
  await page.locator('[data-act="reset"]').click();
  await expect(body(page, 'enemies')).toBeVisible();
});

test('parts with nothing in them are left out', async ({ page }) => {
  await openQuest(page, expect, "Cook's Assistant");
  await expect(page.locator('[data-ov-btn] .n')).toHaveText(['Details', 'Rewards']);
});

test.describe('details', () => {
  test('facts, start map, description, quests and more', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    const d = body(page, 'details');
    await expect(d.locator('.kv').first().locator('dt')).toHaveText(['Start', 'Members', 'Length', 'Difficulty']);
    await expect(d.locator('.kv').first().locator('dd')).toHaveText(["Talk to Radimus Erkle in the Legends' Guild, north-east Ardougne.", 'Yes', 'Very, Very Long', 'Grandmaster']);
    await expect(d.locator('dd a', { hasText: 'Radimus Erkle' })).toHaveAttribute('href', 'https://runescape.wiki/w/Radimus_Erkle');
    const map = box(d, 'Map: Start point');
    await expect(map).toHaveCount(1);
    await expect(map).toHaveAttribute('open', '');
    await expect(map.locator('.leaflet-container')).toBeVisible();
    await expect(d.locator('.para', { hasText: 'Find out what Lucien' })).toBeVisible();
    await expect(d.locator('.bh')).toHaveText(['Quests', 'Other']);
    const tree = box(d, 'Quest tree');
    await expect(tree.locator('summary .m')).toHaveText('4 entries');
    await expect(tree.locator('.tree li')).toHaveText(['Defender of Varrock', 'Shield of Arrav', "The Knight's Sword", 'The Hand in the Sand']);
    await expect(tree.locator('.tree li').nth(1)).toHaveCSS('padding-left', '16px');
    await expect(d.locator('.para', { hasText: 'Story only' })).toHaveText('Story only, not required: Nature Spirit, Priest in Peril, The Restless Ghost.');
    await expect(d.locator('.kv.wide dt')).toHaveText(['League region required', 'League auto-complete', 'Ironman concerns']);
    await expect(d.locator('.kv.wide dd').last()).toHaveText('Bring a Spade spade & logs.');
    await expect(d.locator('.para', { hasText: 'short version' })).toHaveText('This is the short version of the guide.');
    await expect(d.locator('a.xl')).toHaveAttribute('href', 'https://runescape.wiki/w/While_Guthix_Sleeps');
    await expect(d.locator('.foot')).toContainText('Guide text: RuneScape Wiki, CC BY-NC-SA 3.0. Loaded ');
  });

  test('a free quest that needs no other quests', async ({ page }) => {
    await openQuest(page, expect, "Cook's Assistant");
    const d = body(page, 'details');
    await expect(d.locator('dd').nth(1)).toHaveText('No, free to play');
    await expect(d.locator('.para', { hasText: 'No quests' })).toHaveText('No quests needed first.');
  });

  test('a quest page without a quick guide says so, and links to its page', async ({ page }) => {
    await openQuest(page, expect, 'Rune Mysteries');
    const d = body(page, 'details');
    await expect(d.locator('.note')).toHaveText('This quest has no Quick guide on the wiki, so this is its full page.');
    await expect(d.locator('a.xl')).toHaveAttribute('href', 'https://runescape.wiki/w/Rune_Mysteries');
  });
});

test('skills: levels, notes and other needs', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  const s = body(page, 'skills');
  await expect(s.locator('.chip')).toHaveText(['75Magic', '65Herblore (boostable)', '55Hunter']);
  await expect(s.locator('.chip b').first()).toHaveText('75');
  await expect(s.locator('.bh')).toHaveText(['Skill levels', 'Also needed']);
  await expect(s.locator('.para')).toHaveText("Entry to the Warriors' Guild");
});

test('enemies: how many, name, level and notes', async ({ page }) => {
  await openQuest(page, expect, 'While Guthix Sleeps');
  const e = body(page, 'enemies');
  await expect(e.locator('.bh')).toHaveText('Enemies to defeat');
  await expect(e.locator('.foes li .nm')).toHaveText(['2 × Assassin', 'Balance Elemental', '2 × Tormented demons (your stats are boosted)']);
  await expect(e.locator('.foes li .lv')).toHaveText(['lvl 42', 'lvl 117', 'lvl 119']);
});

test.describe('rewards', () => {
  test('list, notes and boxes', async ({ page, tiles }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    const r = body(page, 'rewards');
    await expect(r.locator('.plain').first().locator(':scope > li')).toHaveText(['5 quest points', '5,000 coins', '4 × 100,000 XP from Idriain skills at level 65 or higher']);
    await expect(r.locator('.alt')).toHaveText('in skills at level 65 or higher');
    await expect(r.locator('.para')).toHaveText('The rewards are given when you finish.');
    await expect(r.locator('details.acc summary .sl')).toHaveText(['Quest complete scroll', 'Music unlocked', 'Achievements', 'Needed for later quests']);
    await expect(r.locator('details.acc summary .m')).toHaveText(['2 tracks', '1', '2 direct · 1 more']);
    for (const d of await r.locator('details.acc').all()) expect(await d.getAttribute('open')).toBe('');
    const music = box(r, 'Music unlocked');
    await expect(music.locator('li')).toHaveText(["Dangerous Logic (Movario's base)", 'The Sound of Guthix']);
    const later = box(r, 'Needed for later quests');
    await expect(later.locator('.why')).toHaveText(['Directly:', 'Indirectly:']);
    await expect(later.locator('li')).toHaveText(["Nomad's Elegy", 'Ritual of the Mahjarrat', 'Fate of the Gods']);
    const pic = box(r, 'Quest complete scroll');
    await expect(pic.locator('img')).toHaveAttribute('src', 'https://runescape.wiki/images/While_Guthix_Sleeps_reward.png');
    await expect(pic.locator('a.imgl')).toHaveAttribute('href', 'https://runescape.wiki/w/File:While_Guthix_Sleeps_reward.png');
  });

  test('boxes start open; one you close stays closed after a reload', async ({ page }) => {
    await openQuest(page, expect, 'While Guthix Sleeps');
    await box(body(page, 'rewards'), 'Music unlocked').locator('summary').click();
    await expect.poll(async () => Object.values((await stored(page, 'prog.' + WGS)).acc)).toEqual([0]);
    await page.reload();
    await expect(box(body(page, 'rewards'), 'Music unlocked')).not.toHaveAttribute('open', '');
    await expect(box(body(page, 'rewards'), 'Achievements')).toHaveAttribute('open', '');
    // and open it again
    await box(body(page, 'rewards'), 'Music unlocked').locator('summary').click();
    await expect.poll(async () => Object.values((await stored(page, 'prog.' + WGS)).acc)).toEqual([1]);
  });
});
