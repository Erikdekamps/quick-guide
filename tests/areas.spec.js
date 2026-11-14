// Area Tasks: the wiki's "<Area> achievements" pages, read into tiers of tasks you tick off.
const { test, expect, fixture, seed, stored, openApp, openCog, closeCog, lookUp, toggle, areaPage } = require('./support/app');

const W = 'https://runescape.wiki/w/';
const AREAS = ['Ardougne', 'Daemonheim', 'Desert', 'Falador', 'Fremennik', 'Karamja', 'Lumbridge', 'Morytania', "Seers' Village", 'Tirannwn', 'Underworld', 'Varrock', 'Wilderness'];
const area = (page, name, tier) => page.locator('.q[data-area="' + name + '"]' + (tier ? '[data-atier="' + tier + '"]' : ''));
const tierRows = (page, name) => page.locator('.ghb[data-group="' + name + '"]').locator('xpath=../following-sibling::ul[1]').locator('.q1 b');
const task = (page, id) => page.locator('li[data-task="' + id + '"]');
const sec = (page, id) => page.locator('section[data-asec="' + id + '"]');

function withAreas(wiki) {
  wiki.page('Ardougne achievements', fixture('ardougne-achievements.html'));
  wiki.page('Lumbridge achievements', fixture('lumbridge-achievements.html'));
  return wiki;
}
// All 13 areas: Ardougne and Lumbridge are real pages, Varrock is an excerpt, the rest have one small task each.
function withAllAreas(wiki) {
  withAreas(wiki).page('Varrock achievements', fixture('varrock-excerpt.html'));
  AREAS.filter((n) => !['Ardougne', 'Lumbridge', 'Varrock'].includes(n)).forEach((n, i) => {
    wiki.page(n + ' achievements', areaPage([{ name: 'Easy', tasks: [{ id: 5000 + i, name: n + ' filler task', desc: 'A task in ' + n + '.' }] }]));
  });
  return wiki;
}
async function areasTab(page) {
  await openApp(page, expect);
  await page.locator('.tab[data-home="areas"]').click();
  await expect(page.locator('#qcount')).toHaveText('13 areas');
}
async function openArea(page, name) {
  await areasTab(page);
  await area(page, name).first().click();
  await expect(page.locator('h1.qt')).toHaveText(name);
}

