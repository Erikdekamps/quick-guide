// My list: your own lists of goals (docs/my-list-plan.md). A third tab on the start screen.
// Lists have names you choose. A goal is one flat row: a tick box, what it says, and its menu. You can tick any goal;
// skill levels, quests and tiers also tick themselves; an area task shares its tick with its area, a quest with the
// quest list; a goal can repeat daily, weekly or monthly.
// Quests, tiers, tasks and levels you miss go on a list from their ⋯ menu (or "+ goal"), in a box where you pick the list.
const { test, expect, seed, stored, openApp, openQuest, openCog, lookUp, withAllAreas, toggle } = require('./support/app');

const tab = (page) => page.locator('.tab[data-home="todo"]');
const listBar = (page, name) => page.locator('h2.gh.lh').filter({ has: page.locator('.ghb .n', { hasText: new RegExp('^' + name + '$') }) });
const goals = (page, list) => listBar(page, list).locator('xpath=following-sibling::ul[1]').locator('li.goal');
const goal = (page, text) => page.locator('li.goal').filter({ has: page.locator('.t', { hasText: text }) });
const names = (page) => page.locator('h2.gh.lh .ghb .n');
const menuItems = (page) => page.locator('#tmenu .mi');
const dialog = (page) => page.locator('#td .dlg');
// The saved lists: { name: [goal titles] }.
async function saved(page) {
  const t = await stored(page, 'todo');
  const out = {};
  for (const l of (t && t.lists) || []) out[l.name] = l.items.map((x) => x.kind + ':' + (x.kind === 'skill' ? x.level + ' ' + x.skill : x.title));
  return out;
}
// Lists to start with: { name: [goals] }.
function lists(o) {
  let n = 0;
  return { v: 1, lists: Object.keys(o).map((name, i) => ({ id: 'l' + (i + 1), name, items: o[name].map((g) => Object.assign({ id: 'g' + (++n), at: n }, g)) })) };
}
async function openList(page, data) {
  if (data) await seed(page, { todo: data, settings: { home: 'todo' } });
  else await seed(page, { settings: { home: 'todo' } });
  await page.goto('/');
  await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
}
async function add(page, text, list) {
  if (list) await page.locator('#todo-list').selectOption({ label: list });
  await page.locator('#todo-text').fill(text);
  await page.locator('#todo-text').press('Enter');
}
async function goalMenu(page, text) {
  await goal(page, text).locator('[data-gmenu]').click();
  await expect(page.locator('#tmenu')).toBeVisible();
}
async function listMenu(page, name) {
  await listBar(page, name).locator('[data-lmenu]').click();
  await expect(page.locator('#tmenu')).toBeVisible();
}
// The ⋯ menu of an area task, and its "Add to list…".
async function taskMenu(page, id) {
  await page.locator('li[data-task="' + id + '"] > .row [data-imenu]').click();
  await expect(page.locator('#tmenu')).toBeVisible();
}
async function addTo(page, list) {
  await expect(dialog(page).locator('.dh')).toHaveText('Add to list');
  if (list) await page.locator('#ta-list').selectOption({ label: list });
  await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('#td')).toHaveCount(0);
}

