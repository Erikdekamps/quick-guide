// Area Tasks: the wiki's "<Area> achievements" pages, read into tiers of tasks you tick off.
const { addWiki, test, expect, fixture, seed, stored, openApp, openSettings, closeSettings, lookUp, toggle, areaPage, plain } = require('./support/app');

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
  await page.locator('.bn[data-home="areas"]').click();
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
    await addWiki(page);
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
    expect(plain(e.items[0])).toBe('Around 350 coins');
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
    expect(r.items.map(plain)).toContain('Ardougne cloak 1, which grants the following bonuses:');
    expect(r.perks).toContain('Unlimited teleports to the Ardougne Monastery');
    // each tier shows its own cloak's perks
    expect(a.tiers[1].reward.perks.join(' ')).toContain('Manor Farm');
    expect(a.tiers[1].reward.perks).not.toContain('Unlimited teleports to the Ardougne Monastery');
  });

  test('a level marked "(b)" on the wiki is boostable', async ({ page }) => {
    const a = await parse(page, 'ardougne-achievements.html', 'Ardougne');
    const hard = a.tiers.find((t) => t.id === 'hard');
    expect(hard.skills).toContainEqual({ skill: 'Magic', level: 71, boost: true });
    const t472 = a.tiers.find((t) => t.id === 'medium').tasks.find((x) => x.id === '472');
    expect(t472.skills).toEqual(expect.arrayContaining([{ skill: 'Fletching', level: 59, boost: true }, { skill: 'Smithing', level: 30, boost: true }]));
    expect(t472.skills).toContainEqual({ skill: 'Agility', level: 39 });
    // not left as an "other" line
    expect(hard.other.join(' ')).not.toMatch(/\(b\)/);
  });

  test('a numbered list in a task becomes its sub-steps', async ({ page }) => {
    const v = await parse(page, 'varrock-excerpt.html', 'Varrock');
    expect(v.tiers.map((t) => t.name)).toEqual(['Easy', 'Elite']);
    const red = v.tiers[1].tasks.find((t) => t.name === 'Red, Red Pies of Summer');
    expect(red.id).toBe('993');
    expect(red.subs.map((x) => x.id)).toEqual(['993:1', '993:2', '993:3', '993:4']);
    expect(red.subs.map((x) => plain(x.html))).toEqual([
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
    // a task with a numbered list keeps its other text as the tip
    expect(plain(t.notes).length).toBeGreaterThan(250);
  });

  // Only a numbered list on the wiki is steps. A lot of text is tips, not things to do: no tick boxes for those.
  test('a task with a lot of text keeps it as its tip, with no tick boxes', async ({ page }) => {
    const a = await parse(page, 'ardougne-achievements.html', 'Ardougne');
    const all = a.tiers.flatMap((x) => x.tasks);
    const purse = all.find((x) => x.name === "Honestly, It's Not a Purse");
    expect(purse.subs).toEqual([]);
    expect(plain(purse.notes).length).toBeGreaterThan(250);
    // nothing is lost: the list under a line that ends with ":" stays in the tip
    const cat = all.find((x) => x.name === 'A Cat is For Life...');
    expect(cat.subs).toEqual([]);
    expect(plain(cat.notes)).toContain('Cats that can be used for this achievement are:');
    expect(plain(cat.notes)).toContain('Hellcats');
    expect(plain(cat.notes)).toContain('The cat does not need to be sold');
    // only tasks with a numbered list on the wiki have steps
    expect(all.filter((x) => x.subs.length).map((x) => x.name)).toEqual(["You're the Dirty Rascal"]);
  });

  test('short text stays one tip', async ({ page }) => {
    const a = await parse(page, 'ardougne-achievements.html', 'Ardougne');
    const t = a.tiers[0].tasks;
    expect(t.find((x) => x.name === 'Silky Smooth').subs).toEqual([]);
    expect(t.find((x) => x.name === 'Yoink!').subs).toEqual([]);
    const l = await parse(page, 'lumbridge-achievements.html', 'Lumbridge');
    const len = (x) => plain([x.notes].concat(x.subs.map((u) => u.html)).join(' ')).length;
    const short = l.tiers.flatMap((x) => x.tasks).filter((x) => len(x) < 200);
    expect(short.length).toBeGreaterThan(40);
    for (const x of short) expect(x.subs, x.name).toEqual([]);
  });

  // (A reader that gets stuck on it runs into the test's time limit.)
  test('a long tip with a stray "<" in it reads as one tip', async ({ page }) => {
    const long = 'Use the <a href="/w/X" title="X">lever</a>. '.repeat(3) + 'Then type 1 < 2 here. ' + 'Go north to the big door now. '.repeat(10);
    const html = '<h2 id="Easy_achievements">Easy achievements</h2><h3 id="List_of_achievements">List of achievements</h3>' +
      '<table><tr><th>#</th><th>Name</th><th>Description</th><th>Members</th><th>Requirements</th><th>Notes</th></tr>' +
      '<tr data-rowid="1"><td>1</td><td><a href="/w/A">A task</a></td><td>Do it.</td><td></td><td><ul><li>None</li></ul></td><td><p>' + long + '</p></td></tr></table>';
    const subs = await page.evaluate((h) => window.QuickGuide.parseArea('<div class="mw-parser-output">' + h + '</div>', 'X').tiers[0].tasks[0].subs.length, html);
    expect(subs).toBe(0);
  });

  test('the page a phone gets (parts wrapped in sections) reads the same', async ({ page }) => {
    // The wiki's mobile view puts what follows each part's heading in a <section>.
    const mobile = (h) => {
      const parts = h.split(/(?=<div class="mw-heading mw-heading2">)/);
      return parts.map((p, i) => {
        if (i === 0) return p;
        const end = p.indexOf('</div>') + 6;
        return p.slice(0, end).replace('mw-heading mw-heading2', 'mw-heading mw-heading2 section-heading') +
          '<section class="mf-section-' + i + ' collapsible-block" id="mf-section-' + i + '">' + p.slice(end) + '</section>';
      }).join('');
    };
    const html = fixture('ardougne-achievements.html');
    expect(mobile(html).match(/<section/g).length).toBe(4);
    const desk = await page.evaluate((h) => window.QuickGuide.parseArea('<div class="mw-parser-output">' + h + '</div>', 'Ardougne'), html);
    const phone = await page.evaluate((h) => window.QuickGuide.parseArea('<div class="mw-parser-output">' + h + '</div>', 'Ardougne'), mobile(html));
    delete desk.fetchedAt; delete phone.fetchedAt;
    expect(phone).toEqual(desk);
  });

  test('a page that is not an area page', async ({ page }) => {
    const r = await page.evaluate(() => { try { window.QuickGuide.parseArea('<div class="mw-parser-output"><p>Nothing.</p></div>', 'X'); return 'no error'; } catch (e) { return e.code; } });
    expect(r).toBe('format');
  });
});

