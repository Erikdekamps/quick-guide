// My list: your own lists of goals (docs/my-list-plan.md). A third tab on the start screen.
// Lists have names you choose; goals are skill levels, items with a count, unlocks, quests, area tasks and tiers,
// and anything else. Some tick themselves; some come back every day or every week.
const { test, expect, seed, stored, openApp, openQuest, openTab, openCog, lookUp, withAllAreas, toggle } = require('./support/app');

const WGS = 'While Guthix Sleeps/Quick guide';
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
  for (const l of (t && t.lists) || []) out[l.name] = l.items.map((x) => x.kind + ':' + (x.kind === 'skill' ? x.level + ' ' + x.skill : x.title || x.task || x.tier));
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
  test('the box reads what you type: skill levels, items with a count, unlocks, and anything else', async ({ page }) => {
    await openList(page, lists({ Today: [], Gathering: [] }));
    for (const t of ['82 thieving', 'Herblore 96', '500 magic logs', 'yew logs x1,000', '2k oak logs', 'unlock soul split', 'Vis wax', 'penguins (every week)']) await add(page, t);
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['82 Thieving', '96 Herblore', 'Magic logs', 'Yew logs', 'Oak logs', 'Unlock Soul split', 'Vis wax', 'Penguins']);
    await expect(goals(page, 'Today').locator('.tag')).toHaveText(['Skill', 'Skill', 'Item', 'Item', 'Item', 'Unlock', 'Goal', 'Weekly']);
    await expect(goal(page, 'Yew logs').locator('.numv')).toHaveValue('0');
    await expect(goal(page, 'Yew logs').locator('.of')).toHaveText('/ 1,000');
    await expect(goal(page, 'Oak logs').locator('.tsub')).toContainText('2,000 to go');
    const t = await stored(page, 'todo');
    expect(t.lists[0].items.map((x) => [x.kind, x.title || x.skill, x.level || x.want || null, x.repeat || ''])).toEqual([
      ['skill', 'thieving', 82, ''], ['skill', 'herblore', 96, ''], ['item', 'Magic logs', 500, ''], ['item', 'Yew logs', 1000, ''],
      ['item', 'Oak logs', 2000, ''], ['unlock', 'Soul split', null, ''], ['other', 'Vis wax', null, ''], ['other', 'Penguins', null, 'week']]);
    // a goal goes in the list picked next to the box, and that list stays picked
    await add(page, '50 vis wax', 'Gathering');
    await expect(goals(page, 'Gathering').locator('.t')).toHaveText(['Vis wax']);
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
    await expect(tab(page).locator('.tc')).toHaveText('8');
    await expect(page.locator('.qmeta')).toHaveText('2 lists · 8 goals');
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

  test('the full Add a goal box: every kind, the list, how often, a note; and Edit', async ({ page }) => {
    await openList(page, lists({ Today: [], 'Skilling goals': [] }));
    await listMenu(page, 'Skilling goals');
    await page.locator('#tmenu .mi', { hasText: 'Add a goal here' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Add a goal');
    await expect(dialog(page).locator('.seg[data-for="kind"] button')).toHaveText(['Skill', 'Item', 'Unlock', 'Other']);
    await expect(page.locator('#tg-list option:checked')).toHaveText('Skilling goals');
    // a skill: no "how often" (it ticks itself)
    await dialog(page).locator('.seg[data-for="kind"] button', { hasText: 'Skill' }).click();
    await expect(dialog(page).locator('.seg[data-for="repeat"]')).toHaveCount(0);
    await page.locator('#tg-skill').selectOption('Thieving');
    await page.locator('#tg-level').fill('82');
    await page.locator('#tg-note').fill('For Ardougne Hard');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goals(page, 'Skilling goals').locator('.t')).toHaveText(['82 Thieving']);
    await expect(goal(page, '82 Thieving').locator('.tsub')).toContainText('For Ardougne Hard');
    // a level out of range is refused
    await listMenu(page, 'Skilling goals');
    await page.locator('#tmenu .mi', { hasText: 'Add a goal here' }).click();
    await dialog(page).locator('.seg[data-for="kind"] button', { hasText: 'Skill' }).click();
    await page.locator('#tg-level').fill('150');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#td-err')).toHaveText('A level is 2 to 120.');
    // an item that comes back every day, into another list
    await dialog(page).locator('.seg[data-for="kind"] button', { hasText: 'Item' }).click();
    await page.locator('#tg-title').fill('Vis wax');
    await page.locator('#tg-want').fill('50');
    await dialog(page).locator('.seg[data-for="repeat"] button', { hasText: 'Every day' }).click();
    await page.locator('#tg-list').selectOption({ label: 'Today' });
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goal(page, 'Vis wax').locator('.tag')).toHaveText(['Item', 'Daily']);
    expect((await stored(page, 'todo')).lists[0].items[0]).toMatchObject({ kind: 'item', title: 'Vis wax', want: 50, have: 0, repeat: 'day' });
    // an unlock: it needs what to unlock
    await listMenu(page, 'Today');
    await page.locator('#tmenu .mi', { hasText: 'Add a goal here' }).click();
    await expect(dialog(page).locator('.seg[data-for="kind"] button[aria-pressed="true"]')).toHaveText('Other');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#td-err')).toHaveText('Type a goal first.');
    await dialog(page).locator('.seg[data-for="kind"] button', { hasText: 'Unlock' }).click();
    await expect(dialog(page).locator('label[for="tg-title"]')).toHaveText('What to unlock');
    await page.locator('#tg-title').fill('soul Split');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goal(page, 'Unlock Soul Split').locator('.tag')).toHaveText('Unlock');
    // Edit: the same box, with what the goal has
    await goalMenu(page, '82 Thieving');
    await page.locator('#tmenu .mi', { hasText: 'Edit' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Edit goal');
    await expect(page.locator('#tg-level')).toHaveValue('82');
    await expect(page.locator('#tg-note')).toHaveValue('For Ardougne Hard');
    await page.locator('#tg-level').fill('85');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(goals(page, 'Skilling goals').locator('.t')).toHaveText(['85 Thieving']);
    expect(page.errors).toEqual([]);
  });
});