test.describe('reading an area page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/__blank');
    await page.addScriptTag({ url: '/parser.js' });
  });
  const parse = (page, file, name) => page.evaluate(([h, n]) => window.QuickGuide.parseArea('<div class="mw-parser-output">' + h + '</div>', n), [fixture(file), name]);

  test('the list of areas and their tiers', async ({ page }) => {
    const a = await page.evaluate(() => window.QuickGuide.AREAS);
    expect(a.map((x) => x.name)).toEqual(AREAS);
    expect(a.find((x) => x.name === 'Lumbridge').tiers).toEqual(['Beginner', 'Easy', 'Medium', 'Hard']);
    expect(a.find((x) => x.name === 'Varrock').tiers).toEqual(['Easy', 'Medium', 'Hard', 'Elite']);
  });

  test('tiers, with their tasks', async ({ page }) => {
    const a = await parse(page, 'ardougne-achievements.html', 'Ardougne');
    expect(a).toMatchObject({ name: 'Ardougne', page: 'Ardougne achievements', source: W + 'Ardougne_achievements' });
    expect(a.tiers.map((t) => [t.id, t.name, t.tasks.length])).toEqual([['easy', 'Easy', 23], ['medium', 'Medium', 16], ['hard', 'Hard', 17], ['elite', 'Elite', 5]]);
    const l = await parse(page, 'lumbridge-achievements.html', 'Lumbridge');
    expect(l.tiers.map((t) => [t.name, t.tasks.length])).toEqual([['Beginner', 24], ['Easy', 19], ['Medium', 12], ['Hard', 7]]);
  });

  test('what a tier needs: levels, quests, items and Ironman notes', async ({ page }) => {
    const e = (await parse(page, 'ardougne-achievements.html', 'Ardougne')).tiers[0];
    expect(e.skills).toEqual([{ skill: 'Thieving', level: 16 }, { skill: 'Construction', level: 10 }]);
    expect(e.quests).toEqual(['Biohazard', "Gertrude's Cat", "Monk's Friend", 'Plague City', 'Tower of Life']);
    expect(e.items.length).toBeGreaterThan(2);
    expect(e.items[0].replace(/<[^>]+>/g, '')).toBe('Around 350 coins');
    expect(e.ironman).toContain('emerald ring');
    expect(e.ironman).not.toContain('<img');
  });

  test('a task: name, what to do, what it needs, and how', async ({ page }) => {
    const t = (await parse(page, 'ardougne-achievements.html', 'Ardougne')).tiers[0].tasks;
    expect(t[0]).toMatchObject({ id: '447', name: 'The Essence of Magic', desc: 'Have Wizard Cromperty teleport you to the essence mine.', skills: [], quests: [], other: [] });
    expect(t[0].notes).toContain('<a href="' + W + 'Wizard_Cromperty" target="_blank" rel="noopener">Wizard Cromperty</a>');
    expect(t[1]).toMatchObject({ id: '448', name: 'Yoink!', skills: [{ skill: 'Thieving', level: 5 }] });
    expect(t[2].notes).toContain('offering a price of 120');
    expect(t[3]).toMatchObject({ name: 'Preaching to the Infected', quests: ['Plague City'] });
    // ids are unique in an area
    const all = (await parse(page, 'ardougne-achievements.html', 'Ardougne')).tiers.flatMap((x) => x.tasks.map((y) => y.id));
    expect(new Set(all).size).toBe(all.length);
  });

  test('a tier reward: who gives it, what you get, and what it does', async ({ page }) => {
    const a = await parse(page, 'ardougne-achievements.html', 'Ardougne');
    const r = a.tiers[0].reward;
    expect(r.intro).toContain('Doctor Orbon');
    expect(r.items.map((x) => x.replace(/<[^>]+>/g, ''))).toContain('Ardougne cloak 1, which grants the following bonuses:');
    expect(r.perks).toContain('Unlimited teleports to the Ardougne Monastery');
    // each tier shows its own cloak's perks
    expect(a.tiers[1].reward.perks.join(' ')).toContain('Manor Farm');
    expect(a.tiers[1].reward.perks).not.toContain('Unlimited teleports to the Ardougne Monastery');
  });

  test('a numbered list in a task becomes its sub-steps', async ({ page }) => {
    const v = await parse(page, 'varrock-excerpt.html', 'Varrock');
    expect(v.tiers.map((t) => t.name)).toEqual(['Easy', 'Elite']);
    const red = v.tiers[1].tasks.find((t) => t.name === 'Red, Red Pies of Summer');
    expect(red.id).toBe('993');
    expect(red.subs.map((x) => x.id)).toEqual(['993:1', '993:2', '993:3', '993:4']);
    expect(red.subs.map((x) => x.html.replace(/<[^>]+>/g, ''))).toEqual([
      'Make pastry dough by mixing a pot of flour with water by using the pot of flour on the pump and drain.',
      'Use the pastry dough on a pie dish.',
      'Add a strawberry, watermelon, and cooking apple to the shell (in that order).',
      'Bake the raw summer pie.'
    ]);
    // a line under a step is a note for that step, not another step
    expect(red.subs[0].notes).toEqual([]);
    expect(red.subs[2].notes).toEqual(['The cooking apple can be found in the Guild, the rest needs to be brought from outside.']);
    expect(red.subs[3].notes).toHaveLength(2);
    // the tip keeps the intro and the items to bring, but not the steps again
    expect(red.notes).toContain('by following the steps below');
    expect(red.notes).toContain('Required items');
    expect(red.notes).toContain('Pot of flour');
    expect(red.notes).not.toContain('pastry dough');
  });

  test('only a list of two or more steps counts; a bulleted list stays a note', async ({ page }) => {
    const t = (await parse(page, 'varrock-excerpt.html', 'Varrock'));
    const dog = t.tiers[0].tasks[0];
    expect(dog.subs).toEqual([]);
    expect(dog.notes).toContain('Any bones will do.');
    const one = t.tiers[1].tasks.find((x) => x.name === 'Pie in the Sky');
    expect(one.subs).toEqual([]);
    expect(one.notes).toContain('Only one step here.');
  });

  test('a real task with steps: You\'re the Dirty Rascal', async ({ page }) => {
    const a = await parse(page, 'ardougne-achievements.html', 'Ardougne');
    const t = a.tiers.flatMap((x) => x.tasks).find((x) => x.name === "You're the Dirty Rascal");
    expect(t.subs.length).toBeGreaterThanOrEqual(3);
    expect(t.subs[0].html).toContain('Go to the Castle Wars lobby');
    expect(t.notes).toContain('A draw will not count');
    // the tasks with a bulleted list keep it as a note
    const cat = a.tiers.flatMap((x) => x.tasks).find((x) => x.name === 'A Cat is For Life...');
    expect(cat.subs).toEqual([]);
    expect(cat.notes).toContain('Hellcats');
  });

  test('a page that is not an area page', async ({ page }) => {
    const r = await page.evaluate(() => { try { window.QuickGuide.parseArea('<div class="mw-parser-output"><p>Nothing.</p></div>', 'X'); return 'no error'; } catch (e) { return e.code; } });
    expect(r).toBe('format');
  });
});