test.describe('the My list tab', () => {
  test('a third tab; with no lists yet it says how to start, and it stays after a reload', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('.tabs.home .tab .tl-l')).toHaveText(['Quests', 'Area tasks', 'My list']);
    await tab(page).click();
    await expect(page.locator('.empty')).toHaveText('Nothing on your list yet.');
    await expect(page.getByRole('button', { name: 'New list' })).toBeVisible();
    await expect(page.locator('#todo-text')).toHaveAttribute('placeholder', 'Add a goal, like “82 Thieving”');
    expect((await stored(page, 'settings')).home).toBe('todo');
    await page.reload();
    await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page).locator('.tc')).toHaveCount(0);
  });

  test('make lists (typed, or from a suggestion), rename, move, fold and delete them', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: 'New list' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('New list');
    await page.locator('#tl-name').fill('Today');
    await page.getByRole('button', { name: 'Make list' }).click();
    await expect(names(page)).toHaveText(['Today']);
    await expect(listBar(page, 'Today').locator('.c')).toHaveText('0 / 0');
    // from a suggestion: the ones already used are not offered
    await page.getByRole('button', { name: 'New list' }).click();
    await expect(dialog(page).locator('.sugg button')).toHaveText(['This week', 'Skilling goals', 'Gathering', 'Unlocks']);
    await dialog(page).locator('.sugg button', { hasText: 'Skilling goals' }).click();
    await expect(page.locator('#tl-name')).toHaveValue('Skilling goals');
    await page.getByRole('button', { name: 'Make list' }).click();
    // the same name twice, in any case, and no name, are refused
    await page.getByRole('button', { name: 'New list' }).click();
    await page.locator('#tl-name').fill('today');
    await page.getByRole('button', { name: 'Make list' }).click();
    await expect(page.locator('#td-err')).toHaveText('You already have a list called “Today”.');
    await page.locator('#tl-name').fill('  ');
    await page.locator('#tl-name').press('Enter');
    await expect(page.locator('#td-err')).toHaveText('Type a name first.');
    await expect(page.locator('#tl-name')).toHaveAttribute('maxlength', '30');
    await page.keyboard.press('Escape');
    await expect(page.locator('#td')).toHaveCount(0);
    // rename
    await listMenu(page, 'Today');
    await expect(page.locator('#tmenu .mh')).toHaveText('Today');
    await expect(menuItems(page)).toHaveText(['Add a goal here', 'Rename', 'Move list up', 'Move list down', 'Clear done goals (0)', 'Delete list']);
    await page.locator('#tmenu .mi', { hasText: 'Rename' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Rename list');
    await expect(page.locator('#tl-name')).toHaveValue('Today');
    await page.locator('#tl-name').fill('Daily things');
    await page.getByRole('button', { name: 'Rename' }).click();
    await expect(names(page)).toHaveText(['Daily things', 'Skilling goals']);
    // move
    await listMenu(page, 'Daily things');
    await page.locator('#tmenu .mi', { hasText: 'Move list down' }).click();
    await expect(names(page)).toHaveText(['Skilling goals', 'Daily things']);
    // fold, kept after a reload
    await listBar(page, 'Skilling goals').locator('.ghb').click();
    await expect(listBar(page, 'Skilling goals').locator('.ghb')).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => ((await stored(page, 'view')) || {}).closed).toMatchObject({ ['todo:' + (await stored(page, 'todo')).lists[0].id]: true });
    await page.reload();
    await expect(listBar(page, 'Skilling goals').locator('.ghb')).toHaveAttribute('aria-expanded', 'false');
    await expect(names(page)).toHaveText(['Skilling goals', 'Daily things']);
    // an empty list goes at once
    await listMenu(page, 'Daily things');
    await page.locator('#tmenu .mi', { hasText: 'Delete list' }).click();
    await expect(names(page)).toHaveText(['Skilling goals']);
    expect(Object.keys(await saved(page))).toEqual(['Skilling goals']);
    expect(page.errors).toEqual([]);
  });

  test('a list with goals takes two clicks to delete, and Undo brings it back', async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Vis wax' }], Later: [] }));
    await listMenu(page, 'Today');
    const del = page.locator('#tmenu .mi.danger');
    await expect(del).toHaveText('Delete list');
    await del.click();
    await expect(del).toHaveText('Click again to delete the list');
    await expect(names(page)).toHaveText(['Today', 'Later']);
    await del.click();
    await expect(names(page)).toHaveText(['Later']);
    await expect(page.locator('#toast')).toContainText('Deleted Today.');
    await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    await expect(names(page)).toHaveText(['Today', 'Later']);
    expect(await saved(page)).toEqual({ Today: ['other:Vis wax'], Later: [] });
  });
});

