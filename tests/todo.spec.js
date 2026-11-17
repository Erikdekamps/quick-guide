// My list: your own lists of goals (docs/my-list-plan.md). A third tab on the start screen.
// Lists have names you choose. A goal is one flat row: a tick box, what it says, and its menu. You can tick any goal;
// skill levels, quests and tiers also tick themselves; an area task shares its tick with its area, a quest with the
// quest list; a goal can repeat daily, weekly or monthly.
// Quests, tiers, tasks and levels you miss go on a list from their ⋯ menu (or "+ goal"), in a box where you pick the list.
// Every list ends with a box to type the next goal in. A goal can have sub tasks, and those their own; a goal you
// wrote yourself can become a list, and gets a link to its wiki page when there is one.
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
// The box at the end of a list (the first list's, when none is named).
const addBox = (page, list) => (list ? listBar(page, list).locator('xpath=following-sibling::ul[1]') : page).locator('form.qadd:not(.sadd) input').first();
async function add(page, text, list) {
  await addBox(page, list).fill(text);
  await addBox(page, list).press('Enter');
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

test.describe('the My list tab', () => {
  test('a third tab; with no lists yet it says how to start, and it stays after a reload', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('.tabs.home .tab .tl-l')).toHaveText(['Quests', 'Area tasks', 'My list']);
    await tab(page).click();
    await expect(page.locator('.empty')).toHaveText('Nothing on your list yet.');
    await expect(page.getByRole('button', { name: 'New list' })).toBeVisible();
    // a goal needs a list: no box to type one in yet
    await expect(page.locator('form.qadd')).toHaveCount(0);
    await expect(page.locator('.plain.start li').first()).toContainText('Start with New list.');
    expect((await stored(page, 'settings')).home).toBe('todo');
    await page.reload();
    await expect(tab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page).locator('.tc')).toHaveCount(0);
  });

  test('make lists, rename, move, fold and delete them', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: 'New list' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('New list');
    await page.locator('#tl-name').fill('Today');
    await page.getByRole('button', { name: 'Make list' }).click();
    await expect(names(page)).toHaveText(['Today']);
    await expect(listBar(page, 'Today').locator('.c')).toHaveText('0 / 0');
    // the box only asks for a name; Cancel closes it
    await page.getByRole('button', { name: 'New list' }).click();
    await expect(dialog(page).locator('.fld')).toHaveCount(1);
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('#td')).toHaveCount(0);
    await page.getByRole('button', { name: 'New list' }).click();
    await page.locator('#tl-name').fill('Skilling goals');
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
  test('the box at the end of a list: a skill level ticks itself; anything else is a goal as you typed it', async ({ page }) => {
    await openList(page, lists({ Today: [], Gathering: [] }));
    await expect(page.locator('#todo-form')).toHaveCount(0);
    await expect(addBox(page, 'Today')).toHaveAttribute('placeholder', 'Add a goal');
    await expect(addBox(page, 'Today')).toHaveAttribute('aria-label', 'Add a goal to Today');
    // one after the other: the box empties and keeps the cursor
    for (const t of ['82 thieving', 'Herblore 96', '500 magic logs', 'unlock soul split', 'Vis wax', 'penguins (weekly)']) {
      await add(page, t);
      await expect(addBox(page, 'Today')).toBeFocused();
      await expect(addBox(page, 'Today')).toHaveValue('');
    }
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['82 Thieving', '96 Herblore', '500 magic logs', 'Unlock soul split', 'Vis wax', 'Penguins']);
    // flat: no kind, no count, no bar
    await expect(page.locator('li.goal .tag, li.goal .num, li.goal progress, li.goal .tsub')).toHaveCount(0);
    await expect(goal(page, 'Penguins').locator('.rp')).toHaveText('weekly');
    const t = await stored(page, 'todo');
    expect(t.lists[0].items.map((x) => [x.kind, x.title || x.skill, x.level || null, x.repeat || ''])).toEqual([
      ['skill', 'thieving', 82, ''], ['skill', 'herblore', 96, ''], ['other', '500 magic logs', null, ''],
      ['other', 'Unlock soul split', null, ''], ['other', 'Vis wax', null, ''], ['other', 'Penguins', null, 'week']]);
    // each list has its own box; the button adds too
    await addBox(page, 'Gathering').fill('50 vis wax');
    await listBar(page, 'Gathering').locator('xpath=following-sibling::ul[1]').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goals(page, 'Gathering').locator('.t')).toHaveText(['50 vis wax']);
    await expect(page.locator('#toast')).toBeHidden();
    expect((await stored(page, 'todo')).last).toBe('l2');
    // nothing typed
    await add(page, '   ', 'Gathering');
    await expect(listBar(page, 'Gathering').locator('xpath=following-sibling::ul[1]').locator('.qadd .err')).toHaveText('Type a goal first.');
    await addBox(page, 'Gathering').pressSequentially('x');
    await expect(page.locator('.qadd .err:visible')).toHaveCount(0);
    // the tab counts the open goals
    await expect(tab(page).locator('.tc')).toHaveText('7');
    await expect(page.locator('.qmeta')).toHaveText('2 lists · 7 goals');
    // a folded list hides its box
    await listBar(page, 'Today').locator('.ghb').click();
    await expect(addBox(page, 'Today')).toBeHidden();
    expect(page.errors).toEqual([]);
  });

  test('with no lists there is no box: make a list first, then type goals in it', async ({ page }) => {
    await openList(page);
    await expect(page.locator('form.qadd')).toHaveCount(0);
    await page.getByRole('button', { name: 'New list' }).click();
    await page.locator('#tl-name').fill('Today');
    await page.locator('#tl-name').press('Enter');
    await add(page, 'Vis wax');
    await expect(addBox(page, 'Today')).toBeFocused();
    await add(page, 'Herbs');
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Vis wax', 'Herbs']);
    expect(page.errors).toEqual([]);
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
  test('tick a goal: it stays where it is, struck through; Clear done goals removes it, Undo brings it back', async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Vis wax' }, { kind: 'other', title: 'Unlock Soul Split' }, { kind: 'other', title: 'Buy a cape' }] }));
    await goal(page, 'Vis wax').locator('.t').click();
    await expect(goal(page, 'Vis wax')).toHaveClass(/\bdone\b/);
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Vis wax', 'Unlock Soul Split', 'Buy a cape']);
    // the next one is still under the mouse: tick two in a row
    await goal(page, 'Unlock Soul Split').locator('.t').click();
    await expect(page.locator('li.goal.done .t')).toHaveText(['Vis wax', 'Unlock Soul Split']);
    await goal(page, 'Unlock Soul Split').locator('.cb').click();
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Vis wax', 'Unlock Soul Split', 'Buy a cape']);
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
    await expect(menuItems(page)).toHaveText(['Edit', 'Add sub task', 'Make it a list', 'Today', 'Gathering', 'New list…', 'Move up', 'Move down', 'Remove']);
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

test.describe('sub tasks', () => {
  const subs = (page, text) => goal(page, text).locator('li.gsub');
  const sub = (page, text) => page.locator('li.gsub').filter({ has: page.locator(':scope > .row .t', { hasText: new RegExp('^' + text + '$') }) });
  const subBox = (page) => page.locator('form.sadd input');
  // Types sub tasks into the box that "Add sub task" opens, one after the other.
  async function typeSubs(page, list) {
    await expect(subBox(page)).toBeFocused();
    for (const s of list) {
      await subBox(page).fill(s);
      await subBox(page).press('Enter');
      await expect(subBox(page)).toBeFocused();
      await expect(subBox(page)).toHaveValue('');
    }
  }
  async function addSubs(page, text, list) {
    await goalMenu(page, text);
    await page.locator('#tmenu .mi', { hasText: 'Add sub task' }).click();
    await expect(subBox(page)).toHaveAttribute('aria-label', 'Add a sub task to ' + text);
    await typeSubs(page, list);
    await subBox(page).press('Escape');
    await expect(subBox(page)).toHaveCount(0);
  }
  async function subMenu(page, text) {
    await sub(page, text).locator(':scope > .row [data-smenu]').click();
    await expect(page.locator('#tmenu')).toBeVisible();
  }

  test('a goal gets its own small checklist; it is done when every sub task is, and ticking it ticks them all', async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Ardougne Hard' }, { kind: 'other', title: 'Vis wax' }] }));
    await addSubs(page, 'Ardougne Hard', ['82 Thieving', 'buy a rope']);
    await expect(subs(page, 'Ardougne Hard').locator('.t')).toHaveText(['82 Thieving', 'Buy a rope']);
    await expect(goal(page, 'Ardougne Hard').locator('.row .sc').first()).toHaveText('0 / 2');
    // one by one: the goal is done with the last one
    await subs(page, 'Ardougne Hard').nth(0).locator('.cb').click();
    await expect(goal(page, 'Ardougne Hard').locator('.row .sc').first()).toHaveText('1 / 2');
    await expect(goal(page, 'Ardougne Hard')).not.toHaveClass(/\bdone\b/);
    await subs(page, 'Ardougne Hard').nth(1).locator('.t').click();
    await expect(goal(page, 'Ardougne Hard')).toHaveClass(/\bdone\b/);
    await expect(listBar(page, 'Today').locator('.c')).toHaveText('1 / 2');
    // unticking the goal unticks them all; ticking it ticks them all
    await goal(page, 'Ardougne Hard').locator('.row > .cb').first().click();
    await expect(subs(page, 'Ardougne Hard').locator('.cb:checked')).toHaveCount(0);
    await goal(page, 'Ardougne Hard').locator('.row > .cb').first().click();
    await expect(subs(page, 'Ardougne Hard').locator('.cb:checked')).toHaveCount(2);
    // a sub task unticked: the goal is open again
    await subs(page, 'Ardougne Hard').nth(0).locator('.cb').click();
    await expect(goal(page, 'Ardougne Hard')).not.toHaveClass(/\bdone\b/);
    // kept after a reload
    await page.reload();
    await expect(subs(page, 'Ardougne Hard').locator('.t')).toHaveText(['82 Thieving', 'Buy a rope']);
    await expect(subs(page, 'Ardougne Hard').locator('.cb:checked')).toHaveCount(1);
    // nothing typed; the × closes the box
    await goalMenu(page, 'Vis wax');
    await page.locator('#tmenu .mi', { hasText: 'Add sub task' }).click();
    await subBox(page).press('Enter');
    await expect(page.locator('.sadd .err')).toHaveText('Type a sub task first.');
    await page.locator('.sadd').getByRole('button', { name: 'Close' }).click();
    await expect(subBox(page)).toHaveCount(0);
    const t = await stored(page, 'todo');
    // a level typed as a sub task is a level, like in a list
    expect(t.lists[0].items[0].subs.map((x) => [x.kind || '', x.title || x.level + ' ' + x.skill, x.done ? 1 : 0])).toEqual([['skill', '82 thieving', 0], ['', 'Buy a rope', 1]]);
    expect(page.errors).toEqual([]);
  });

  test("a sub task's menu: edit it, move it up, down and out, and delete it with a second click", async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Ardougne Hard', subs: [{ id: 'a', title: 'Rope' }, { id: 'b', title: 'Lockpick' }, { id: 'c', title: 'Spade' }] }] }));
    await expect(page.locator('[data-subx]')).toHaveCount(0);
    await expect(sub(page, 'Rope').getByRole('button', { name: 'Sub task menu: Rope' })).toBeVisible();
    await subMenu(page, 'Rope');
    await expect(page.locator('#tmenu .mh').first()).toHaveText('Rope');
    await expect(menuItems(page)).toHaveText(['Edit', 'Add sub task', 'Move up', 'Move down', 'Make it a goal', 'Delete']);
    await expect(page.locator('#tmenu .mi', { hasText: 'Move up' })).toBeDisabled();
    // the same button closes it
    await sub(page, 'Rope').locator('[data-smenu]').click();
    await expect(page.locator('#tmenu')).toHaveCount(0);
    // edit
    await subMenu(page, 'Rope');
    await page.locator('#tmenu .mi', { hasText: 'Edit' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Edit sub task');
    await expect(page.locator('#ts-text')).toHaveValue('Rope');
    await page.locator('#ts-text').fill(' ');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#td-err')).toHaveText('Type a sub task first.');
    await page.locator('#ts-text').fill('a long rope');
    await page.locator('#ts-text').press('Enter');
    await expect(subs(page, 'Ardougne Hard').locator('.t')).toHaveText(['A long rope', 'Lockpick', 'Spade']);
    // down and up
    await subMenu(page, 'A long rope');
    await page.locator('#tmenu .mi', { hasText: 'Move down' }).click();
    await expect(subs(page, 'Ardougne Hard').locator('.t')).toHaveText(['Lockpick', 'A long rope', 'Spade']);
    await subMenu(page, 'Spade');
    await expect(page.locator('#tmenu .mi', { hasText: 'Move down' })).toBeDisabled();
    await page.locator('#tmenu .mi', { hasText: 'Move up' }).click();
    await expect(subs(page, 'Ardougne Hard').locator('.t')).toHaveText(['Lockpick', 'Spade', 'A long rope']);
    // delete: the first click asks, the second deletes; Undo brings it back
    await subMenu(page, 'Spade');
    await page.locator('#tmenu .mi.danger').click();
    await expect(page.locator('#tmenu .mi.danger')).toHaveText('Click again to delete');
    await expect(subs(page, 'Ardougne Hard')).toHaveCount(3);
    await page.locator('#tmenu .mi.danger').click();
    await expect(subs(page, 'Ardougne Hard').locator('.t')).toHaveText(['Lockpick', 'A long rope']);
    await expect(page.locator('#toast')).toContainText('Deleted Spade.');
    await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    await expect(subs(page, 'Ardougne Hard')).toHaveCount(3);
    // closing the menu forgets the first click
    await subMenu(page, 'Spade');
    await page.locator('#tmenu .mi.danger').click();
    await page.keyboard.press('Escape');
    await subMenu(page, 'Spade');
    await expect(page.locator('#tmenu .mi.danger')).toHaveText('Delete');
    await page.keyboard.press('Escape');
    // out: it becomes a goal of the list, right after its goal
    await subMenu(page, 'Lockpick');
    await page.locator('#tmenu .mi', { hasText: 'Make it a goal' }).click();
    await expect(goals(page, 'Today').locator(':scope > .row .t')).toHaveText(['Ardougne Hard', 'Lockpick']);
    await expect(subs(page, 'Ardougne Hard').locator('.t')).toHaveText(['Spade', 'A long rope']);
    expect(page.errors).toEqual([]);
  });

  test('sub tasks have their own sub tasks, four deep; each is done when all of its own are', async ({ page }) => {
    await openList(page, lists({ Gear: [{ kind: 'other', title: 'Hatchet of bloom and blight' }] }));
    await addSubs(page, 'Hatchet of bloom and blight', ['Hatchet of ember and glade', 'Blight shard']);
    await subMenu(page, 'Hatchet of ember and glade');
    await page.locator('#tmenu .mi', { hasText: 'Add sub task' }).click();
    await expect(subBox(page)).toHaveAttribute('aria-label', 'Add a sub task to Hatchet of ember and glade');
    await typeSubs(page, ['Crystal hatchet', 'Ember shard']);
    await subBox(page).press('Escape');
    const mid = sub(page, 'Hatchet of ember and glade');
    await expect(mid.locator('li.gsub .t')).toHaveText(['Crystal hatchet', 'Ember shard']);
    await expect(mid.locator(':scope > .row .sc')).toHaveText('0 / 2');
    await expect(goal(page, 'Hatchet of bloom and blight').locator(':scope > .row .sc')).toHaveText('0 / 2');
    // the inner ones done: the one above them is done
    await sub(page, 'Crystal hatchet').locator('.cb').click();
    await expect(mid).not.toHaveClass(/\bdone\b/);
    await sub(page, 'Ember shard').locator('.cb').click();
    await expect(mid).toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Hatchet of bloom and blight').locator(':scope > .row .sc')).toHaveText('1 / 2');
    await sub(page, 'Blight shard').locator('.cb').click();
    await expect(goal(page, 'Hatchet of bloom and blight')).toHaveClass(/\bdone\b/);
    // one inner one unticked: everything above it is open again
    await sub(page, 'Ember shard').locator('.cb').click();
    await expect(mid).not.toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Hatchet of bloom and blight')).not.toHaveClass(/\bdone\b/);
    // ticking the middle one ticks what is under it
    await mid.locator(':scope > .row > .cb').click();
    await expect(mid.locator('li.gsub .cb:checked')).toHaveCount(2);
    await expect(goal(page, 'Hatchet of bloom and blight')).toHaveClass(/\bdone\b/);
    // a new sub task under a done one opens it again
    await subMenu(page, 'Crystal hatchet');
    await page.locator('#tmenu .mi', { hasText: 'Add sub task' }).click();
    await typeSubs(page, ['Crystal tool seed']);
    await subBox(page).press('Escape');
    await expect(sub(page, 'Crystal hatchet')).not.toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Hatchet of bloom and blight')).not.toHaveClass(/\bdone\b/);
    // four deep, and no deeper
    await subMenu(page, 'Crystal tool seed');
    await page.locator('#tmenu .mi', { hasText: 'Add sub task' }).click();
    await typeSubs(page, ['Sing it']);
    await subBox(page).press('Escape');
    await subMenu(page, 'Sing it');
    await expect(page.locator('#tmenu .mi', { hasText: 'Add sub task' })).toBeDisabled();
    // out one level: next to the one it was under
    await expect(page.locator('#tmenu .mi', { hasText: 'Move out a level' })).toBeVisible();
    await page.locator('#tmenu .mi', { hasText: 'Move out a level' }).click();
    await expect(sub(page, 'Crystal tool seed').locator('xpath=following-sibling::li[1]').locator(':scope > .row .t')).toHaveText('Sing it');
    // kept after a reload
    await page.reload();
    await expect(sub(page, 'Hatchet of ember and glade').locator('li.gsub .t')).toHaveText(['Crystal hatchet', 'Crystal tool seed', 'Sing it', 'Ember shard']);
    const g = (await stored(page, 'todo')).lists[0].items[0];
    expect(g.subs[0].subs[0].subs[0].title).toBe('Crystal tool seed');
    expect(page.errors).toEqual([]);
  });

  test('at most 20 sub tasks; a goal that repeats unticks its sub tasks too', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-16T21:00:00Z') });
    const many = Array.from({ length: 20 }, (_, i) => ({ id: 's' + i, title: 'Step ' + (i + 1) }));
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Big', subs: many }, { kind: 'other', title: 'Dailies', repeat: 'day', subs: [{ id: 'a', title: 'Vis wax', subs: [{ id: 'a1', title: 'Rune one' }] }, { id: 'b', title: 'Herbs' }] }] }));
    await goalMenu(page, 'Big');
    await page.locator('#tmenu .mi', { hasText: 'Add sub task' }).click();
    await expect(page.locator('#toast')).toHaveText('A goal has at most 20 sub tasks.');
    await expect(subBox(page)).toHaveCount(0);
    await goal(page, 'Dailies').locator('.row > .cb').first().click();
    await expect(goal(page, 'Dailies').locator('li.gsub .cb:checked')).toHaveCount(3);
    await page.clock.fastForward('04:00:00');
    await expect(goal(page, 'Dailies')).not.toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Dailies').locator('li.gsub .cb:checked')).toHaveCount(0);
  });
});

test.describe('a goal becomes a list', () => {
  test('"Make it a list": its sub tasks are the goals of a new list with its name', async ({ page }) => {
    await openList(page, lists({
      Today: [{ kind: 'other', title: 'Hatchet of bloom and blight', subs: [{ id: 'a', title: 'Hatchet of ember and glade', done: 1, subs: [{ id: 'a1', title: 'Crystal hatchet', done: 1 }] }, { id: 'b', title: 'Blight shard' }] },
        { kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'other', title: 'Today' }, { kind: 'other', title: 'A goal with a name that is far too long for a list' }],
      Later: []
    }));
    // only for goals you wrote yourself
    await goalMenu(page, '82 Thieving');
    await expect(page.locator('#tmenu .mi', { hasText: 'Make it a list' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await goalMenu(page, 'Hatchet of bloom and blight');
    await page.locator('#tmenu .mi', { hasText: 'Make it a list' }).click();
    // the new list comes right after the one the goal was in
    await expect(names(page)).toHaveText(['Today', 'Hatchet of bloom and blight', 'Later']);
    await expect(goals(page, 'Today').locator(':scope > .row .t')).toHaveText(['82 Thieving', 'Today', 'A goal with a name that is far too long for a list']);
    await expect(goals(page, 'Hatchet of bloom and blight').locator(':scope > .row .t')).toHaveText(['Hatchet of ember and glade', 'Blight shard']);
    await expect(goal(page, 'Hatchet of ember and glade')).toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Hatchet of ember and glade').locator('li.gsub .t')).toHaveText(['Crystal hatchet']);
    await expect(page.locator('#toast')).toContainText('Made the list Hatchet of bloom and blight.');
    // Undo
    await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    await expect(names(page)).toHaveText(['Today', 'Later']);
    await expect(goals(page, 'Today').locator(':scope > .row .t').first()).toHaveText('Hatchet of bloom and blight');
    // a name that is taken gets a number; a long one is cut; a goal without sub tasks makes an empty list
    await goalMenu(page, /^Today$/);
    await page.locator('#tmenu .mi', { hasText: 'Make it a list' }).click();
    await goalMenu(page, 'A goal with a name');
    await page.locator('#tmenu .mi', { hasText: 'Make it a list' }).click();
    await expect(names(page)).toHaveText(['Today', 'A goal with a name that is far', 'Today 2', 'Later']);
    await expect(goals(page, 'Today 2')).toHaveCount(0);
    expect(page.errors).toEqual([]);
  });

  test('not with 30 lists already', async ({ page }) => {
    const o = { Today: [{ kind: 'other', title: 'Big plan' }] };
    for (let i = 2; i <= 30; i++) o['List ' + i] = [];
    await openList(page, lists(o));
    await goalMenu(page, 'Big plan');
    await page.locator('#tmenu .mi', { hasText: 'Make it a list' }).click();
    await expect(page.locator('#toast')).toHaveText('You have 30 lists. Delete one first.');
    await expect(goals(page, 'Today')).toHaveCount(1);
  });
});

test.describe('a link to the wiki', () => {
  const link = (page) => page.locator('#tmenu a.mi', { hasText: 'Open on the wiki' });
  const wikiOf = async (page) => (await stored(page, 'todo')).lists[0].items.map((g) => g.wiki);

  test('a goal you wrote gets "Open on the wiki" when the wiki has a page for it', async ({ page, wiki }) => {
    wiki.exists('Crystal hatchet').exists('Magic logs').exists('Soul Split').exists('Vis wax').exists('Rope');
    await openList(page, lists({ Gear: [{ kind: 'other', title: 'Crystal Hatchet', subs: [{ id: 'a', title: 'Rope' }, { id: 'b', title: 'Ask Erik' }] }, { kind: 'other', title: '500 Magic logs' },
      { kind: 'other', title: 'Unlock Soul Split' }, { kind: 'other', title: 'Vis wax (daily)' }, { kind: 'other', title: 'Do my own thing' }, { kind: 'skill', skill: 'magic', level: 75 }] }));
    // as typed, with small letters, without a number or "Unlock" in front
    await expect.poll(() => wikiOf(page)).toEqual(['Crystal hatchet', 'Magic logs', 'Soul Split', 'Vis wax', '', undefined]);
    await goalMenu(page, 'Crystal Hatchet');
    await expect(link(page)).toHaveAttribute('href', 'https://runescape.wiki/w/Crystal_hatchet');
    await expect(link(page)).toHaveAttribute('target', '_blank');
    await link(page).click();
    await expect(page.locator('#tmenu')).toHaveCount(0);
    await goalMenu(page, '500 Magic logs');
    await expect(link(page)).toHaveAttribute('href', 'https://runescape.wiki/w/Magic_logs');
    await page.keyboard.press('Escape');
    await goalMenu(page, 'Do my own thing');
    await expect(link(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    // sub tasks too
    await page.locator('li.gsub', { hasText: 'Rope' }).locator('[data-smenu]').click();
    await expect(link(page)).toHaveAttribute('href', 'https://runescape.wiki/w/Rope');
    await page.keyboard.press('Escape');
    await page.locator('li.gsub', { hasText: 'Ask Erik' }).locator('[data-smenu]').click();
    await expect(link(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    // asked once: not again after a reload
    const n = wiki.lookups.length;
    expect(n).toBeGreaterThan(0);
    await page.reload();
    await expect(goal(page, 'Crystal Hatchet')).toBeVisible();
    await page.waitForTimeout(200);
    expect(wiki.lookups.length).toBe(n);
    // a new goal is looked up; a goal with a new name is looked up again
    wiki.exists('Bones', 'Bones (item)');
    await add(page, 'bones');
    await expect.poll(async () => (await wikiOf(page))[6]).toBe('Bones (item)');
    await goalMenu(page, 'Crystal Hatchet');
    await page.locator('#tmenu .mi', { hasText: 'Edit' }).click();
    await page.locator('#tg-text').fill('Dragon hatchet');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect.poll(async () => (await wikiOf(page))[0]).toBe('');
    // its sub tasks stay
    await expect(goal(page, 'Dragon hatchet').locator('li.gsub .t')).toHaveText(['Rope', 'Ask Erik']);
    expect(page.errors).toEqual([]);
  });

  test('the wiki does not answer: no link, and the app works', async ({ page, wiki }) => {
    wiki.exists('Crystal hatchet');
    wiki.lookupFail = true;
    await openList(page, lists({ Gear: [{ kind: 'other', title: 'Crystal hatchet' }] }));
    await expect.poll(() => wiki.lookups.length).toBe(1);
    await goalMenu(page, 'Crystal hatchet');
    await expect(link(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    // asked again the next time the app starts
    wiki.lookupFail = false;
    await page.reload();
    await expect.poll(() => wikiOf(page)).toEqual(['Crystal hatchet']);
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
    await expect(menuItems(page)).toHaveText(['Edit', 'Add sub task', 'Open the quest', 'My list', 'Quests', 'New list…', 'Move up', 'Move down', 'Remove']);
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

  test('Add to list asks where it goes: the end or the top of the list, or under a goal or a sub task', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, { todo: lists({
      Diary: [{ kind: 'other', title: 'Ardougne', subs: [{ id: 'a', title: 'Easy ones' }] }, { kind: 'other', title: 'Later' }],
      Other: [{ kind: 'other', title: 'Elsewhere' }]
    }) });
    await openApp(page, expect);
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await taskMenu(page, '448');
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    // the places of the list that is picked
    await expect(dialog(page).locator('label[for="ta-place"]')).toHaveText('Place');
    await expect(page.locator('#ta-place option')).toHaveText(['At the end of the list', 'At the top of the list', 'Under: Ardougne', 'Under: — Easy ones', 'Under: Later']);
    await expect(page.locator('#ta-place option:checked')).toHaveText('At the end of the list');
    await page.locator('#ta-list').selectOption({ label: 'Other' });
    await expect(page.locator('#ta-place option')).toHaveText(['At the end of the list', 'At the top of the list', 'Under: Elsewhere']);
    // a new list has no places yet
    await page.locator('#ta-list').selectOption({ label: 'New list…' });
    await expect(page.locator('#ta-place')).toBeHidden();
    await page.locator('#ta-list').selectOption({ label: 'Diary' });
    await expect(page.locator('#ta-place')).toBeVisible();
    // under a sub task
    await page.locator('#ta-place').selectOption({ label: 'Under: — Easy ones' });
    await addTo(page);
    await expect(page.locator('#toast')).toContainText('Added to Diary.');
    await taskMenu(page, '448');
    await expect(menuItems(page)).toHaveText(['Remove from Diary']);
    await page.keyboard.press('Escape');
    // at the top of the list
    await taskMenu(page, '447');
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    await page.locator('#ta-place').selectOption({ label: 'At the top of the list' });
    await addTo(page);
    // a level, under a goal
    await page.getByRole('button', { name: 'All areas' }).click();
    await tab(page).click();
    await expect(goals(page, 'Diary').locator(':scope > .row .t')).toHaveText(['The Essence of Magic', 'Ardougne', 'Later']);
    const easy = page.locator('li.gsub').filter({ has: page.locator(':scope > .row .t', { hasText: 'Easy ones' }) });
    const yoink = easy.locator('li.gsub');
    await expect(yoink.locator('.t')).toHaveText(['Yoink!']);
    await expect(easy.locator(':scope > .row .sc')).toHaveText('0 / 1');
    // its menu: no Edit (it says what the task is called), and the way to its area
    await yoink.locator('[data-smenu]').click();
    await expect(menuItems(page)).toHaveText(['Add sub task', 'Open Ardougne Easy', 'Move up', 'Move down', 'Move out a level', 'Delete']);
    await page.keyboard.press('Escape');
    // one tick: ticked here, it is ticked in its area, and what it is under is done
    await yoink.locator('.cb').click();
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1 });
    await expect(yoink).toHaveClass(/\bdone\b/);
    await expect(easy).toHaveClass(/\bdone\b/);
    await expect(goal(page, /^Ardougne$/)).toHaveClass(/\bdone\b/);
    // unticked in its area: open again here
    await yoink.locator('[data-smenu]').click();
    await page.locator('#tmenu .mi', { hasText: 'Open Ardougne Easy' }).click();
    await toggle(page, 'Show done steps');
    await page.locator('li[data-task="448"] > .row .cb').click();
    await page.getByRole('button', { name: 'All areas' }).click();
    await tab(page).click();
    await expect(yoink).not.toHaveClass(/\bdone\b/);
    // the file says which task it is, and it comes back as one
    const j = JSON.parse(await exportText(page));
    expect(j.mylist.Diary.Ardougne).toEqual({ done: false, subs: { 'Easy ones': { done: false, subs: { 'Task 448: Yoink! (Ardougne Easy)': false } } } });
    await importText(page, JSON.stringify(j));
    expect((await stored(page, 'todo')).lists[0].items[1].subs[0].subs[0]).toMatchObject({ kind: 'task', area: 'Ardougne', task: '448', title: 'Yoink!' });
    // "Remove from …" in the task's menu takes it out from under its goal
    await page.locator('.tab[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await taskMenu(page, '448');
    await page.locator('#tmenu .mi', { hasText: 'Remove from Diary' }).click();
    await page.getByRole('button', { name: 'All areas' }).click();
    await tab(page).click();
    await expect(page.locator('li.gsub .t')).toHaveText(['Easy ones']);
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
  test('every list and goal goes out, and comes back the same', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openList(page, lists({
      Today: [{ kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!' }, { kind: 'other', title: 'Vis wax', repeat: 'day', done: Date.now() }, { kind: 'other', title: 'Unlock Soul Split', note: 'Needs a quest' }],
      'Skilling goals': [{ kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'quest', title: 'While Guthix Sleeps' }, { kind: 'tier', area: 'Ardougne', tier: 'hard', title: 'Ardougne Hard' }],
      Gathering: [{ kind: 'other', title: '500 Magic logs', subs: [{ id: 'a', title: 'Cut 250', done: 1 }, { id: 'b', title: 'Cut 250 more', subs: [{ id: 'b1', title: 'Sharpen', done: 1 }, { id: 'b2', title: 'Sharpen' }] }] }],
      Empty: []
    }));
    const j = JSON.parse(await exportText(page));
    expect(Object.keys(j)).toContain('mylist');
    expect(j.mylist).toEqual({
      Today: { 'Task 448: Yoink! (Ardougne Easy)': false, 'Vis wax (daily)': true, 'Unlock Soul Split': { done: false, note: 'Needs a quest' } },
      'Skilling goals': { '82 Thieving': false, 'Quest: While Guthix Sleeps': false, 'Tier: Ardougne Hard': false },
      Gathering: { '500 Magic logs': { done: false, subs: { 'Cut 250': true, 'Cut 250 more': { done: false, subs: { Sharpen: true, 'Sharpen #2': false } } } } },
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
    const back = (await stored(page, 'todo')).lists[2].items[0].subs;
    expect(back.map((x) => [x.title, x.done ? 1 : 0])).toEqual([['Cut 250', 1], ['Cut 250 more', 0]]);
    expect(back[1].subs.map((x) => [x.title, x.done ? 1 : 0])).toEqual([['Sharpen', 1], ['Sharpen', 0]]);
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
