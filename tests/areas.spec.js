// Area Tasks: the wiki's "<Area> achievements" pages, read into tiers of tasks you tick off.
const { test, expect, fixture, seed, stored, openApp, openCog, closeCog, lookUp } = require('./support/app');

const W = 'https://runescape.wiki/w/';
const AREAS = ['Ardougne', 'Daemonheim', 'Desert', 'Falador', 'Fremennik', 'Karamja', 'Lumbridge', 'Morytania', "Seers' Village", 'Tirannwn', 'Underworld', 'Varrock', 'Wilderness'];
const area = (page, name) => page.locator('.q[data-area="' + name + '"]');
const task = (page, id) => page.locator('li[data-task="' + id + '"]');
const sec = (page, id) => page.locator('section[data-asec="' + id + '"]');

function withAreas(wiki) {
  wiki.page('Ardougne achievements', fixture('ardougne-achievements.html'));
  wiki.page('Lumbridge achievements', fixture('lumbridge-achievements.html'));
  return wiki;
}
async function areasTab(page) {
  await openApp(page, expect);
  await page.locator('.tab[data-home="areas"]').click();
  await expect(page.locator('#qcount')).toHaveText('13 areas');
}
async function openArea(page, name) {
  await areasTab(page);
  await area(page, name).click();
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

  test('a page that is not an area page', async ({ page }) => {
    const r = await page.evaluate(() => { try { window.QuickGuide.parseArea('<div class="mw-parser-output"><p>Nothing.</p></div>', 'X'); return 'no error'; } catch (e) { return e.code; } });
    expect(r).toBe('format');
  });
});

test.describe('the area list', () => {
  test('a tab next to Quests shows the 13 areas, and is remembered', async ({ page, wiki }) => {
    await openApp(page, expect);
    await expect(page.locator('.tab[data-home]')).toHaveText(['Quests', 'Area tasks']);
    await expect(page.locator('.tab[data-home="quests"]')).toHaveAttribute('aria-selected', 'true');
    await page.locator('.tab[data-home="areas"]').click();
    await expect(page.locator('.tab[data-home="areas"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.q .q1 b')).toHaveText(AREAS);
    await expect(area(page, 'Lumbridge').locator('.q2')).toHaveText('Beginner · Easy · Medium · Hard');
    await expect(area(page, 'Ardougne').locator('.q2')).toHaveText('Easy · Medium · Hard · Elite');
    await expect(page.locator('#quest-link')).toHaveAttribute('placeholder', 'Search areas');
    expect(wiki.asked()).toEqual(['List of quests']);   // no area pages yet
    expect((await stored(page, 'settings')).home).toBe('areas');
    await page.reload();
    await expect(page.locator('#qcount')).toHaveText('13 areas');
  });

  test('search finds an area; Enter opens it', async ({ page, wiki }) => {
    withAreas(wiki);
    await areasTab(page);
    await page.locator('#quest-link').fill('ardo');
    await expect(page.locator('.q .q1 b')).toHaveText(['Ardougne']);
    await expect(page.locator('#qcount')).toHaveText('1 of 13 areas');
    await page.locator('#quest-link').press('Enter');
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
  });

  test('an area you started goes first, with its progress', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    await task(page, '447').locator('.cb').click();
    await task(page, '448').locator('.cb').click();
    await page.getByRole('button', { name: 'All areas' }).click();
    await expect(page.locator('.ghb .n').first()).toHaveText('In progress');
    await expect(area(page, 'Ardougne').locator('.qs')).toHaveText('2 / 23');
    await expect(area(page, 'Ardougne').locator('.q2')).toHaveText('Easy 2 / 23 · Medium · Hard · Elite');
    await expect(area(page, 'Ardougne').locator('progress')).toHaveCount(1);
  });

  test('a finished tier is marked', async ({ page, wiki }) => {
    withAreas(wiki);
    await openArea(page, 'Ardougne');
    const ids = await page.locator('li[data-task]').evaluateAll((l) => l.map((x) => x.getAttribute('data-task')));
    const ticks = {}; ids.forEach((i) => { ticks[i] = 1; });
    await page.evaluate((t) => localStorage.setItem('qg1.aprog.Ardougne', JSON.stringify({ tasks: t, tier: 'easy' })), ticks);
    await page.reload();
    await expect(page.locator('#pg-cnt')).toHaveText('23 / 23 tasks');
    await expect(page.locator('#next-btn')).toHaveText('All tasks done');
    await page.getByRole('button', { name: 'All areas' }).click();
    await expect(area(page, 'Ardougne').locator('.qs')).toHaveText('✓ Easy');
    await expect(area(page, 'Ardougne').locator('.q2')).toHaveText('Easy ✓ · Medium · Hard · Elite');
  });
});

test('an area whose first tier you cannot do yet is grayed out', async ({ page, wiki }) => {
  withAreas(wiki).setPlayer('Zezima', {}, { 18: 3 });   // Thieving 3; Ardougne Easy needs 16
  await openApp(page, expect);
  await lookUp(page, 'Zezima');
  await expect(page.locator('#player')).toContainText('Zezima');
  await closeCog(page);
  await page.locator('.tab[data-home="areas"]').click();
  await area(page, 'Ardougne').click();
  await page.getByRole('button', { name: 'All areas' }).click();
  await expect(area(page, 'Ardougne')).toHaveClass(/\blocked\b/);
  await expect(area(page, 'Ardougne').locator('.qs')).toHaveText('Locked');
  // areas you never opened: nothing is known yet
  await expect(area(page, 'Desert')).not.toHaveClass(/\blocked\b/);
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
    await area(page, 'Ardougne').click();
    expect(wiki.asked().filter((x) => x === 'Ardougne achievements')).toHaveLength(1);
  });

  test('says when the wiki fails', async ({ page, wiki }) => {
    wiki.fail('Desert achievements', 'http');
    await areasTab(page);
    await area(page, 'Desert').click();
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
    await expect(n.locator('.chip')).toHaveText(['16Thieving', '10Construction']);
    await expect(n.locator('.tree li')).toHaveText(['Biohazard', "Gertrude's Cat", "Monk's Friend", 'Plague City', 'Tower of Life']);
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
    await area(page, 'Ardougne').click();
    const n = sec(page, 'needs');
    await expect(n.locator('.chip').nth(0)).toHaveClass(/\blow\b/);
    await expect(n.locator('.chip').nth(1)).toHaveClass(/\bok\b/);
    await expect(n.locator('.sech .c')).toHaveText('1 too low');
    await expect(n.locator('.tree li.got')).toHaveText(['✓ Biohazard', '✓ Plague City']);
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