test.describe('adding goals', () => {
  test('the box: a skill level ticks itself; anything else is a goal as you typed it', async ({ page }) => {
    await openList(page, lists({ Today: [], Gathering: [] }));
    for (const t of ['82 thieving', 'Herblore 96', '500 magic logs', 'unlock soul split', 'Vis wax', 'penguins (weekly)']) await add(page, t);
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['82 Thieving', '96 Herblore', '500 magic logs', 'Unlock soul split', 'Vis wax', 'Penguins']);
    // flat: no kind, no count, no bar
    await expect(page.locator('li.goal .tag, li.goal .num, li.goal progress, li.goal .tsub')).toHaveCount(0);
    await expect(goal(page, 'Penguins').locator('.rp')).toHaveText('weekly');
    const t = await stored(page, 'todo');
    expect(t.lists[0].items.map((x) => [x.kind, x.title || x.skill, x.level || null, x.repeat || ''])).toEqual([
      ['skill', 'thieving', 82, ''], ['skill', 'herblore', 96, ''], ['other', '500 magic logs', null, ''],
      ['other', 'Unlock soul split', null, ''], ['other', 'Vis wax', null, ''], ['other', 'Penguins', null, 'week']]);
    // a goal goes in the list picked next to the box, and that list stays picked
    await add(page, '50 vis wax', 'Gathering');
    await expect(goals(page, 'Gathering').locator('.t')).toHaveText(['50 vis wax']);
    await expect(page.locator('#toast')).toContainText('Added to Gathering.');
    await expect(page.locator('#todo-list option:checked')).toHaveText('Gathering');
    expect((await stored(page, 'todo')).last).toBe('l2');
    // Undo takes it out again
    await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    await expect(goals(page, 'Gathering')).toHaveCount(0);
    // nothing typed
    await add(page, '   ');
    await expect(page.locator('#todo-err')).toHaveText('Type a goal first.');
    // the tab counts the open goals
    await expect(tab(page).locator('.tc')).toHaveText('6');
    await expect(page.locator('.qmeta')).toHaveText('2 lists · 6 goals');
    expect(page.errors).toEqual([]);
  });

  test('with no lists, the first goal makes a list called "My list"', async ({ page }) => {
    await openList(page);
    await expect(page.locator('#todo-list option')).toHaveText(['My list']);
    await add(page, 'Vis wax');
    await expect(names(page)).toHaveText(['My list']);
    await expect(goals(page, 'My list').locator('.t')).toHaveText(['Vis wax']);
    await expect(page.locator('#toast')).toContainText('Added to My list.');
  });

  test('the Add a goal box: the goal, the list, how often, a note; and Edit', async ({ page }) => {
    await openList(page, lists({ Today: [], 'Skilling goals': [] }));
    await listMenu(page, 'Skilling goals');
    await page.locator('#tmenu .mi', { hasText: 'Add a goal here' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Add a goal');
    await expect(page.locator('#tg-list option:checked')).toHaveText('Skilling goals');
    await expect(dialog(page).locator('.seg[data-for="repeat"] button')).toHaveText(['Never', 'Daily', 'Weekly', 'Monthly']);
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#td-err')).toHaveText('Type a goal first.');
    await page.locator('#tg-text').fill('82 thieving');
    await page.locator('#tg-note').fill('For Ardougne Hard');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goals(page, 'Skilling goals').locator('.t')).toHaveText(['82 Thieving']);
    await expect(goal(page, '82 Thieving').locator('.gn')).toHaveText('For Ardougne Hard');
    // a goal that repeats daily, into another list
    await listMenu(page, 'Skilling goals');
    await page.locator('#tmenu .mi', { hasText: 'Add a goal here' }).click();
    await page.locator('#tg-text').fill('vis wax');
    await expect(dialog(page).locator('#tg-repeat-l')).toHaveText('Repeat');
    await dialog(page).locator('.seg[data-for="repeat"] button', { hasText: 'Daily' }).click();
    await expect(dialog(page).locator('.seg[data-for="repeat"] button[aria-pressed="true"]')).toHaveText('Daily');
    await page.locator('#tg-list').selectOption({ label: 'Today' });
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goal(page, 'Vis wax').locator('.rp')).toHaveText('daily');
    expect((await stored(page, 'todo')).lists[0].items[0]).toMatchObject({ kind: 'other', title: 'Vis wax', repeat: 'day' });
    // Edit: the same box, with what the goal has
    await goalMenu(page, '82 Thieving');
    await page.locator('#tmenu .mi', { hasText: 'Edit' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Edit goal');
    await expect(page.locator('#tg-text')).toHaveValue('82 Thieving');
    await expect(page.locator('#tg-note')).toHaveValue('For Ardougne Hard');
    await page.locator('#tg-text').fill('85 thieving');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(goals(page, 'Skilling goals').locator('.t')).toHaveText(['85 Thieving']);
    expect(page.errors).toEqual([]);
  });
});

test.describe('ticking and planning', () => {
  test('tick a goal: it sinks to the bottom of its list; Clear done goals removes it, Undo brings it back', async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Vis wax' }, { kind: 'other', title: 'Unlock Soul Split' }, { kind: 'other', title: 'Buy a cape' }] }));
    await goal(page, 'Vis wax').locator('.t').click();
    await expect(goal(page, 'Vis wax')).toHaveClass(/\bdone\b/);
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Unlock Soul Split', 'Buy a cape', 'Vis wax']);
    await expect(listBar(page, 'Today').locator('.c')).toHaveText('1 / 3');
    await expect(tab(page).locator('.tc')).toHaveText('2');
    await page.reload();
    await expect(goal(page, 'Vis wax').locator('.cb')).toBeChecked();
    await listMenu(page, 'Today');
    await page.locator('#tmenu .mi', { hasText: 'Clear done goals (1)' }).click();
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Unlock Soul Split', 'Buy a cape']);
    await expect(page.locator('#toast')).toContainText('Cleared 1 done goal.');
    await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    await expect(goals(page, 'Today')).toHaveCount(3);
    // untick: back with the open goals
    await goal(page, 'Vis wax').locator('.cb').click();
    await expect(goal(page, 'Vis wax')).not.toHaveClass(/\bdone\b/);
  });

  test("a goal's menu: move to another list or a new one, up and down, open it, remove it", async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Vis wax' }, { kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'other', title: 'Buy a cape' }], Gathering: [] }));
    await goalMenu(page, 'Vis wax');
    await expect(page.locator('#tmenu .mh')).toHaveText(['Vis wax', 'Move to']);
    await expect(menuItems(page)).toHaveText(['Edit', 'Today', 'Gathering', 'New list…', 'Move up', 'Move down', 'Remove']);
    await expect(page.locator('#tmenu .mi', { hasText: 'Today' })).toHaveAttribute('aria-checked', 'true');
    await page.locator('#tmenu .mi', { hasText: 'Gathering' }).click();
    await expect(goals(page, 'Gathering').locator('.t')).toHaveText(['Vis wax']);
    await expect(page.locator('#toast')).toContainText('Moved to Gathering.');
    // up and down
    await goalMenu(page, 'Buy a cape');
    await page.locator('#tmenu .mi', { hasText: 'Move up' }).click();
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Buy a cape', '82 Thieving']);
    // a skill goal opens its skill on the wiki
    await goalMenu(page, '82 Thieving');
    await expect(page.locator('#tmenu a.mi', { hasText: 'Open on the wiki' })).toHaveAttribute('href', 'https://runescape.wiki/w/Thieving');
    await page.keyboard.press('Escape');
    // to a new list
    await goalMenu(page, '82 Thieving');
    await page.locator('#tmenu .mi', { hasText: 'New list…' }).click();
    await page.locator('#tl-name').fill('Skilling goals');
    await page.getByRole('button', { name: 'Make list' }).click();
    await expect(names(page)).toHaveText(['Today', 'Gathering', 'Skilling goals']);
    await expect(goals(page, 'Skilling goals').locator('.t')).toHaveText(['82 Thieving']);
    // remove, and Undo
    await goalMenu(page, 'Buy a cape');
    await page.locator('#tmenu .mi', { hasText: 'Remove' }).click();
    await expect(goals(page, 'Today')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('Removed from Today.');
    await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Buy a cape']);
    // a click outside closes the menu
    await goalMenu(page, 'Buy a cape');
    await page.locator('.qmeta').click();
    await expect(page.locator('#tmenu')).toHaveCount(0);
    expect(page.errors).toEqual([]);
  });
});