test.describe('ticking and planning', () => {
  test('tick a goal: it sinks to the bottom of its list; Clear done goals removes it, Undo brings it back', async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Vis wax' }, { kind: 'unlock', title: 'Soul Split' }, { kind: 'other', title: 'Buy a cape' }] }));
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

  test('item goals: − and +, or type how many you have; done at the target', async ({ page }) => {
    await openList(page, lists({ Gathering: [{ kind: 'item', title: 'Magic logs', have: 498, want: 500 }] }));
    const g = goal(page, 'Magic logs');
    await expect(g.locator('.tsub')).toContainText('2 to go');
    await expect(g.locator('.cb')).toBeDisabled();
    await g.getByRole('button', { name: 'One more' }).click();
    await g.getByRole('button', { name: 'One more' }).click();
    await expect(g).toHaveClass(/\bdone\b/);
    await expect(g.locator('.cb')).toBeChecked();
    await g.getByRole('button', { name: 'One less' }).click();
    await expect(g).not.toHaveClass(/\bdone\b/);
    await g.locator('.numv').fill('250');
    await g.locator('.numv').press('Enter');
    await expect(g.locator('.tsub')).toContainText('250 to go');
    await expect(g.locator('progress')).toHaveAttribute('value', '250');
    expect((await stored(page, 'todo')).lists[0].items[0]).toMatchObject({ have: 250, want: 500 });
  });
});

test.describe('goals that tick themselves', () => {
  test('a skill goal follows your character: your level, how far to go, done when you get there', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', {}, { 18: 79 });   // 18 is Thieving
    await openList(page, lists({ Skilling: [{ kind: 'skill', skill: 'thieving', level: 82 }] }));
    const g = goal(page, '82 Thieving');
    await expect(g.locator('.tsub')).toContainText('Look up your character to track it');
    await expect(g.locator('.cb')).toBeDisabled();
    await lookUp(page, 'Zezima');
    await expect(g.locator('.tsub')).toContainText('Now 79 · 3 levels to go');
    await expect(g.locator('.tsub img.sic')).toHaveAttribute('src', 'https://runescape.wiki/images/Thieving-icon.png');
    await expect(g.locator('progress')).toHaveAttribute('value', '79');
    wiki.setPlayer('Zezima', {}, { 18: 82 });
    await page.getByRole('button', { name: 'Update player' }).click();
    await expect(goal(page, '82 Thieving')).toHaveClass(/\bdone\b/);
  });

  test('stars on quests, in the list and in a quest; a quest goal is done when the quest is', async ({ page, wiki }) => {
    await openApp(page, expect);
    const star = page.locator('.q[data-quest="Imp Catcher"]').locator('xpath=following-sibling::button[contains(@class, "star")]');
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#toast')).toContainText('Added to My list.');
    await openQuest(page, expect, 'While Guthix Sleeps');
    const hstar = page.locator('.hdr button.star');
    await expect(hstar).toHaveAttribute('aria-label', 'Add to my list');
    await hstar.click();
    await expect(hstar).toHaveAttribute('aria-pressed', 'true');
    await expect(hstar).toHaveAttribute('aria-label', 'On my list');
    await page.getByRole('button', { name: 'All quests' }).click();
    await tab(page).click();
    await expect(goals(page, 'My list').locator('.t')).toHaveText(['Imp Catcher', 'While Guthix Sleeps']);
    await expect(goals(page, 'My list').locator('.tag')).toHaveText(['Quest', 'Quest']);
    await expect(goal(page, 'While Guthix Sleeps').locator('.tsub')).toContainText('0 / 12 steps');
    await expect(goal(page, 'Imp Catcher').locator('.tsub')).toContainText('Not started');
    // a quest goal's box: only its list and note can change
    await goalMenu(page, 'While Guthix Sleeps');
    await expect(menuItems(page)).toHaveText(['Edit', 'Open the quest', 'My list', 'New list…', 'Move up', 'Move down', 'Remove']);
    await page.locator('#tmenu .mi', { hasText: 'Edit' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Edit goal');
    await expect(dialog(page).locator('.seg')).toHaveCount(0);
    await expect(dialog(page).locator('.para')).toHaveText('While Guthix Sleeps · Quest');
    await page.locator('#tg-note').fill('After the Temple at Senntisten');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(goal(page, 'While Guthix Sleeps').locator('.tsub')).toContainText('After the Temple at Senntisten');
    // the quest's name opens it
    await goal(page, 'While Guthix Sleeps').locator('.t button').click();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    // done when the game says so
    wiki.setPlayer('Zezima', { 'Imp Catcher': 'COMPLETED' }, {});
    await page.getByRole('button', { name: 'All quests' }).click();
    await lookUp(page, 'Zezima');
    await page.keyboard.press('Escape');
    await tab(page).click();
    await expect(goal(page, 'Imp Catcher')).toHaveClass(/\bdone\b/);
    // a star pressed again takes it off
    await page.locator('.tab[data-home="quests"]').click();
    await page.locator('.q[data-quest="Imp Catcher"]').locator('xpath=following-sibling::button[contains(@class, "star")]').click();
    await expect(page.locator('#toast')).toContainText('Removed from My list.');
    expect(await saved(page)).toEqual({ 'My list': ['quest:While Guthix Sleeps'] });
    expect(page.errors).toEqual([]);
  });

  test('"Change list" in the message puts a starred goal in another list', async ({ page }) => {
    await seed(page, { todo: lists({ Today: [], Gathering: [] }) });
    await openApp(page, expect);
    await page.locator('.q[data-quest="Imp Catcher"]').locator('xpath=following-sibling::button[contains(@class, "star")]').click();
    await expect(page.locator('#toast')).toContainText('Added to Today.');
    await page.locator('#toast').getByRole('button', { name: 'Change list' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Put it in');
    await expect(dialog(page).locator('.sugg button')).toHaveText(['Today', 'Gathering']);
    await expect(dialog(page).locator('.sugg button[aria-pressed="true"]')).toHaveText('Today');
    await dialog(page).locator('.sugg button', { hasText: 'Gathering' }).click();
    await expect(page.locator('#td')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('Moved to Gathering.');
    expect(await saved(page)).toEqual({ Today: [], Gathering: ['quest:Imp Catcher'] });
    // the next star goes to the list it was moved to
    expect((await stored(page, 'todo')).last).toBe('l2');
  });

  test('stars on area tasks and tiers: one tick, shown in two places', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, { todo: lists({ Diary: [] }) });
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    const tierStar = page.locator('button.star[data-star="tier"][data-sarea="Ardougne"][data-stier="elite"]');
    await tierStar.click();
    await expect(page.locator('#toast')).toContainText('Added to Diary.');
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    const yoink = page.locator('li[data-task="448"] > .row .star');
    await expect(yoink).toHaveAttribute('aria-pressed', 'false');
    await yoink.click();
    await expect(yoink).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'All areas' }).click();
    await tab(page).click();
    await expect(goals(page, 'Diary').locator('.tag')).toHaveText(['Tier', 'Task']);
    await expect(goal(page, 'Ardougne Elite').locator('.tsub')).toContainText('0 / 5 tasks');
    await expect(goal(page, 'Yoink!').locator('.tsub')).toContainText('Ardougne Easy');
    // tick the task on the list: it is ticked in its area too
    await goal(page, 'Yoink!').locator('.cb').click();
    await expect(goal(page, 'Yoink!')).toHaveClass(/\bdone\b/);
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1 });
    await goal(page, 'Yoink!').locator('.t button').click();
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

  test('"+ goal" next to a level you do not have adds it', async ({ page, wiki }) => {
    wiki.setPlayer('Zezima', {}, { 7: 80, 16: 60 });   // Magic 80, Herblore 60
    await openApp(page, expect);
    await lookUp(page, 'Zezima');
    await openQuest(page, expect, 'While Guthix Sleeps');
    const skills = page.locator('section[data-ov="skills"] ul.skl-list');
    // Magic 75 you have: no button; Herblore 65 you do not
    await expect(skills.locator('li').nth(0).locator('.addgoal')).toHaveCount(0);
    await skills.getByRole('button', { name: 'Add 65 Herblore to my list' }).click();
    await expect(page.locator('#toast')).toContainText('Added to My list.');
    await expect(skills.getByRole('button', { name: 'Add 65 Herblore to my list' })).toHaveCount(0);
    expect(await saved(page)).toEqual({ 'My list': ['skill:65 herblore'] });
  });
});

test.describe('goals that come back', () => {
  test.use({ timezoneId: 'Europe/Amsterdam' });

  test('every day and every week: unticked at the game\'s reset, shown in your own time', async ({ page }) => {
    // Monday 16 November 2026, 22:00 in Amsterdam (21:00 UTC)
    await page.clock.install({ time: new Date('2026-11-16T21:00:00Z') });
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Vis wax', repeat: 'day' }, { kind: 'other', title: 'Penguins', repeat: 'week' }, { kind: 'item', title: 'Herbs', want: 10, have: 0, repeat: 'day' }] }));
    await goal(page, 'Vis wax').locator('.cb').click();
    await goal(page, 'Penguins').locator('.cb').click();
    await expect(goal(page, 'Vis wax').locator('.tsub')).toContainText('Back tomorrow, 01:00');
    await expect(goal(page, 'Penguins').locator('.tsub')).toContainText('Back Wednesday, 01:00');
    // a goal that comes back stays where it is when ticked
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Vis wax', 'Penguins', 'Herbs']);
    await goal(page, 'Herbs').locator('.numv').fill('10');
    await goal(page, 'Herbs').locator('.numv').press('Enter');
    await expect(goal(page, 'Herbs')).toHaveClass(/\bdone\b/);
    // Clear done goals leaves them alone
    await listMenu(page, 'Today');
    await expect(page.locator('#tmenu .mi', { hasText: 'Clear done goals' })).toHaveText('Clear done goals (0)');
    await page.keyboard.press('Escape');
    // past the daily reset (00:00 UTC): the daily ones are back, the weekly one is not
    await page.clock.fastForward('04:00:00');
    await expect(goal(page, 'Vis wax')).not.toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Herbs').locator('.numv')).toHaveValue('0');
    await expect(goal(page, 'Penguins')).toHaveClass(/\bdone\b/);
    // the app closed over Wednesday's reset: back when it opens
    await page.clock.fastForward('30:00:00');
    await page.reload();
    await expect(goal(page, 'Penguins')).not.toHaveClass(/\bdone\b/);
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
      await seed(page, { settings: { home: 'todo', theme }, todo: lists({ ['A list with a long name for testing']: [{ kind: 'other', title: 'A goal with a very long name that has to wrap onto more lines' }, { kind: 'item', title: 'Uncut dragonstones', have: 1234, want: 100000 }] }) });
      await page.goto('/');
      await expect(page.locator('li.goal')).toHaveCount(2);
      expect(await page.evaluate(() => { const m = document.getElementById('main'); return m.scrollWidth > m.clientWidth || document.documentElement.scrollWidth > innerWidth; })).toBe(false);
    }
  });

  test('broken saved lists do not stop the app; Delete everything deletes the lists', async ({ page }) => {
    await seed(page, { settings: { home: 'todo' }, todo: { v: 1, lists: [{ id: 'x', name: 'Fine', items: [{ id: 'a', kind: 'nonsense' }, { id: 'b', kind: 'other', title: 'Kept' }, null] }, 'junk', { name: 7 }] } });
    await page.goto('/');
    await expect(names(page)).toHaveText(['Fine']);
    await expect(goals(page, 'Fine').locator('.t')).toHaveText(['Kept']);
    expect(page.errors).toEqual([]);
    await openCog(page);
    await page.locator('[data-act="wipe"]').click();
    await page.locator('[data-act="wipe"]').click();
    expect(await stored(page, 'todo')).toBeNull();
    await page.locator('.tab[data-home="todo"]').click();
    await expect(page.locator('.empty')).toHaveText('Nothing on your list yet.');
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
      Today: [{ kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!' }, { kind: 'other', title: 'Vis wax', repeat: 'day', done: Date.now() }, { kind: 'unlock', title: 'Soul Split', note: 'Needs a quest' }],
      'Skilling goals': [{ kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'quest', title: 'While Guthix Sleeps' }, { kind: 'tier', area: 'Ardougne', tier: 'hard', title: 'Ardougne Hard' }],
      Gathering: [{ kind: 'item', title: 'Magic logs', have: 320, want: 500 }],
      Empty: []
    }));
    const j = JSON.parse(await exportText(page));
    expect(Object.keys(j)).toContain('mylist');
    expect(j.mylist).toEqual({
      Today: { 'Task 448: Yoink! (Ardougne Easy)': false, 'Vis wax (every day)': true, 'Unlock: Soul Split': { done: false, note: 'Needs a quest' } },
      'Skilling goals': { '82 Thieving': false, 'Quest: While Guthix Sleeps': false, 'Tier: Ardougne Hard': false },
      Gathering: { '500 Magic logs': '320 / 500' },
      Empty: {}
    });
    // a fresh start, then the file: the same lists
    const before = await saved(page);
    await seed(page, { settings: { home: 'todo' } });
    await page.goto('/');
    await importText(page, JSON.stringify(j));
    await expect(page.locator('#toast')).toContainText(' and 4 lists.');
    expect(await saved(page)).toEqual(before);
    expect((await stored(page, 'todo')).lists[2].items[0]).toMatchObject({ have: 320, want: 500 });
  });

  test('goals typed by hand in the file are read like the add box reads them; a file without lists leaves yours', async ({ page }) => {
    await openList(page, lists({ Mine: [{ kind: 'other', title: 'Keep me' }] }));
    await importText(page, JSON.stringify({ app: 'Quick Guide', format: 2, settings: {} }));
    expect(await saved(page)).toEqual({ Mine: ['other:Keep me'] });
    await importText(page, JSON.stringify({ app: 'Quick Guide', format: 2, mylist: { Week: { '96 herblore': false, '1,000 yew logs': '10 / 1,000', 'unlock: overloads': true, 'Do the dishes': false, 'Penguins (every week)': false } } }));
    expect(await saved(page)).toEqual({ Week: ['skill:96 herblore', 'item:Yew logs', 'unlock:Overloads', 'other:Do the dishes', 'other:Penguins'] });
    const t = await stored(page, 'todo');
    expect(t.lists[0].items.map((x) => [x.have, x.done ? 1 : 0, x.repeat || ''])).toEqual([[undefined, 0, ''], [10, 0, ''], [undefined, 1, ''], [undefined, 0, ''], [undefined, 0, 'week']]);
  });
});