test.describe('the area list', () => {
  test('a row for each tier of the 13 areas, grouped by area, and the tab is remembered', async ({ page, wiki }) => {
    await openApp(page, expect);
    await expect(page.locator('.tab[data-home]')).toHaveText(['Quests', 'Area tasks']);
    await expect(page.locator('.tab[data-home="quests"]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('.tab[data-home="areas"]').click();
    await expect(page.locator('.tab[data-home="areas"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#qcount')).toHaveText('13 areas');
    await expect(page.locator('.ghb .n')).toHaveText(AREAS);
    await expect(tierRows(page, 'Ardougne')).toHaveText(['Ardougne Easy', 'Ardougne Medium', 'Ardougne Hard', 'Ardougne Elite']);
    await expect(tierRows(page, 'Lumbridge')).toHaveText(['Lumbridge Beginner', 'Lumbridge Easy', 'Lumbridge Medium', 'Lumbridge Hard']);
    await expect(page.locator('#quest-link')).toHaveAttribute('placeholder', 'Search areas and tasks');
    expect(wiki.asked()).toEqual(['List of quests']);   // no area pages yet
    expect((await stored(page, 'settings')).home).toBe('areas');
    await page.reload();
    await expect(page.locator('#qcount')).toHaveText('13 areas');
  });

  test('a row opens that area at that tier', async ({ page, wiki }) => {
    withAreas(wiki);
    await areasTab(page);
    await area(page, 'Ardougne', 'hard').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await expect(page.locator('.tab[data-tier="hard"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('a tier you started goes first, with its own progress bar', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    // Easy is untouched; Medium is where the ticks are
    await page.locator('.tab[data-tier="medium"]').click();
    await page.locator('#next-btn').click();
    await page.locator('#next-btn').click();
    await page.getByRole('button', { name: 'All areas' }).click();
    await expect(page.locator('.ghb .n').first()).toHaveText('In progress');
    const row = area(page, 'Ardougne', 'medium');
    await expect(row.locator('.q1 b')).toHaveText('Ardougne Medium');
    await expect(row.locator('.qs')).toHaveText('2 / 16');
    await expect(row.locator('progress')).toHaveJSProperty('value', 2);
    await expect(row.locator('progress')).toHaveJSProperty('max', 16);
    await expect(row).toHaveCSS('color', 'rgb(236, 230, 218)');
    await expect(row.locator('.q1 b')).toHaveCSS('color', 'rgb(245, 225, 90)');
    // it shows once: not again in its area
    await expect(tierRows(page, 'Ardougne')).toHaveText(['Ardougne Easy', 'Ardougne Hard', 'Ardougne Elite']);
    // tiers that were never touched have no bar and no count of their own
    await expect(area(page, 'Ardougne', 'easy').locator('progress')).toHaveCount(0);
    await expect(area(page, 'Ardougne', 'easy').locator('.q2')).toHaveText('23 tasks');
  });

  test('a finished tier is green, and "Hide completed" hides it', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    const ids = await page.locator('li[data-task]').evaluateAll((l) => l.map((x) => x.getAttribute('data-task')));
    const ticks = {}; ids.forEach((i) => { ticks[i] = 1; });
    await page.evaluate((t) => localStorage.setItem('qg1.aprog.Ardougne', JSON.stringify({ tasks: t, tier: 'easy' })), ticks);
    await page.reload();
    await expect(page.locator('#pg-cnt')).toHaveText('23 / 23 tasks');
    await expect(page.locator('#next-btn')).toHaveText('All tasks done');
    await page.getByRole('button', { name: 'All areas' }).click();
    const row = area(page, 'Ardougne', 'easy');
    await expect(row).toHaveClass(/\bdone\b/);
    await expect(row.locator('.qs')).toHaveText('✓ Done');
    await toggle(page, 'Hide completed');
    await expect(area(page, 'Ardougne', 'easy')).toHaveCount(0);
    await expect(area(page, 'Ardougne', 'medium')).toHaveCount(1);
    await toggle(page, 'Hide completed');
    await expect(area(page, 'Ardougne', 'easy')).toHaveCount(1);
  });

  test('a tier you cannot do yet is grayed out and says Locked; "Hide locked" hides it', async ({ page, wiki }) => {
    withAreas(wiki).setPlayer('Zezima', {}, { 18: 3 });   // Thieving 3; Ardougne Easy needs 16
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeCog(page);
    await page.locator('.tab[data-home="areas"]').click();
    await area(page, 'Ardougne', 'easy').click();
    await page.getByRole('button', { name: 'All areas' }).click();
    const row = area(page, 'Ardougne', 'easy');
    await expect(row).toHaveClass(/\blocked\b/);
    await expect(row.locator('.qs')).toHaveText('Locked');
    // tiers of an area you never opened: nothing is known yet
    await expect(area(page, 'Desert', 'easy')).not.toHaveClass(/\blocked\b/);
    await toggle(page, 'Hide locked');
    await expect(area(page, 'Ardougne', 'easy')).toHaveCount(0);
    await expect(area(page, 'Desert', 'easy')).toHaveCount(1);
  });

  test('opening an area keeps what each tier needs, for the list', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    const m = (await stored(page, 'ameta')).Ardougne;
    expect(m.tiers.map((t) => [t.id, t.total, t.done])).toEqual([['easy', 23, 0], ['medium', 16, 0], ['hard', 17, 0], ['elite', 5, 0]]);
    expect(m.tiers[0].needs.skills).toEqual([{ skill: 'Thieving', level: 16 }, { skill: 'Construction', level: 10 }]);
    expect(m.tiers[0].needs.quests).toContain('Biohazard');
  });
});

test.describe('searching the area tasks', () => {
  async function search(page, text) {
    await page.locator('#quest-link').fill(text);
  }
  const taskRows = (page) => page.locator('#qarea li[data-task]');

  test('typing reads the other areas once, so every task can be found', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await areasTab(page);
    await search(page, 'yoink');
    await expect(taskRows(page)).toHaveCount(1);
    await expect(page.locator('#qarea .state')).toHaveCount(0);   // all areas are read
    expect(wiki.asked().filter((x) => / achievements$/.test(x)).sort()).toEqual(AREAS.map((n) => n + ' achievements').sort());
    expect((await stored(page, 'aidx')).Ardougne.tiers[0].tasks[1]).toEqual({ id: '448', name: 'Yoink!', subs: [] });
    // searching again, or opening an area, does not read the wiki again
    await search(page, 'silky');
    await expect(taskRows(page)).toHaveCount(1);
    await search(page, '');
    await area(page, 'Ardougne', 'easy').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    expect(wiki.asked().filter((x) => x === 'Ardougne achievements')).toHaveLength(1);
  });

  test('a task is found by its name, with its area and tier, and ticked right there', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await areasTab(page);
    await search(page, 'yoink');
    const row = taskRows(page).first();
    await expect(row.locator('.t')).toContainText('Yoink!');
    await expect(row.locator('.where')).toHaveText('Ardougne Easy');
    await expect(page.locator('#qcount')).toHaveText('0 of 13 areas');
    await row.locator('.t').click();
    await expect(row.locator('.cb')).toBeChecked();
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1 });
    // a done task stays in the results, ticked
    await search(page, 'yoin');
    await expect(taskRows(page).first().locator('.cb')).toBeChecked();
    // and the list shows the progress
    await search(page, '');
    await expect(area(page, 'Ardougne', 'easy').locator('.qs')).toHaveText('1 / 23');
    expect((await stored(page, 'ameta')).Ardougne.tiers[0]).toMatchObject({ done: 1, total: 23 });
    // untick
    await search(page, 'yoink');
    await taskRows(page).first().locator('.t').click();
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({});
  });

  test('only names are searched, not the descriptions', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await areasTab(page);
    await search(page, 'castle wars');   // in descriptions, not in a name
    await expect(page.locator('#qarea .empty')).toHaveText('Nothing matches “castle wars”.');
    await search(page, 'waiting game');
    await expect(taskRows(page).first().locator('.t')).toContainText('Playing the Waiting Game');
  });

  test('an area and tier name finds the tier rows', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await areasTab(page);
    await search(page, 'ardougne hard');
    await expect(page.locator('#qarea .q .q1 b')).toHaveText(['Ardougne Hard']);
    await expect(page.locator('#qcount')).toHaveText('1 of 13 areas');
    await search(page, 'ardougne');
    await expect(page.locator('#qarea .q .q1 b')).toHaveText(['Ardougne Easy', 'Ardougne Medium', 'Ardougne Hard', 'Ardougne Elite']);
  });

  test('a task with steps: ticking it in the results ticks all its steps', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await areasTab(page);
    await search(page, 'red, red');
    await expect(taskRows(page)).toHaveCount(1);
    await expect(taskRows(page).first().locator('.where')).toHaveText('Varrock Elite');
    await taskRows(page).first().locator('.t').click();
    expect((await stored(page, 'aprog.Varrock')).tasks).toEqual({ '993:1': 1, '993:2': 1, '993:3': 1, '993:4': 1, 993: 1 });
  });

  test('the area and tier in a result open that area at that tier', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await areasTab(page);
    await search(page, 'red, red');
    await taskRows(page).first().locator('.where').click();
    await expect(page.locator('h1.qt')).toHaveText('Varrock');
    await expect(page.locator('.tab[data-tier="elite"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Enter opens the first match', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await areasTab(page);
    await search(page, 'ardougne medium');
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await expect(page.locator('.tab[data-tier="medium"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('says when some areas could not be read, and tries again', async ({ page, wiki }) => {
    withAllAreas(wiki).fail('Desert achievements', 'http');
    await areasTab(page);
    await search(page, 'yoink');
    await expect(page.locator('#qarea .err')).toContainText('Could not read 1 area (Desert)');
    await expect(taskRows(page)).toHaveCount(1);   // the others still work
    wiki.page('Desert achievements', areaPage([{ name: 'Easy', tasks: [{ id: 6000, name: 'Sand castle', desc: 'Build one.' }] }]));
    await page.locator('[data-act="areas-retry"]').click();
    await search(page, 'sand castle');
    await expect(taskRows(page)).toHaveCount(1);
  });

  test('shows how far the reading is', async ({ page, wiki }) => {
    withAllAreas(wiki).fail('Desert achievements', 'slow');
    await areasTab(page);
    await search(page, 'yoink');
    await expect(page.locator('#qarea .state')).toContainText('Reading the areas so their tasks can be searched');
    await expect(taskRows(page)).toHaveCount(1);   // what is read already can be searched
  });
});

test.describe('an area', () => {
  test('opens from the wiki once, then from storage', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    expect(wiki.asked()).toEqual(['List of quests', 'Ardougne achievements']);
    expect((await stored(page, 'area.Ardougne')).tiers).toHaveLength(4);
    expect(await stored(page, 'last')).toBe('area:Ardougne');
    await page.reload();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await page.getByRole('button', { name: 'All areas' }).click();
    await area(page, 'Ardougne').first().click();
    expect(wiki.asked().filter((x) => x === 'Ardougne achievements')).toHaveLength(1);
  });

  test('says when the wiki fails', async ({ page, wiki }) => {
    wiki.fail('Desert achievements', 'http');
    await areasTab(page);
    await area(page, 'Desert').first().click();
    await expect(page.locator('#load-err')).toHaveText('The wiki answered with error 500. Try again in a moment.');
  });

  test('a tab per tier; the tier is remembered', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    await expect(page.locator('.tab[data-tier]')).toHaveText(['Easy', 'Medium', 'Hard', 'Elite']);
    await expect(page.locator('.tab[data-tier="easy"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 23 tasks');
    await page.locator('.tab[data-tier="medium"]').click();
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 16 tasks');
    await expect(task(page, '470')).toBeVisible();
    expect((await stored(page, 'aprog.Ardougne')).tier).toBe('medium');
    await page.reload();
    await expect(page.locator('.tab[data-tier="medium"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Needs: levels, quests, items and Ironman notes', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    const n = sec(page, 'needs');
    // levels are one line each, like the quests: "16 Thieving", not two columns of boxes
    await expect(n.locator('.chip')).toHaveCount(0);
    await expect(n.locator('ul.askill li')).toHaveText(['16 Thieving', '10 Construction']);
    await expect(n.locator('ul.askill li').first()).toHaveCSS('width', await n.locator('ul.askill').evaluate((e) => getComputedStyle(e).width));
    await expect(n.locator('.tree:not(.askill) li')).toHaveText(['Biohazard', "Gertrude's Cat", "Monk's Friend", 'Plague City', 'Tower of Life']);
    await expect(n.locator('details.acc summary .sl')).toHaveText(['Items to bring', 'Ironmen']);
    await expect(n.locator('details.acc', { hasText: 'Ironmen' })).not.toHaveAttribute('open', '');
    await expect(n.locator('details.acc', { hasText: 'Items to bring' }).locator('li').first()).toHaveText('Around 350 coins');
  });

  test('Needs with a player: your levels and quests', async ({ page, wiki }) => {
    withAreas(wiki).setPlayer('Zezima', { Biohazard: 'COMPLETED', 'Plague City': 'COMPLETED' }, { 18: 3, 23: 40 });   // Thieving 3, Construction 40
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeCog(page);
    await page.locator('.tab[data-home="areas"]').click();
    await area(page, 'Ardougne').first().click();
    const n = sec(page, 'needs');
    await expect(n.locator('ul.askill li')).toHaveText(['16 Thieving (you: 3)', '10 Construction ✓']);
    await expect(n.locator('ul.askill li').nth(0)).toHaveClass(/\blow\b/);
    await expect(n.locator('ul.askill li').nth(1)).toHaveClass(/\bgot\b/);
    await expect(n.locator('.sech .c')).toHaveText('1 too low');
    await expect(n.locator('.tree:not(.askill) li.got')).toHaveText(['✓ Biohazard', '✓ Plague City']);
    // a task that needs more than you have says so
    await expect(task(page, '448').locator('.need')).toHaveText('Needs 5 Thieving (you: 3)');
    await expect(task(page, '448').locator('.need')).toHaveClass(/\blow\b/);
    await expect(task(page, '450').locator('.need')).toHaveText('Needs Plague City ✓');
  });

  test('a quest in Needs opens that quest', async ({ page, wiki }) => {
    withAreas(wiki).page('Biohazard/Quick guide', fixture('cooks-assistant.html'));
    await openArea(page, 'Ardougne');
    await sec(page, 'needs').getByRole('button', { name: 'Biohazard' }).click();
    await expect(page.locator('h1.qt')).toHaveText('Biohazard');
  });

  test('tasks: name, what to do, and how, as part of the task', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    const t = task(page, '449');
    await expect(t.locator('.t')).toHaveText('Silky Smooth — Sell silk to the silk trader in Ardougne for 60gp each by haggling.');
    await expect(t.locator('details')).toHaveCount(0);
    await expect(t.locator('.howto')).toBeVisible();
    await expect(t.locator('.howto')).toContainText('offering a price of 120');
    await expect(sec(page, 'tasks').locator('.sech .c')).toHaveText('0 / 23');
  });

  test('Needs and Tasks fold shut and open again, and stay that way', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    for (const id of ['needs', 'tasks']) {
      const head = sec(page, id).locator('.sech');
      await expect(head).toHaveAttribute('aria-expanded', 'true');
      await head.click();
      await expect(head).toHaveAttribute('aria-expanded', 'false');
      await expect(sec(page, id).locator('.secb')).toBeHidden();
    }
    await page.reload();
    await expect(sec(page, 'tasks').locator('.secb')).toBeHidden();
    await sec(page, 'tasks').locator('.sech').click();
    await expect(sec(page, 'tasks').locator('.secb')).toBeVisible();
    // each tier has its own
    await page.locator('.tab[data-tier="medium"]').click();
    await expect(sec(page, 'needs').locator('.secb')).toBeVisible();
  });

  test('a finished tier folds its tasks shut; open them to see and untick them', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    await page.locator('.tab[data-tier="elite"]').click();
    for (let i = 0; i < 5; i++) await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('5 / 5 tasks');
    const tasks = sec(page, 'tasks');
    await expect(tasks.locator('.sech')).toHaveAttribute('aria-expanded', 'false');
    await expect(tasks.locator('.sech')).toHaveClass(/\bdone\b/);
    await expect(tasks.locator('.sech .c')).toHaveText('✓ 5 / 5');
    await tasks.locator('.sech').click();
    await expect(tasks.locator('li[data-task]')).toHaveCount(5);
    for (const li of await tasks.locator('li[data-task]').all()) await expect(li).toBeVisible();
    await tasks.locator('li[data-task] .cb').first().click();
    await expect(page.locator('#pg-cnt')).toHaveText('4 / 5 tasks');
  });

  test.describe('sub-steps', () => {
    const open = async (page, wiki) => {
      wiki.page('Varrock achievements', fixture('varrock-excerpt.html'));
      await openArea(page, 'Varrock');
      await page.locator('.tab[data-tier="elite"]').click();
    };

    test('shown under the task, like the sub-steps of a quest', async ({ page, wiki }) => {
      await open(page, wiki);
      const t = task(page, '993');
      await expect(t.locator(':scope > ul.subs > li[data-task]')).toHaveCount(4);
      await expect(task(page, '993:2').locator('.t')).toHaveText('Use the pastry dough on a pie dish.');
      await expect(task(page, '993:3').locator('.howto')).toHaveText('The cooking apple can be found in the Guild, the rest needs to be brought from outside.');
      // the tip with the items is under the task name, before the steps
      await expect(t.locator(':scope > .row .howto').first()).toContainText('Required items');
      await expect(page.locator('#pg-cnt')).toHaveText('0 / 2 tasks');
    });

    test('ticking all of them ticks the task; unticking one unticks it', async ({ page, wiki }) => {
      await open(page, wiki);
      await openCog(page);
      await page.getByRole('menuitemcheckbox', { name: 'Show done steps' }).click();
      await closeCog(page);
      for (const i of [1, 2, 3]) await task(page, '993:' + i).locator('.cb').click();
      await expect(task(page, '993')).not.toHaveClass(/\bdone\b/);
      await expect(page.locator('#pg-cnt')).toHaveText('0 / 2 tasks');
      await task(page, '993:4').locator('.cb').click();
      await expect(task(page, '993')).toHaveClass(/\bdone\b/);
      await expect(page.locator('#pg-cnt')).toHaveText('1 / 2 tasks');
      expect((await stored(page, 'aprog.Varrock')).tasks).toEqual({ '993:1': 1, '993:2': 1, '993:3': 1, '993:4': 1, 993: 1 });
      await task(page, '993:2').locator('.cb').click();
      await expect(task(page, '993')).not.toHaveClass(/\bdone\b/);
      await expect(page.locator('#pg-cnt')).toHaveText('0 / 2 tasks');
      expect((await stored(page, 'aprog.Varrock')).tasks['993']).toBeUndefined();
    });

    test('ticking the task ticks all its steps', async ({ page, wiki }) => {
      await open(page, wiki);
      await openCog(page);
      await page.getByRole('menuitemcheckbox', { name: 'Show done steps' }).click();
      await closeCog(page);
      await task(page, '993').locator(':scope > .row > .cb').click();
      for (const i of [1, 2, 3, 4]) await expect(task(page, '993:' + i).locator('.cb')).toBeChecked();
      await task(page, '993').locator(':scope > .row > .cb').click();
      for (const i of [1, 2, 3, 4]) await expect(task(page, '993:' + i).locator('.cb')).not.toBeChecked();
    });

    test('"Done, next task" ticks the whole task, and the area list counts only tasks', async ({ page, wiki }) => {
      await open(page, wiki);
      await page.locator('#next-btn').click();
      expect((await stored(page, 'aprog.Varrock')).tasks).toEqual({ '993:1': 1, '993:2': 1, '993:3': 1, '993:4': 1, 993: 1 });
      await expect(page.locator('#pg-cnt')).toHaveText('1 / 2 tasks');
      expect((await stored(page, 'ameta')).Varrock.tiers.find((t) => t.id === 'elite')).toMatchObject({ done: 1, total: 2 });
    });
  });

  test('ticking tasks: saved, counted, hidden when done', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    await task(page, '448').locator('.t').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 23 tasks');
    await expect(task(page, '448')).toBeHidden();
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1 });
    // "Show done steps" shows them again, so you can untick one
    await openCog(page);
    await page.getByRole('menuitemcheckbox', { name: 'Show done steps' }).click();
    await closeCog(page);
    await expect(task(page, '448')).toBeVisible();
    await task(page, '448').locator('.cb').click();
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 23 tasks');
  });

  test('"Done, next task" ticks the first open task', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    await expect(page.locator('#next-btn')).toHaveText('Done, next task');
    await page.locator('#next-btn').click();
    await page.locator('#next-btn').click();
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 447: 1, 448: 1 });
    await expect(page.locator('li[data-task].cur')).toHaveAttribute('data-task', '449');
  });

  test('the reward for the tier', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    const r = page.locator('details.acc', { hasText: 'Reward' }).last();
    await expect(r.locator('summary .sl')).toHaveText('Rewards');
    await expect(r).toContainText('Ardougne cloak 1');
    await expect(r).toContainText('Unlimited teleports to the Ardougne Monastery');
  });

  test('the quest menu: wiki link, refresh and reset', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    await task(page, '447').locator('.cb').click();
    await page.locator('#menu-btn').click();
    await expect(page.locator('#menu a[data-act="wiki"]')).toHaveAttribute('href', W + 'Ardougne_achievements');
    await page.locator('[data-act="areset"]').click();
    await expect(page.locator('[data-act="areset"]')).toContainText('again');
    await page.locator('[data-act="areset"]').click();
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 23 tasks');
    await page.locator('#menu-btn').click();
    await page.locator('[data-act="arefresh"]').click();
    await expect(page.locator('#toast')).toHaveText('Updated from the wiki.');
    expect(wiki.asked().filter((x) => x === 'Ardougne achievements')).toHaveLength(2);
  });

  test('Lumbridge starts at Beginner', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Lumbridge');
    await expect(page.locator('.tab[data-tier]')).toHaveText(['Beginner', 'Easy', 'Medium', 'Hard']);
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 24 tasks');
  });

  test('a normal session has no errors', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    for (const t of ['medium', 'hard', 'elite', 'easy']) await page.locator('.tab[data-tier="' + t + '"]').click();
    await page.getByRole('button', { name: 'All areas' }).click();
    await page.locator('.tab[data-home="quests"]').click();
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    expect(page.errors).toEqual([]);
  });
});