test.describe('goals that tick themselves', () => {
  test('a skill goal ticks itself when your character has the level; you can tick it yourself too', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', {}, { 18: 79 });   // 18 is Thieving
    await openList(page, lists({ Skilling: [{ kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'skill', skill: 'herblore', level: 90 }] }));
    await lookUp(page, 'Zezima');
    await expect(goal(page, '82 Thieving')).not.toHaveClass(/\bdone\b/);
    await goal(page, '90 Herblore').locator('.cb').click();
    await expect(goal(page, '90 Herblore')).toHaveClass(/\bdone\b/);
    wiki.setPlayer('Zezima', {}, { 18: 82 });
    await openCog(page);
    await page.getByRole('button', { name: 'Update player' }).click();
    await expect(goal(page, '82 Thieving')).toHaveClass(/\bdone\b/);
    await expect(goal(page, '82 Thieving').locator('.cb')).toBeChecked();
    await expect(page.locator('li.goal .cb:disabled')).toHaveCount(0);
  });

  test('every goal can be ticked by hand, also after it was moved to another list', async ({ page, wiki }) => {
    withAllAreas(wiki);
    const all = ['Vis wax', '82 Thieving', 'While Guthix Sleeps', 'Ardougne Hard', 'Yoink!'];
    await openList(page, lists({ A: [{ kind: 'other', title: 'Vis wax' }, { kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'quest', title: 'While Guthix Sleeps' },
      { kind: 'tier', area: 'Ardougne', tier: 'hard', title: 'Ardougne Hard' }, { kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!' }], B: [] }));
    for (const t of all) {
      await goalMenu(page, t);
      await page.locator('#tmenu .mi', { hasText: /^B$/ }).click();
      await expect(goals(page, 'B').locator('.t', { hasText: t })).toHaveCount(1);
      await goal(page, t).locator('.cb').click();
      await expect(goal(page, t), t).toHaveClass(/\bdone\b/);
    }
    await expect(page.locator('li.goal .cb:disabled')).toHaveCount(0);
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1 });
    for (const t of all) {
      await goal(page, t).locator('.cb').click();
      await expect(goal(page, t), t).not.toHaveClass(/\bdone\b/);
    }
    expect(page.errors).toEqual([]);
  });

  test('a quest goes on a list from its menu, in the list you pick; it is done when the quest is', async ({ page, wiki }) => {
    await openApp(page, expect);
    // no stars in the lists
    await expect(page.locator('button.star')).toHaveCount(0);
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('#menu-btn').click();
    await page.locator('#menu .mi', { hasText: 'Add to list…' }).click();
    await expect(dialog(page).locator('.what')).toHaveText('While Guthix Sleeps');
    // no lists yet: a new one, called My list
    await expect(page.locator('#ta-list option:checked')).toHaveText('New list…');
    await expect(page.locator('#ta-name')).toHaveValue('My list');
    await addTo(page);
    await expect(page.locator('#toast')).toContainText('Added to My list.');
    await page.locator('#menu-btn').click();
    await expect(page.locator('#menu .mi', { hasText: 'Remove from My list' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'All quests' }).click();
    // Cook's Assistant too, into a second list
    await page.locator('.q[data-quest="Cook\'s Assistant"]').click();
    await page.locator('#menu-btn').click();
    await page.locator('#menu .mi', { hasText: 'Add to list…' }).click();
    await page.locator('#ta-list').selectOption({ label: 'New list…' });
    await page.locator('#ta-name').fill('my list');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#td-err')).toHaveText('You already have a list called “My list”.');
    await page.locator('#ta-name').fill('Quests');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Added to Quests.');
    await page.getByRole('button', { name: 'All quests' }).click();
    await tab(page).click();
    await expect(goals(page, 'My list').locator('.t')).toHaveText(['While Guthix Sleeps']);
    await expect(goals(page, 'Quests').locator('.t')).toHaveText(["Cook's Assistant"]);
    // ticked by hand, the quest is done in the quest list too: one tick, shown in two places
    await goal(page, 'While Guthix Sleeps').locator('.cb').click();
    await expect(goal(page, 'While Guthix Sleeps')).toHaveClass(/\bdone\b/);
    await page.locator('.tab[data-home="quests"]').click();
    await expect(page.locator('.q[data-quest="While Guthix Sleeps"]')).toHaveClass(/\bdone\b/);
    await tab(page).click();
    await goal(page, 'While Guthix Sleeps').locator('.cb').click();
    await expect(goal(page, 'While Guthix Sleeps')).not.toHaveClass(/\bdone\b/);
    // open the quest from the goal's menu
    await goalMenu(page, 'While Guthix Sleeps');
    await expect(menuItems(page)).toHaveText(['Edit', 'Open the quest', 'My list', 'Quests', 'New list…', 'Move up', 'Move down', 'Remove']);
    await page.locator('#tmenu .mi', { hasText: 'Open the quest' }).click();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    // done when the game says so
    wiki.setPlayer('Zezima', { "Cook's Assistant": 'COMPLETED' }, {});
    await page.getByRole('button', { name: 'All quests' }).click();
    await lookUp(page, 'Zezima');
    await page.keyboard.press('Escape');
    await tab(page).click();
    await expect(goal(page, "Cook's Assistant")).toHaveClass(/\bdone\b/);
    // taken off from the quest's menu
    await page.locator('.tab[data-home="quests"]').click();
    await page.locator('.q[data-quest="While Guthix Sleeps"]').click();
    await page.locator('#menu-btn').click();
    await page.locator('#menu .mi', { hasText: 'Remove from My list' }).click();
    await expect(page.locator('#toast')).toContainText('Removed from My list.');
    expect(await saved(page)).toEqual({ 'My list': [], Quests: ["quest:Cook's Assistant"] });
    expect(page.errors).toEqual([]);
  });

  test('area tasks from their ⋯ menu, a tier from the area\'s menu; one tick, shown in two places', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, { todo: lists({ Today: [], Diary: [] }) });
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await expect(page.locator('button.star')).toHaveCount(0);
    await page.locator('.q[data-area="Ardougne"][data-atier="elite"]').click();
    // the tier, from the area's menu
    await page.locator('#menu-btn').click();
    await page.locator('#menu .mi', { hasText: 'Add to list…' }).click();
    await expect(dialog(page).locator('.what')).toHaveText('Ardougne Elite');
    await expect(page.locator('#ta-list option')).toHaveText(['Today', 'Diary', 'New list…']);
    await addTo(page, 'Diary');
    await expect(page.locator('#toast')).toContainText('Added to Diary.');
    // a task, from its own menu: the list used last is picked
    await page.locator('.tab[data-tier="easy"]').click();
    await taskMenu(page, '448');
    await expect(page.locator('#tmenu .mh')).toHaveText('Yoink!');
    await expect(menuItems(page)).toHaveText(['Add to list…']);
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    await expect(dialog(page).locator('.what')).toHaveText('Yoink! · Ardougne Easy');
    await expect(page.locator('#ta-list option:checked')).toHaveText('Diary');
    await addTo(page);
    await taskMenu(page, '448');
    await expect(menuItems(page)).toHaveText(['Remove from Diary']);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'All areas' }).click();
    await tab(page).click();
    await expect(goals(page, 'Diary').locator('.t')).toHaveText(['Ardougne Elite', 'Yoink!']);
    // tick the task on the list: it is ticked in its area too
    await goal(page, 'Yoink!').locator('.cb').click();
    await expect(goal(page, 'Yoink!')).toHaveClass(/\bdone\b/);
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1 });
    await goalMenu(page, 'Yoink!');
    await page.locator('#tmenu .mi', { hasText: 'Open Ardougne Easy' }).click();
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await expect(page.locator('li[data-task="448"] > .row .cb')).toBeChecked();
    // untick it there (done tasks show with "Show done steps"): open again on the list
    await toggle(page, 'Show done steps');
    await page.locator('li[data-task="448"] > .row .cb').click();
    await page.getByRole('button', { name: 'All areas' }).click();
    await tab(page).click();
    await expect(goal(page, 'Yoink!')).not.toHaveClass(/\bdone\b/);
    // a tier is done when all its tasks are
    await page.evaluate(() => localStorage.setItem('qg1.aprog.Ardougne', JSON.stringify({ tasks: { 503: 1, 504: 1, 505: 1, 506: 1, 507: 1 } })));
    await page.reload();
    await expect(goal(page, 'Ardougne Elite')).toHaveClass(/\bdone\b/);
    expect(page.errors).toEqual([]);
  });

  test('"+ goal" next to a level you do not have: pick the list, and it is added', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', {}, { 7: 80, 16: 60 });   // Magic 80, Herblore 60
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await openQuest(page, expect, 'While Guthix Sleeps');
    const skills = page.locator('section[data-ov="skills"] ul.skl-list');
    // Magic 75 you have: no button; Herblore 65 you do not
    await expect(skills.locator('li').nth(0).locator('.addgoal')).toHaveCount(0);
    await skills.getByRole('button', { name: 'Add 65 Herblore to my list' }).click();
    await expect(dialog(page).locator('.what')).toHaveText('65 Herblore');
    await addTo(page);
    await expect(page.locator('#toast')).toContainText('Added to My list.');
    await expect(skills.getByRole('button', { name: 'Add 65 Herblore to my list' })).toHaveCount(0);
    expect(await saved(page)).toEqual({ 'My list': ['skill:65 herblore'] });
  });
});