test.describe('the area list', () => {
  test('a row for each tier of the 13 areas, grouped by area, and the tab is remembered', async ({ page, wiki }) => {
    await openApp(page, expect);
    await expect(page.locator('.bn[data-home]')).toHaveText(['Quests', 'Achievements', 'My list', 'Settings']);
    await expect(page.locator('.bn[data-home="quests"]')).toHaveAttribute('aria-current', 'page');
    await page.locator('.bn[data-home="areas"]').click();
    await expect(page.locator('.bn[data-home="areas"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#qcount')).toHaveText('13 areas');
    // the capes on top, then the areas
    await expect(page.locator('.ghb .n')).toHaveText(['Capes', ...AREAS]);
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

  test('a tier you started stays in its area, with its own progress bar', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    // Easy is untouched; Medium is where the ticks are
    await page.locator('.tab[data-tier="medium"]').click();
    await page.locator('#next-btn').click();
    await page.locator('#next-btn').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    // No "In progress" group: the tier stays under its area.
    await expect(page.locator('.ghb .n')).not.toContainText(['In progress']);
    await expect(page.locator('.ghb .n')).toHaveText(['Capes', ...AREAS]);
    const row = area(page, 'Ardougne', 'medium');
    await expect(row.locator('.q1 b')).toHaveText('Ardougne Medium');
    await expect(row.locator('.qs')).toHaveText('2 / 16');
    await expect(row.locator('progress')).toHaveJSProperty('value', 2);
    await expect(row.locator('progress')).toHaveJSProperty('max', 16);
    await expect(row).toHaveCSS('color', 'rgb(236, 230, 218)');
    await expect(row.locator('.q1 b')).toHaveCSS('color', 'rgb(245, 225, 90)');
    // in its place among the area's tiers
    await expect(tierRows(page, 'Ardougne')).toHaveText(['Ardougne Easy', 'Ardougne Medium', 'Ardougne Hard', 'Ardougne Elite']);
    // tiers that were never touched have no bar and no count of their own
    await expect(area(page, 'Ardougne', 'easy').locator('progress')).toHaveCount(0);
    await expect(area(page, 'Ardougne', 'easy').locator('.q2')).toHaveText('23 tasks');
  });

  test('a finished tier is green; without "Done quests and tiers" it is hidden', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    const ids = await page.locator('li[data-task]').evaluateAll((l) => l.map((x) => x.getAttribute('data-task')));
    const ticks = {}; ids.forEach((i) => { ticks[i] = 1; });
    await page.evaluate((t) => localStorage.setItem('qg1.aprog.Ardougne', JSON.stringify({ tasks: t, tier: 'easy' })), ticks);
    await page.reload();
    await expect(page.locator('#pg-cnt')).toHaveText('23 / 23');
    await expect(page.locator('#next-btn')).toHaveText('All tasks done');
    await page.getByRole('button', { name: 'All achievements' }).click();
    const row = area(page, 'Ardougne', 'easy');
    await expect(row).toHaveClass(/\bdone\b/);
    await expect(row.locator('.qs')).toHaveText('✓ Done');
    await toggle(page, 'Done quests and tiers');
    await expect(area(page, 'Ardougne', 'easy')).toHaveCount(0);
    await expect(area(page, 'Ardougne', 'medium')).toHaveCount(1);
    await toggle(page, 'Done quests and tiers');
    await expect(area(page, 'Ardougne', 'easy')).toHaveCount(1);
  });

  test('a tier you cannot do yet is grayed out and says Locked; without "Locked quests and tiers" it is hidden', async ({ page, wiki }) => {
    withAreas(wiki).setPlayer('Zezima', {}, { 18: 3 });   // Thieving 3; Ardougne Easy needs 16
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeSettings(page);
    await page.locator('.bn[data-home="areas"]').click();
    await area(page, 'Ardougne', 'easy').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    const row = area(page, 'Ardougne', 'easy');
    await expect(row).toHaveClass(/\blocked\b/);
    await expect(row.locator('.qs')).toHaveText('Locked');
    // tiers of an area you never opened: nothing is known yet
    await expect(area(page, 'Desert', 'easy')).not.toHaveClass(/\blocked\b/);
    await toggle(page, 'Locked quests and tiers');
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

test('when storage is full, the area read longest ago is dropped, but not its ticks or its tasks in the index', async ({ page, wiki }) => {
  withAreas(wiki);
  const stub = { version: 2, name: 'x', tiers: [{ id: 'easy', name: 'Easy', skills: [], quests: [], other: [], items: [], ironman: '', tasks: [{ id: '1', name: 'A task', desc: '', skills: [], quests: [], other: [], notes: '', subs: [] }], reward: { intro: '', items: [], perks: [] } }] };
  await seed(page, {
    'area.Desert': stub, 'area.Falador': stub,
    'aprog.Desert': { tasks: { 1: 1 } },
    'aidx': { Desert: { v: 2, tiers: [{ id: 'easy', name: 'Easy', tasks: [{ id: '1', name: 'A task', subs: [] }] }] } },
    'ameta': { Desert: { at: 1000, tiers: [{ id: 'easy', name: 'Easy', total: 1, done: 1 }] }, Falador: { at: 3000, tiers: [{ id: 'easy', name: 'Easy', total: 1, done: 0 }] } }
  });
  // This browser only has room for two areas.
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      const areas = Object.keys(this).filter((x) => x.startsWith('qg1.area.') && x !== k);
      if (k.startsWith('qg1.area.') && areas.length >= 2) throw new DOMException('Full', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  await openApp(page, expect);
  await page.locator('.bn[data-home="areas"]').click();
  await area(page, 'Ardougne').first().click();
  await expect(page.locator('h1.qt')).toHaveText('Ardougne');
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('qg1.')).sort());
  expect(keys).toContain('qg1.area.Ardougne');
  expect(keys).toContain('qg1.area.Falador');
  expect(keys).not.toContain('qg1.area.Desert');
  expect(keys).toContain('qg1.aprog.Desert');
  expect((await stored(page, 'aidx')).Desert.tiers[0].tasks[0].name).toBe('A task');
  expect((await stored(page, 'ameta')).Desert.tiers[0].done).toBe(1);
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

  test('Enter with a task name opens the tier it is in; with nothing found, it says so', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await areasTab(page);
    await search(page, 'red, red');
    await expect(taskRows(page)).toHaveCount(1);
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('h1.qt')).toHaveText('Varrock');
    await expect(page.locator('.tab[data-tier="elite"]')).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'All achievements' }).click();
    await search(page, 'no such thing');
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('#load-err')).toHaveText('Nothing matches “no such thing”.');
    await search(page, '');
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('#load-err')).toHaveText('Type an area or task name first.');
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

  test('an area whose saved page is broken counts as not read: the reading still ends, and the others can be searched', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, { 'area.Desert': { name: 'Desert', tiers: 5 }, settings: { home: 'areas' } });
    await openApp(page, expect);
    await search(page, 'yoink');
    await expect(page.locator('#qarea .err')).toContainText('Could not read 1 area (Desert)');
    await expect(page.locator('#qarea .state')).toHaveCount(0);
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
    await page.getByRole('button', { name: 'All achievements' }).click();
    await area(page, 'Ardougne').first().click();
    expect(wiki.asked().filter((x) => x === 'Ardougne achievements')).toHaveLength(1);
  });

  test('an area saved by an older version opens at once, and is read again quietly', async ({ page, wiki }) => {
    withAreas(wiki);
    await page.goto('/__blank');
    await addWiki(page);
    const old = await page.evaluate((h) => { const a = window.QuickGuide.parseArea('<div class="mw-parser-output">' + h + '</div>', 'Ardougne'); a.version = 1; return a; }, fixture('ardougne-achievements.html'));
    wiki.fail('Ardougne achievements', 'slow');
    await seed(page, { 'area.Ardougne': old, settings: { home: 'areas' } });
    await openApp(page, expect);
    await area(page, 'Ardougne', 'easy').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');          // no waiting for the wiki
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 23');
    expect(page.errors).toEqual([]);
  });

  test('an older area whose tasks were saved without steps can be ticked', async ({ page, wiki }) => {
    withAreas(wiki);
    await page.goto('/__blank');
    await addWiki(page);
    const old = await page.evaluate((h) => {
      const a = window.QuickGuide.parseArea('<div class="mw-parser-output">' + h + '</div>', 'Ardougne');
      a.tiers.forEach((t) => t.tasks.forEach((x) => { delete x.subs; }));
      return a;
    }, fixture('ardougne-achievements.html'));
    await seed(page, { 'area.Ardougne': old, settings: { home: 'areas' } });
    await openApp(page, expect);
    await area(page, 'Ardougne', 'easy').click();
    await page.locator('#next-btn').click();
    await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('2 / 23');
    expect(page.errors).toEqual([]);
  });

  test('when the quiet read works, the area is updated', async ({ page, wiki }) => {
    withAreas(wiki);
    await page.goto('/__blank');
    await addWiki(page);
    const old = await page.evaluate((h) => { const a = window.QuickGuide.parseArea('<div class="mw-parser-output">' + h + '</div>', 'Ardougne'); a.version = 1; return a; }, fixture('ardougne-achievements.html'));
    await seed(page, { 'area.Ardougne': old, settings: { home: 'areas' } });
    await openApp(page, expect);
    await area(page, 'Ardougne', 'easy').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await expect.poll(async () => (await stored(page, 'area.Ardougne')).version).toBe(await page.evaluate(() => window.QuickGuide.AREA_VERSION));
    await expect(page.locator('#toast')).toBeHidden();   // quiet
  });

  test('when the quiet read fails, the saved area stays, and nothing breaks', async ({ page, wiki }) => {
    withAreas(wiki);
    await page.goto('/__blank');
    await addWiki(page);
    const old = await page.evaluate((h) => { const a = window.QuickGuide.parseArea('<div class="mw-parser-output">' + h + '</div>', 'Ardougne'); a.version = 1; return a; }, fixture('ardougne-achievements.html'));
    wiki.fail('Ardougne achievements', 'http');
    await seed(page, { 'area.Ardougne': old, settings: { home: 'areas' } });
    await openApp(page, expect);
    await area(page, 'Ardougne', 'easy').click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 23');
    expect((await stored(page, 'area.Ardougne')).version).toBe(1);
    expect(page.errors).toEqual([]);
  });

  test('a tick writes your ticks, changes only its own rows, and the area list count follows a moment later', async ({ page, wiki }) => {
    withAreas(wiki);
    await page.clock.install();
    await openArea(page, 'Ardougne');
    await page.clock.runFor(2000);
    const rows = page.locator('#main li[data-task]');
    await rows.nth(5).evaluate((li) => { li.dataset.kept = 'yes'; });
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      window.writes = [];
      Storage.prototype.setItem = function (k, v) { window.writes.push(k); return set.call(this, k, v); };
    });
    await page.locator('#next-btn').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 23');
    await expect(page.locator('[data-asec="tasks"] .sech .c')).toHaveText('1 / 23');
    await expect(rows.first()).toHaveClass(/\bdone\b/);
    await expect(rows.nth(1)).toHaveClass(/\bcur\b/);
    await expect(rows.nth(5)).toHaveAttribute('data-kept', 'yes');
    expect(await page.evaluate(() => window.writes)).toEqual(['qg1.aprog.Ardougne']);
    await page.clock.runFor(1600);
    expect(await page.evaluate(() => window.writes.filter((k) => k !== 'qg1.view'))).toEqual(['qg1.aprog.Ardougne', 'qg1.ameta']);
    expect((await stored(page, 'ameta')).Ardougne.tiers[0]).toMatchObject({ done: 1, total: 23 });
  });

  test('opening an area again does not write the index of all tasks again', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    expect((await stored(page, 'aidx')).Ardougne.tiers).toHaveLength(4);
    await page.getByRole('button', { name: 'All achievements' }).click();
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      window.writes = [];
      Storage.prototype.setItem = function (k, v) { window.writes.push(k); return set.call(this, k, v); };
    });
    await area(page, 'Ardougne').first().click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    expect(await page.evaluate(() => window.writes)).not.toContain('qg1.aidx');
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
    await expect(page.locator('.tab[data-tier] .tl-l')).toHaveText(['Easy', 'Medium', 'Hard', 'Elite']);
    await expect(page.locator('.tab[data-tier="easy"]')).toHaveAttribute('aria-selected', 'true');
    // each tier's tab has its own count under its name; the open one's is the line under the title band
    await expect(page.locator('.tab[data-tier] .tcn')).toHaveText(['0 / 23', '0 / 16', '0 / 17', '0 / 5']);
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 23');
    await page.locator('#next-btn').click();
    await expect(page.locator('.tab[data-tier] .tcn')).toHaveText(['1 / 23', '0 / 16', '0 / 17', '0 / 5']);
    await expect(page.locator('#pg')).toHaveJSProperty('value', 1);
    await expect(page.locator('#pg')).toHaveJSProperty('max', 23);
    await page.locator('.tab[data-tier="medium"]').click();
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 16');
    await expect(page.locator('.tab[data-tier="medium"] #pg-cnt')).toHaveCount(1);
    await expect(page.locator('.tab[data-tier] .tcn')).toHaveText(['1 / 23', '0 / 16', '0 / 17', '0 / 5']);
    await expect(page.locator('#pg')).toHaveJSProperty('value', 0);
    await expect(task(page, '470')).toBeVisible();
    expect((await stored(page, 'aprog.Ardougne')).tier).toBe('medium');
    await page.reload();
    await expect(page.locator('.tab[data-tier="medium"]')).toHaveAttribute('aria-selected', 'true');
  });

  test('Needs: levels, quests, items and Ironman notes', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    const n = sec(page, 'needs');
    // levels like the wiki: "• 16 [icon] Thieving", the skill's name a link to its wiki page
    const sk = n.locator('ul.skl-list li');
    await expect(n.locator('ul.skl-list')).toHaveCSS('list-style-type', 'disc');
    await expect(sk.locator('.lv')).toHaveText(['16', '10']);
    await expect(sk.locator('.sn')).toHaveText(['Thieving', 'Construction']);
    await expect(sk.locator('a.sn').first()).toHaveAttribute('href', 'https://runescape.wiki/w/Thieving');
    await expect(sk.locator('img.sic').first()).toHaveAttribute('src', 'https://runescape.wiki/images/Thieving-icon.png');
    // no player: no tick and no cross
    await expect(sk.first()).not.toHaveClass(/\b(ok|low)\b/);
    await expect(n.locator('.mk')).toHaveCount(0);
    await expect(n.locator('.tree li')).toHaveText(['Biohazard', "Gertrude's Cat", "Monk's Friend", 'Plague City', 'Tower of Life']);
    await expect(n.locator('details.acc summary .sl')).toHaveText(['Items to bring', 'Ironmen']);
    await expect(n.locator('details.acc', { hasText: 'Ironmen' })).not.toHaveAttribute('open', '');
    await expect(n.locator('details.acc', { hasText: 'Items to bring' }).locator('li').first()).toHaveText('Around 350 coins');
  });

  test('a boostable level says so', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    await page.locator('.tab[data-tier="hard"]').click();
    const magic = sec(page, 'needs').locator('ul.skl-list li', { hasText: 'Magic' });
    await expect(magic.locator('.lv')).toHaveText('71');
    await expect(magic.locator('sup.bst')).toHaveText('(boostable)');
  });

  test('Needs with a player: your levels and quests', async ({ page, wiki }) => {
    withAreas(wiki).setPlayer('Zezima', { Biohazard: 'COMPLETED', 'Plague City': 'COMPLETED' }, { 18: 3, 23: 40 });   // Thieving 3, Construction 40
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeSettings(page);
    await page.locator('.bn[data-home="areas"]').click();
    await area(page, 'Ardougne').first().click();
    const n = sec(page, 'needs');
    const sk = n.locator('ul.skl-list li');
    // like the wiki: the level stays plain. Too low: a red cross (your level in its tooltip) and "+ goal". Enough: a green tick.
    await expect(sk.nth(0)).toHaveClass(/\blow\b/);
    await expect(sk.nth(0)).toHaveText('16 Thieving goal');
    await expect(sk.nth(0).locator('.addgoal')).toHaveAttribute('aria-label', 'Add 16 Thieving to my list');
    await expect(sk.nth(1).locator('.addgoal')).toHaveCount(0);
    await expect(sk.nth(0).locator('.lv')).toHaveCSS('color', 'rgb(236, 230, 218)');
    await expect(sk.nth(0).locator('.mk.no')).toHaveCSS('color', 'rgb(255, 91, 73)');
    await expect(sk.nth(0).locator('.mk.no')).toHaveAttribute('title', 'Too low: you have 3');
    await expect(sk.nth(0).locator('.mk.ok')).toHaveCount(0);
    await expect(sk.nth(1)).toHaveClass(/\bok\b/);
    await expect(sk.nth(1).locator('.lv')).toHaveCSS('color', 'rgb(236, 230, 218)');
    await expect(sk.nth(1).locator('.mk.ok')).toHaveCSS('color', 'rgb(102, 211, 92)');
    await expect(sk.nth(1).locator('.mk.ok')).toHaveAttribute('title', 'You have 40');
    await expect(n.locator('.sech .c')).toHaveText('1 too low');
    // quests: a green tick after the ones you have done, a red cross after the others
    await expect(n.locator('.tree li.got')).toHaveText(['Biohazard', 'Plague City']);
    await expect(n.locator('.tree li.got .mk.ok')).toHaveCount(2);
    await expect(n.locator('.tree li:not(.got)')).toHaveCount(3);
    await expect(n.locator('.tree li:not(.got) .mk.no')).toHaveCount(3);
    await expect(n.locator('.tree li:not(.got) .mk.no').first()).toHaveAttribute('title', 'Not done yet');
    // a task that needs more than you have: the same cross
    const need = task(page, '448').locator('.need');
    await expect(need).toHaveText('Needs 5 Thieving goal');
    await expect(need.locator('.mk.no')).toHaveAttribute('title', 'Too low: you have 3');
    await expect(need).toHaveClass(/\blow\b/);
    await expect(task(page, '450').locator('.need')).toHaveText('Needs Plague City');
    await expect(task(page, '450').locator('.need .mk.ok')).toHaveCount(1);
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
    await expect(page.locator('#pg-cnt')).toHaveText('5 / 5');
    const tasks = sec(page, 'tasks');
    await expect(tasks.locator('.sech')).toHaveAttribute('aria-expanded', 'false');
    await expect(tasks.locator('.sech')).toHaveClass(/\bdone\b/);
    await expect(tasks.locator('.sech .c')).toHaveText('✓ 5 / 5');
    await tasks.locator('.sech').click();
    const top = tasks.locator('.secb > ul > li[data-task]');
    await expect(top).toHaveCount(5);
    for (const li of await top.all()) await expect(li).toBeVisible();
    await top.first().locator(':scope > .row > .cb').click();
    await expect(page.locator('#pg-cnt')).toHaveText('4 / 5');
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
      await expect(page.locator('#pg-cnt')).toHaveText('0 / 2');
    });

    test('the tip keeps its line breaks: "Required items" is a line of its own', async ({ page, wiki }) => {
      await open(page, wiki);
      const tip = task(page, '993').locator(':scope > .row .howto').first();
      const lines = await tip.evaluate((e) => [...e.querySelectorAll('br')].map((b) => getComputedStyle(b).display));
      expect(lines.length).toBeGreaterThanOrEqual(6);
      expect(lines.every((d) => d !== 'none')).toBe(true);
      expect(await tip.evaluate((e) => e.innerHTML)).toContain('Required items<br>');
    });

    test('ticking all of them ticks the task; unticking one unticks it', async ({ page, wiki }) => {
      await open(page, wiki);
      await openSettings(page);
      await page.getByRole('menuitemcheckbox', { name: 'Done steps and tasks' }).click();
      await closeSettings(page);
      for (const i of [1, 2, 3]) await task(page, '993:' + i).locator('.cb').click();
      await expect(task(page, '993')).not.toHaveClass(/\bdone\b/);
      await expect(page.locator('#pg-cnt')).toHaveText('0 / 2');
      await task(page, '993:4').locator('.cb').click();
      await expect(task(page, '993')).toHaveClass(/\bdone\b/);
      await expect(page.locator('#pg-cnt')).toHaveText('1 / 2');
      expect((await stored(page, 'aprog.Varrock')).tasks).toEqual({ '993:1': 1, '993:2': 1, '993:3': 1, '993:4': 1, 993: 1 });
      await task(page, '993:2').locator('.cb').click();
      await expect(task(page, '993')).not.toHaveClass(/\bdone\b/);
      await expect(page.locator('#pg-cnt')).toHaveText('0 / 2');
      expect((await stored(page, 'aprog.Varrock')).tasks['993']).toBeUndefined();
    });

    test('ticking the task ticks all its steps', async ({ page, wiki }) => {
      await open(page, wiki);
      await openSettings(page);
      await page.getByRole('menuitemcheckbox', { name: 'Done steps and tasks' }).click();
      await closeSettings(page);
      await task(page, '993').locator(':scope > .row > .cb').click();
      for (const i of [1, 2, 3, 4]) await expect(task(page, '993:' + i).locator('.cb')).toBeChecked();
      await task(page, '993').locator(':scope > .row > .cb').click();
      for (const i of [1, 2, 3, 4]) await expect(task(page, '993:' + i).locator('.cb')).not.toBeChecked();
    });

    test('"Done, next task" ticks the whole task, and the area list counts only tasks', async ({ page, wiki }) => {
      await open(page, wiki);
      await page.locator('#next-btn').click();
      expect((await stored(page, 'aprog.Varrock')).tasks).toEqual({ '993:1': 1, '993:2': 1, '993:3': 1, '993:4': 1, 993: 1 });
      await expect(page.locator('#pg-cnt')).toHaveText('1 / 2');
      // the area list's count is saved a moment later
      await expect.poll(async () => (await stored(page, 'ameta')).Varrock.tiers.find((t) => t.id === 'elite')).toMatchObject({ done: 1, total: 2 });
    });
  });

  test('ticking tasks: saved, counted, hidden when done', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    await task(page, '448').locator('.t').click();
    await expect(page.locator('#pg-cnt')).toHaveText('1 / 23');
    await expect(task(page, '448')).toBeHidden();
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1 });
    // "Done steps and tasks" shows them again, so you can untick one
    await openSettings(page);
    await page.getByRole('menuitemcheckbox', { name: 'Done steps and tasks' }).click();
    await closeSettings(page);
    await expect(task(page, '448')).toBeVisible();
    await task(page, '448').locator('.cb').click();
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 23');
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
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 23');
    await page.locator('#menu-btn').click();
    await page.locator('[data-act="arefresh"]').click();
    await expect(page.locator('#toast')).toHaveText('Updated from the wiki.');
    expect(wiki.asked().filter((x) => x === 'Ardougne achievements')).toHaveLength(2);
  });

  test('Lumbridge starts at Beginner', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Lumbridge');
    await expect(page.locator('.tab[data-tier] .tl-l')).toHaveText(['Beginner', 'Easy', 'Medium', 'Hard']);
    await expect(page.locator('#pg-cnt')).toHaveText('0 / 24');
  });

  test('a normal session has no errors', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    for (const t of ['medium', 'hard', 'elite', 'easy']) await page.locator('.tab[data-tier="' + t + '"]').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('#qcount')).toHaveText('11 quests');
    expect(page.errors).toEqual([]);
  });
});