test.describe('goals that come back', () => {
  test.use({ timezoneId: 'Europe/Amsterdam' });

  test('daily, weekly and monthly: unticked at the game\'s reset, shown in your own time', async ({ page }) => {
    // Monday 16 November 2026, 22:00 in Amsterdam (21:00 UTC)
    await page.clock.install({ time: new Date('2026-11-16T21:00:00Z') });
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Vis wax', repeat: 'day' }, { kind: 'other', title: 'Penguins', repeat: 'week' }, { kind: 'other', title: 'Herbs', repeat: 'day' },
      { kind: 'other', title: 'Bank', repeat: 'month' }] }));
    await expect(goal(page, 'Bank').locator('.rp')).toHaveText('monthly');
    for (const t of ['Vis wax', 'Penguins', 'Herbs', 'Bank']) await goal(page, t).locator('.cb').click();
    await expect(goal(page, 'Vis wax').locator('.rp')).toHaveText('back tomorrow, 01:00');
    await expect(goal(page, 'Penguins').locator('.rp')).toHaveText('back Wednesday, 01:00');
    await expect(goal(page, 'Bank').locator('.rp')).toHaveText('back 1 December, 01:00');
    // a goal that repeats stays where it is when ticked
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Vis wax', 'Penguins', 'Herbs', 'Bank']);
    // Clear done goals leaves them alone
    await listMenu(page, 'Today');
    await expect(page.locator('#tmenu .mi', { hasText: 'Clear done goals' })).toHaveText('Clear done goals (0)');
    await page.keyboard.press('Escape');
    // past the daily reset (00:00 UTC): the daily ones are back, the weekly one is not
    await page.clock.fastForward('04:00:00');
    await expect(goal(page, 'Vis wax')).not.toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Herbs')).not.toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Vis wax').locator('.rp')).toHaveText('daily');
    await expect(goal(page, 'Penguins')).toHaveClass(/\bdone\b/);
    // the app closed over Wednesday's reset: back when it opens
    await page.clock.fastForward('30:00:00');
    await page.reload();
    await expect(goal(page, 'Penguins')).not.toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Bank')).toHaveClass(/\bdone\b/);
    // the monthly reset: the 1st of the month, 00:00 UTC
    await page.clock.setSystemTime(new Date('2026-12-01T00:30:00Z'));
    await page.reload();
    await expect(goal(page, 'Bank')).not.toHaveClass(/\bdone\b/);
  });
});

test.describe('limits, storage and the look', () => {
  test('at most 300 goals and 30 lists', async ({ page }) => {
    const many = Array.from({ length: 300 }, (_, i) => ({ kind: 'other', title: 'Goal ' + (i + 1) }));
    await openList(page, lists({ Big: many }));
    await add(page, 'One more');
    await expect(page.locator('#toast')).toHaveText('You have 300 goals. Remove some first.');
    const t = lists(Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['List ' + (i + 1), []])));
    await openList(page, t);
    await page.getByRole('button', { name: 'New list' }).click();
    await expect(page.locator('#toast')).toHaveText('You have 30 lists. Delete one first.');
    await expect(page.locator('#td')).toHaveCount(0);
  });

  test('long names wrap: no sideways scrolling in a 280 px window, in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 280, height: 640 });
    for (const theme of ['brown', 'blue']) {
      await seed(page, { settings: { home: 'todo', theme }, todo: lists({ ['A list with a long name for testing']: [{ kind: 'other', title: 'A goal with a very long name that has to wrap onto more lines', note: 'And a note that is long too', repeat: 'week' }, { kind: 'other', title: 'Uncut dragonstones' }] }) });
      await page.goto('/');
      await expect(page.locator('li.goal')).toHaveCount(2);
      expect(await page.evaluate(() => { const m = document.getElementById('main'); return m.scrollWidth > m.clientWidth || document.documentElement.scrollWidth > innerWidth; })).toBe(false);
    }
  });

  test('broken saved lists do not stop the app; goals of an older kind become plain goals; Delete everything deletes the lists', async ({ page }) => {
    await seed(page, { settings: { home: 'todo' }, todo: { v: 1, lists: [{ id: 'x', name: 'Fine', items: [{ id: 'a', kind: 'nonsense' }, { id: 'b', kind: 'other', title: 'Kept' }, null,
      { id: 'c', kind: 'item', title: 'Magic logs', have: 320, want: 500 }, { id: 'd', kind: 'unlock', title: 'Soul Split' }] }, 'junk', { name: 7 }] } });
    await page.goto('/');
    await expect(names(page)).toHaveText(['Fine']);
    await expect(goals(page, 'Fine').locator('.t')).toHaveText(['Kept', '500 Magic logs', 'Unlock Soul Split']);
    expect(page.errors).toEqual([]);
    await openCog(page);
    await page.locator('[data-act="wipe"]').click();
    await page.locator('[data-act="wipe"]').click();
    expect(await stored(page, 'todo')).toBeNull();
    await page.locator('.tab[data-home="todo"]').click();
    await expect(page.locator('.empty')).toHaveText('Nothing on your list yet.');
  });
});

test.describe('the window', () => {
  test('the title band stays on every screen; the way back, the name and its menu are in a bar under it', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await expect(page.locator('.sbar')).toHaveCount(0);
    await openQuest(page, expect, 'While Guthix Sleeps');
    await expect(page.locator('.hdr .qt')).toHaveText('Quick Guide');
    await expect(page.locator('.hdr img.emb')).toBeVisible();
    await expect(page.locator('.hdr [data-act="change"]')).toHaveCount(0);
    const bar = page.locator('.sbar');
    await expect(bar.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    await expect(bar.locator('[data-act="change"]')).toHaveAttribute('aria-label', 'All quests');
    await expect(bar.locator('#menu-btn')).toBeVisible();
    const hb = await page.locator('.hdr').boundingBox(), bb = await bar.boundingBox();
    expect(bb.y).toBeGreaterThanOrEqual(hb.y + hb.height - 1);
    await page.getByRole('button', { name: 'All quests' }).click();
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(page.locator('.hdr .qt')).toHaveText('Quick Guide');
    await expect(page.locator('.sbar h1.qt')).toHaveText('Ardougne');
    await expect(page.locator('.sbar [data-act="change"]')).toHaveAttribute('aria-label', 'All areas');
  });
});

test.describe('export and import', () => {
  async function exportText(page) {
    await openCog(page);
    await page.getByRole('button', { name: 'Export state' }).click();
    await expect(page.locator('#bk-text')).not.toHaveValue('');
    const t = await page.locator('#bk-text').inputValue();
    await page.getByRole('button', { name: 'Close' }).click();
    return t;
  }
  async function importText(page, text) {
    await openCog(page);
    await page.getByRole('button', { name: 'Import state' }).click();
    await page.locator('#bk-text').fill(text);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
  }

  test('every list and goal goes out, and comes back the same', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openList(page, lists({
      Today: [{ kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!' }, { kind: 'other', title: 'Vis wax', repeat: 'day', done: Date.now() }, { kind: 'other', title: 'Unlock Soul Split', note: 'Needs a quest' }],
      'Skilling goals': [{ kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'quest', title: 'While Guthix Sleeps' }, { kind: 'tier', area: 'Ardougne', tier: 'hard', title: 'Ardougne Hard' }],
      Gathering: [{ kind: 'other', title: '500 Magic logs' }],
      Empty: []
    }));
    const j = JSON.parse(await exportText(page));
    expect(Object.keys(j)).toContain('mylist');
    expect(j.mylist).toEqual({
      Today: { 'Task 448: Yoink! (Ardougne Easy)': false, 'Vis wax (daily)': true, 'Unlock Soul Split': { done: false, note: 'Needs a quest' } },
      'Skilling goals': { '82 Thieving': false, 'Quest: While Guthix Sleeps': false, 'Tier: Ardougne Hard': false },
      Gathering: { '500 Magic logs': false },
      Empty: {}
    });
    // a fresh start, then the file: the same lists
    const before = await saved(page);
    await seed(page, { settings: { home: 'todo' } });
    await page.goto('/');
    await importText(page, JSON.stringify(j));
    await expect(page.locator('#toast')).toContainText(' and 4 lists.');
    expect(await saved(page)).toEqual(before);
    expect((await stored(page, 'todo')).lists[0].items[2]).toMatchObject({ note: 'Needs a quest' });
  });

  test('goals typed by hand in the file are read like the add box reads them; a file without lists leaves yours', async ({ page }) => {
    await openList(page, lists({ Mine: [{ kind: 'other', title: 'Keep me' }] }));
    await importText(page, JSON.stringify({ app: 'Quick Guide', format: 2, settings: {} }));
    expect(await saved(page)).toEqual({ Mine: ['other:Keep me'] });
    await importText(page, JSON.stringify({ app: 'Quick Guide', format: 2, mylist: { Week: { '96 herblore': false, '1,000 yew logs': '10 / 1,000', 'unlock: overloads': true, 'Do the dishes': false, 'Penguins (every week)': false, 'Bank (monthly)': false } } }));
    expect(await saved(page)).toEqual({ Week: ['skill:96 herblore', 'other:1,000 yew logs', 'other:Unlock: overloads', 'other:Do the dishes', 'other:Penguins', 'other:Bank'] });
    const t = await stored(page, 'todo');
    expect(t.lists[0].items.map((x) => [x.done ? 1 : 0, x.repeat || ''])).toEqual([[0, ''], [0, ''], [1, ''], [0, ''], [0, 'week'], [0, 'month']]);
  });
});
