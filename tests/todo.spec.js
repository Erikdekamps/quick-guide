// My list: your own lists of goals. A third tab on the start screen.
// Lists have names you choose. A goal is one flat row: a tick box, what it says, and its menu. You can tick any goal;
// skill levels, quests and tiers also tick themselves; an area task shares its tick with its area, a quest with the
// quest list.
// Quests, tiers, tasks and levels you miss go on a list from their ⋯ menu (or "+ goal"), in a box where you pick the list.
// Every list ends with a box to type the next goal in. A goal can have sub tasks, and those their own; a goal you
// wrote yourself can become a list, and gets a link to its wiki page when there is one.
const { test, expect, seed, stored, openApp, openQuest, openSettings, closeSettings, lookUp, withAllAreas, toggle, deleteEverything } = require('./support/app');

const tab = (page) => page.locator('.bn[data-home="todo"]');
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
  await expect(tab(page)).toHaveAttribute('aria-current', 'page');
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
  await openSettings(page);
  await page.getByRole('button', { name: 'Export state' }).click();
  await expect(page.locator('#bk-text')).not.toHaveValue('');
  const t = await page.locator('#bk-text').inputValue();
  await page.getByRole('button', { name: 'Close' }).click();
  return t;
}
async function importText(page, text) {
  await openSettings(page);
  await page.getByRole('button', { name: 'Import state' }).click();
  await page.locator('#bk-text').fill(text);
  await page.getByRole('button', { name: 'Import', exact: true }).click();
}

test.describe('the My list tab', () => {
  test('a third tab; with no lists yet it says how to start, and it stays after a reload', async ({ page }) => {
    await openApp(page, expect);
    await expect(page.locator('.bnav .bn .bnl')).toHaveText(['Quests', 'Achievements', 'My list', 'Settings']);
    await tab(page).click();
    await expect(page.locator('.empty')).toHaveText('Nothing on your list yet.');
    await expect(page.getByRole('button', { name: 'Create list' })).toBeVisible();
    // a goal needs a list: no box to type one in yet
    await expect(page.locator('form.qadd')).toHaveCount(0);
    await expect(page.locator('.plain.start li').first()).toContainText('Start with Create list, or Import list');
    expect((await stored(page, 'settings')).home).toBe('todo');
    await page.reload();
    await expect(tab(page)).toHaveAttribute('aria-current', 'page');
    await expect(tab(page).locator('.tc')).toHaveCount(0);
  });

  test('make lists, rename, move, fold and delete them', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: 'Create list' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Create list');
    await page.locator('#tl-name').fill('Today');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(names(page)).toHaveText(['Today']);
    await expect(listBar(page, 'Today').locator('.c')).toHaveText('0 / 0');
    // the box only asks for a name; Cancel closes it
    await page.getByRole('button', { name: 'Create list' }).click();
    await expect(dialog(page).locator('.fld')).toHaveCount(1);
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('#td')).toHaveCount(0);
    await page.getByRole('button', { name: 'Create list' }).click();
    await page.locator('#tl-name').fill('Skilling goals');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    // the same name twice, in any case, and no name, are refused
    await page.getByRole('button', { name: 'Create list' }).click();
    await page.locator('#tl-name').fill('today');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
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
    await expect(menuItems(page)).toHaveText(['Add a goal here', 'Paste a list…', 'Copy as text…', 'Rename', 'Move list up', 'Move list down', 'Clear done goals (0)', 'Delete list']);
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
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['82 Thieving', '96 Herblore', '500 magic logs', 'Unlock soul split', 'Vis wax', 'Penguins (weekly)']);
    // flat: no kind, no count, no bar
    await expect(page.locator('li.goal .tag, li.goal .num, li.goal progress, li.goal .tsub')).toHaveCount(0);
    // "(weekly)" is only text: nothing repeats
    await expect(page.locator('li.goal .rp')).toHaveCount(0);
    const t = await stored(page, 'todo');
    expect(t.lists[0].items.map((x) => [x.kind, x.title || x.skill, x.level || null, x.repeat || ''])).toEqual([
      ['skill', 'thieving', 82, ''], ['skill', 'herblore', 96, ''], ['other', '500 magic logs', null, ''],
      ['other', 'Unlock soul split', null, ''], ['other', 'Vis wax', null, ''], ['other', 'Penguins (weekly)', null, '']]);
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
    await page.getByRole('button', { name: 'Create list' }).click();
    await page.locator('#tl-name').fill('Today');
    await page.locator('#tl-name').press('Enter');
    await add(page, 'Vis wax');
    await expect(addBox(page, 'Today')).toBeFocused();
    await add(page, 'Herbs');
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Vis wax', 'Herbs']);
    expect(page.errors).toEqual([]);
  });

  test('the Add a goal box: the goal, the list, its parent, a note; and Edit', async ({ page }) => {
    await openList(page, lists({ Today: [], 'Skilling goals': [] }));
    await listMenu(page, 'Skilling goals');
    await page.locator('#tmenu .mi', { hasText: 'Add a goal here' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Add a goal');
    await expect(page.locator('#tg-list option:checked')).toHaveText('Skilling goals');
    await expect(dialog(page).locator('.fld > label')).toHaveText(['Goal', 'List', 'Parent', 'Note (optional)']);
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#td-err')).toHaveText('Type a goal first.');
    await page.locator('#tg-text').fill('82 thieving');
    await page.locator('#tg-note').fill('For Ardougne Hard');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goals(page, 'Skilling goals').locator('.t')).toHaveText(['82 Thieving']);
    await expect(goal(page, '82 Thieving').locator('.gn')).toHaveText('For Ardougne Hard');
    // into another list
    await listMenu(page, 'Skilling goals');
    await page.locator('#tmenu .mi', { hasText: 'Add a goal here' }).click();
    await page.locator('#tg-text').fill('vis wax');
    await page.locator('#tg-list').selectOption({ label: 'Today' });
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Vis wax']);
    expect((await stored(page, 'todo')).lists[0].items[0]).toMatchObject({ kind: 'other', title: 'Vis wax' });
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
    await page.getByRole('button', { name: 'Create', exact: true }).click();
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
    await expect(page.locator('#tg-text')).toHaveValue('Rope');
    await expect(dialog(page).locator('label[for="tg-text"]')).toHaveText('Sub task');
    await page.locator('#tg-text').fill(' ');
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#td-err')).toHaveText('Type a sub task first.');
    await page.locator('#tg-text').fill('a long rope');
    await page.locator('#tg-text').press('Enter');
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

  test('at most 20 sub tasks; a goal saved as one that repeats is a plain goal now, and stays ticked', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-16T21:00:00Z') });
    const many = Array.from({ length: 20 }, (_, i) => ({ id: 's' + i, title: 'Step ' + (i + 1) }));
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Big', subs: many }, { kind: 'other', title: 'Dailies', repeat: 'day', subs: [{ id: 'a', title: 'Vis wax', subs: [{ id: 'a1', title: 'Rune one' }] }, { id: 'b', title: 'Herbs' }] }] }));
    await goalMenu(page, 'Big');
    await page.locator('#tmenu .mi', { hasText: 'Add sub task' }).click();
    await expect(page.locator('#toast')).toHaveText('A goal has at most 20 sub tasks.');
    await expect(subBox(page)).toHaveCount(0);
    await goal(page, 'Dailies').locator('.row > .cb').first().click();
    await expect(goal(page, 'Dailies').locator('li.gsub .cb:checked')).toHaveCount(3);
    await expect(page.locator('li.goal .rp')).toHaveCount(0);
    expect((await stored(page, 'todo')).lists[0].items[1].repeat).toBeUndefined();
    // past the game's daily reset, and after a reload: still ticked
    await page.clock.fastForward('04:00:00');
    await page.reload();
    await expect(goal(page, 'Dailies')).toHaveClass(/\bdone\b/);
    await expect(goal(page, 'Dailies').locator('li.gsub .cb:checked')).toHaveCount(3);
  });
});

test.describe('Edit: another parent', () => {
  const parents = (page) => page.locator('#tg-parent option');
  async function edit(page, row) {
    await row.locator(':scope > .row [data-gmenu], :scope > .row [data-smenu]').click();
    await page.locator('#tmenu .mi', { hasText: 'Edit' }).click();
  }
  const sub = (page, text) => page.locator('li.gsub').filter({ has: page.locator(':scope > .row .t', { hasText: new RegExp('^' + text + '$') }) });

  test('a goal goes under another goal or sub task; a sub task goes under another, to another list, or out', async ({ page }) => {
    await openList(page, lists({
      Today: [{ kind: 'other', title: 'Alpha', subs: [{ id: 'a1', title: 'Inner', subs: [{ id: 'a1x', title: 'Deep' }] }] }, { kind: 'other', title: 'Beta' }, { kind: 'other', title: 'Gamma', note: 'bring food' }],
      Later: [{ kind: 'other', title: 'Delta' }]
    }));
    // a goal: every goal and sub task of its list can be its parent, but not itself
    await edit(page, goal(page, 'Gamma'));
    await expect(dialog(page).locator('label[for="tg-parent"]')).toHaveText('Parent');
    await expect(parents(page)).toHaveText(['None', 'Alpha', '— Inner', '— — Deep', 'Beta']);
    await expect(page.locator('#tg-parent option:checked')).toHaveText('None');
    // another parent picked: what you typed stays
    await page.locator('#tg-text').fill('Gamma ray');
    await page.locator('#tg-parent').selectOption({ label: 'Alpha' });
    await expect(page.locator('#tg-text')).toHaveValue('Gamma ray');
    await expect(page.locator('#tg-parent')).toBeFocused();
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(goals(page, 'Today').locator(':scope > .row .t')).toHaveText(['Alpha', 'Beta']);
    await expect(goal(page, 'Alpha').locator(':scope > .gsubs > li.gsub > .row .t')).toHaveText(['Inner', 'Gamma ray']);
    // its note went with it
    await expect(sub(page, 'Gamma ray').locator('.gn')).toHaveText('bring food');
    // a sub task: not under itself or what is under it
    await edit(page, sub(page, 'Inner'));
    await expect(dialog(page).locator('.dh')).toHaveText('Edit sub task');
    await expect(parents(page)).toHaveText(['None', 'Alpha', '— Gamma ray', 'Beta']);
    await expect(page.locator('#tg-parent option:checked')).toHaveText('Alpha');
    // no parent: it is a goal at the end of the list, with what was under it
    await page.locator('#tg-parent').selectOption({ label: 'None' });
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(goals(page, 'Today').locator(':scope > .row .t')).toHaveText(['Alpha', 'Beta', 'Inner']);
    await expect(goal(page, 'Inner').locator('li.gsub .t')).toHaveText(['Deep']);
    // to another list, under a goal there
    await edit(page, sub(page, 'Gamma ray'));
    await page.locator('#tg-list').selectOption({ label: 'Later' });
    await expect(parents(page)).toHaveText(['None', 'Delta']);
    await page.locator('#tg-parent').selectOption({ label: 'Delta' });
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(goal(page, 'Delta').locator('li.gsub .t')).toHaveText(['Gamma ray']);
    await expect(goal(page, 'Alpha').locator('li.gsub')).toHaveCount(0);
    // saved without a change: it stays where it is
    await edit(page, sub(page, 'Gamma ray'));
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(goal(page, 'Delta').locator('li.gsub .t')).toHaveText(['Gamma ray']);
    // a goal under a parent
    await edit(page, goal(page, 'Beta'));
    await page.locator('#tg-parent').selectOption({ label: 'Alpha' });
    await dialog(page).getByRole('button', { name: 'Save' }).click();
    const t = await stored(page, 'todo');
    expect(t.lists[0].items.map((g) => g.title)).toEqual(['Alpha', 'Inner']);
    expect(t.lists[0].items[0].subs).toMatchObject([{ title: 'Beta' }]);
    expect(t.lists[1].items[0].subs).toMatchObject([{ title: 'Gamma ray', note: 'bring food' }]);
    expect(page.errors).toEqual([]);
  });

  test('a new goal can start under a parent; a parent that is full or too deep is not offered', async ({ page }) => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: 's' + i, title: 'Step ' + (i + 1) }));
    await openList(page, lists({ Today: [
      { kind: 'other', title: 'Full', subs: many },
      { kind: 'other', title: 'Tall', subs: [{ id: 't1', title: 'T1', subs: [{ id: 't2', title: 'T2', subs: [{ id: 't3', title: 'T3', subs: [{ id: 't4', title: 'T4' }] }] }] }] },
      { kind: 'other', title: 'Pair', subs: [{ id: 'p1', title: 'P1' }] }] }));
    await listMenu(page, 'Today');
    await page.locator('#tmenu .mi', { hasText: 'Add a goal here' }).click();
    // Full has 20; T4 is four deep
    const opts = await parents(page).allTextContents();
    expect(opts.filter((o) => !/Step/.test(o))).toEqual(['None', 'Tall', '— T1', '— — T2', '— — — T3', 'Pair', '— P1']);
    expect(opts.filter((o) => /Step/.test(o)).length).toBe(20);
    await page.locator('#tg-text').fill('82 thieving');
    await page.locator('#tg-parent').selectOption({ label: '— P1' });
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(sub(page, 'P1').locator('li.gsub .t')).toHaveText(['82 Thieving']);
    await expect(page.locator('#toast')).toContainText('Added to Today.');
    // Pair, with two levels under it, fits under Tall and T1, and no deeper
    await edit(page, goal(page, 'Pair'));
    expect((await parents(page).allTextContents()).filter((o) => !/Step/.test(o))).toEqual(['None', 'Tall', '— T1']);
    await page.keyboard.press('Escape');
    expect(page.errors).toEqual([]);
  });
});

test.describe('a list as text', () => {
  const box = (page) => page.locator('#tp-text');
  async function pasteBox(page, list) {
    await listMenu(page, list);
    await page.locator('#tmenu .mi', { hasText: 'Paste a list…' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Paste a list');
  }
  // What a list holds, as lines: two spaces for each level, "x" in front of what is done.
  async function outline(page, n) {
    const l = (await stored(page, 'todo')).lists[n];
    const out = [];
    const walk = (x, depth) => {
      out.push('  '.repeat(depth) + (x.done ? 'x ' : '') + (x.kind === 'skill' ? x.level + ' ' + x.skill : x.title));
      (x.subs || []).forEach((u) => walk(u, depth + 1));
    };
    l.items.forEach((g) => walk(g, 0));
    return out;
  }

  test('"Import list": a new list with a name, its goals from text', async ({ page }) => {
    await openList(page, lists({ Today: [] }));
    await page.getByRole('button', { name: 'Import list' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Import list');
    // a name is needed, and not one that is taken
    await box(page).fill('- 82 thieving\n  - Buy a lockpick');
    await dialog(page).getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('#td-err')).toHaveText('Type a name first.');
    await page.locator('#tl-name').fill('today');
    await dialog(page).getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('#td-err')).toHaveText('You already have a list called “Today”.');
    await page.locator('#tl-name').fill('Skilling');
    await dialog(page).getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('#td')).toHaveCount(0);
    await expect(names(page)).toHaveText(['Today', 'Skilling']);
    expect(await outline(page, 1)).toEqual(['82 thieving', '  Buy a lockpick']);
  });

  test('"Paste a list…": a bulleted list becomes goals, and indented lines their sub tasks', async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Already here' }], Later: [] }));
    await pasteBox(page, 'Today');
    await expect(dialog(page).locator('.what').first()).toHaveText('Today');
    await expect(box(page)).toBeFocused();
    await expect(box(page)).toHaveAttribute('placeholder', /- Hatchet of bloom and blight\n {2}- Hatchet of ember and glade/);
    await expect(page.locator('#tp-count')).toHaveText('One goal on each line. Indent a line to put it under the one above.');
    // nothing typed
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#td-err')).toHaveText('Type or paste a list first.');
    // bullets of every kind, numbers, tick boxes, tabs and spaces
    await box(page).fill([
      '- Hatchet of bloom and blight',
      '  - Hatchet of ember and glade',
      '    - [x] Crystal hatchet',
      '    - [ ] Ember shard',
      '  - Blight shard',
      '',
      '* 82 thieving',
      '• vis wax',
      '1. [X] buy a rope',
      '2) Quest: Cook\'s Assistant',
      'no bullet at all',
      '\t+ under the one above',
      '   ',
      '-'
    ].join('\n'));
    // the box says what it reads, while you type
    await expect(page.locator('#tp-count')).toHaveText('6 goals and 5 sub tasks.');
    await expect(page.locator('#td-err')).toBeHidden();
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#td')).toHaveCount(0);
    await expect(page.locator('#toast')).toContainText('Added 6 goals to Today.');
    expect(await outline(page, 0)).toEqual([
      'Already here',
      'Hatchet of bloom and blight',
      '  Hatchet of ember and glade',
      '    x Crystal hatchet',
      '    Ember shard',
      '  Blight shard',
      '82 thieving',
      'Vis wax',
      'x Buy a rope',
      "Cook's Assistant",
      'No bullet at all',
      '  Under the one above'
    ]);
    expect((await stored(page, 'todo')).lists[0].items[5]).toMatchObject({ kind: 'quest' });
    await expect(goal(page, 'Hatchet of bloom and blight').locator(':scope > .row .sc')).toHaveText('0 / 2');
    // Undo takes them all out
    await page.locator('#toast').getByRole('button', { name: 'Undo' }).click();
    expect(await outline(page, 0)).toEqual(['Already here']);
    // one goal; all under a goal ticked: the goal is done
    await pasteBox(page, 'Later');
    await box(page).fill('Pack\n  [x] Rope\n  [x] Spade');
    await expect(page.locator('#tp-count')).toHaveText('1 goal and 2 sub tasks.');
    await box(page).press('Control+Enter');
    await expect(page.locator('#toast')).toContainText('Added 1 goal to Later.');
    expect(await outline(page, 1)).toEqual(['x Pack', '  x Rope', '  x Spade']);
    expect(page.errors).toEqual([]);
  });

  test('a list that is too deep or too long: what does not fit is left out, and the box says so', async ({ page }) => {
    await openList(page, lists({ Today: [] }));
    await pasteBox(page, 'Today');
    const many = Array.from({ length: 22 }, (_, i) => '  - Step ' + (i + 1));
    await box(page).fill(['- A', '  - B', '    - C', '      - D', '        - E', '          - F', '- Big'].concat(many).join('\n'));
    // five deep is one too many (F goes next to E); 22 under one goal is two too many
    await expect(page.locator('#tp-count')).toHaveText('2 goals and 25 sub tasks. 2 lines do not fit and are left out.');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    const o = await outline(page, 0);
    expect(o.slice(0, 6)).toEqual(['A', '  B', '    C', '      D', '        E', '        F']);
    expect(o.length).toBe(6 + 1 + 20);
    // no room for more goals (the app first saves what the wiki said about the new ones)
    await expect.poll(async () => JSON.stringify(await stored(page, 'todo')).split('"wiki"').length - 1).toBe(27);
    await page.evaluate(() => {
      const t = JSON.parse(localStorage.getItem('qg1.todo'));
      for (let i = 0; i < 297; i++) t.lists[0].items.push({ id: 'x' + i, kind: 'other', title: 'Goal ' + i, at: 1, wiki: '' });
      localStorage.setItem('qg1.todo', JSON.stringify(t));
    });
    await page.reload();
    await pasteBox(page, 'Today');
    await box(page).fill('- One\n- Two\n- Three');
    await expect(page.locator('#tp-count')).toHaveText('1 goal. 2 lines do not fit and are left out.');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Added 1 goal to Today.');
    await listMenu(page, 'Today');
    await page.locator('#tmenu .mi', { hasText: 'Paste a list…' }).click();
    await expect(page.locator('#toast')).toHaveText('You have 300 goals. Remove some first.');
    await expect(page.locator('#td')).toHaveCount(0);
    expect(page.errors).toEqual([]);
  });

  test('pasting more than one line in the box at the end of a list opens "Paste a list" with it', async ({ page }) => {
    await openList(page, lists({ Today: [] }));
    const paste = (text) => addBox(page, 'Today').evaluate((el, t) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', t);
      el.focus();
      return el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, text);
    // one line: nothing special (the browser puts it in the box)
    expect(await paste('just one')).toBe(true);
    await expect(page.locator('#td')).toHaveCount(0);
    expect(await paste('- Rope\n- Spade\n')).toBe(false);
    await expect(dialog(page).locator('.dh')).toHaveText('Paste a list');
    await expect(box(page)).toHaveValue('- Rope\n- Spade\n');
    await expect(page.locator('#tp-count')).toHaveText('2 goals.');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['Rope', 'Spade']);
    expect(page.errors).toEqual([]);
  });

  test('"Copy as text…": the list as a bulleted list, which pastes back the same', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__clip = t; return Promise.resolve(); } } }); });
    await openList(page, lists({
      Today: [{ kind: 'other', title: 'Hatchet of bloom and blight', note: 'not in the text', subs: [{ id: 'a', title: 'Hatchet of ember and glade', subs: [{ id: 'a1', title: 'Crystal hatchet', done: 1 }, { id: 'a2', title: 'Ember shard' }] }, { id: 'b', kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!' }] },
        { kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'other', title: 'Vis wax', done: Date.now() }, { kind: 'quest', title: "Cook's Assistant" }],
      Copy: [], Empty: []
    }));
    await listMenu(page, 'Today');
    await page.locator('#tmenu .mi', { hasText: 'Copy as text…' }).click();
    await expect(dialog(page).locator('.dh')).toHaveText('Today as text');
    const text = ['- Hatchet of bloom and blight', '  - Hatchet of ember and glade', '    - [x] Crystal hatchet', '    - Ember shard', '  - Task 448: Yoink! (Ardougne Easy)',
      '- 82 Thieving', '- [x] Vis wax', "- Quest: Cook's Assistant"].join('\n');
    await expect(box(page)).toHaveValue(text);
    await expect(box(page)).toHaveAttribute('readonly', '');
    await dialog(page).getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Copied.');
    expect(await page.evaluate(() => window.__clip)).toBe(text);
    await dialog(page).getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('#td')).toHaveCount(0);
    // pasted into another list: the same goals (the task is still the task)
    await pasteBox(page, 'Copy');
    await box(page).fill(text);
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    expect(await outline(page, 1)).toEqual(await outline(page, 0));
    expect((await stored(page, 'todo')).lists[1].items[0].subs[1]).toMatchObject({ kind: 'task', task: '448' });
    // an empty list has nothing to copy
    await listMenu(page, 'Empty');
    await expect(page.locator('#tmenu .mi', { hasText: 'Copy as text…' })).toBeDisabled();
    expect(page.errors).toEqual([]);
  });

  test('Copy without the clipboard (Alt1 or an old browser): the text is selected and copied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined });
      document.execCommand = (c) => { const e = document.activeElement; window.__cmd = c + ':' + e.value.slice(e.selectionStart, e.selectionEnd); return true; };
    });
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Rope' }] }));
    await listMenu(page, 'Today');
    await page.locator('#tmenu .mi', { hasText: 'Copy as text…' }).click();
    await dialog(page).getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Copied.');
    expect(await page.evaluate(() => window.__cmd)).toBe('copy:- Rope');
  });
});

test.describe('a goal becomes a list', () => {
  test('"Make it a list" when its sub tasks would be more than 300 goals: it says so, and nothing changes', async ({ page }) => {
    const many = Array.from({ length: 298 }, (_, i) => ({ kind: 'other', title: 'Goal ' + i }));
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Hatchet', subs: [{ id: 'a', title: 'One' }, { id: 'b', title: 'Two' }, { id: 'c', title: 'Three' }, { id: 'd', title: 'Four' }] }], Big: many }));
    await goalMenu(page, 'Hatchet');
    await page.locator('#tmenu .mi', { hasText: 'Make it a list' }).click();
    await expect(page.locator('#toast')).toHaveText('You have 300 goals. Remove some first.');
    expect((await stored(page, 'todo')).lists.map((l) => l.name)).toEqual(['Today', 'Big']);
  });

  test('Undo is only for the last change: another change takes the offer away', async ({ page }) => {
    await openList(page, lists({ Today: [{ kind: 'other', title: 'Vis wax' }, { kind: 'other', title: 'Buy a cape' }] }));
    await goalMenu(page, 'Vis wax');
    await page.locator('#tmenu .mi', { hasText: 'Remove' }).click();
    await expect(page.locator('#toast')).toContainText('Undo');
    await goal(page, 'Buy a cape').locator('.cb').click();
    await expect(page.locator('#toast')).toBeHidden();
    expect(await saved(page)).toEqual({ Today: ['other:Buy a cape'] });
    expect((await stored(page, 'todo')).lists[0].items[0].done).toBeGreaterThan(0);
  });

  test('a pasted list that ticks a task in its area: Undo unticks it there again', async ({ page }) => {
    await openList(page, lists({ Today: [] }));
    await listMenu(page, 'Today');
    await page.locator('#tmenu .mi', { hasText: 'Paste a list' }).click();
    await page.locator('#tp-text').fill('- Task 448: Yoink! (Ardougne Easy)\n  - [x] Buy a lockpick');
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Added 1 goal to Today.');
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 448: 1 });
    await page.locator('#toast .tl', { hasText: 'Undo' }).click();
    expect(await saved(page)).toEqual({ Today: [] });
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({});
  });

  test('in an area: a task that My list unticks is unticked on the screen too, and the next tick does not bring it back', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, { todo: lists({ Diary: [{ kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!' }] }), 'aprog.Ardougne': { tasks: { 448: 1 } } });
    await openApp(page, expect);
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await toggle(page, 'Done steps and tasks');
    await expect(page.locator('li[data-task="448"] > .row .cb')).toBeChecked();
    // another task goes under it on the list: the goal is open again, so its task is unticked
    await taskMenu(page, '447');
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    await page.locator('#ta-parent').selectOption({ label: 'Yoink!' });
    await dialog(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('li[data-task="448"] > .row .cb')).not.toBeChecked();
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({});
    await page.locator('li[data-task="449"] > .row .cb').click();
    expect((await stored(page, 'aprog.Ardougne')).tasks).toEqual({ 449: 1 });
    expect(page.errors).toEqual([]);
  });

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
    // it asks once more, a second later, and then leaves it
    await expect.poll(() => wiki.lookups.length).toBe(2);
    await page.evaluate(() => new Promise((done) => { setTimeout(done, 50); }));
    expect(wiki.lookups.length).toBe(2);
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
    await expect(page.locator('#player')).toContainText('Zezima');
    await closeSettings(page);
    await expect(goal(page, '82 Thieving')).not.toHaveClass(/\bdone\b/);
    await goal(page, '90 Herblore').locator('.cb').click();
    await expect(goal(page, '90 Herblore')).toHaveClass(/\bdone\b/);
    wiki.setPlayer('Zezima', {}, { 18: 82 });
    await openSettings(page);
    await page.getByRole('button', { name: 'Update player' }).click();
    await closeSettings(page);
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
    await page.locator('.bn[data-home="quests"]').click();
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
    await page.locator('.bn[data-home="quests"]').click();
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
    await page.locator('.bn[data-home="areas"]').click();
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
    await page.getByRole('button', { name: 'All achievements' }).click();
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
    // untick it there (done tasks show with "Done steps and tasks"): open again on the list
    await toggle(page, 'Done steps and tasks');
    await page.locator('li[data-task="448"] > .row .cb').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    await tab(page).click();
    await expect(goal(page, 'Yoink!')).not.toHaveClass(/\bdone\b/);
    // a tier is done when all its tasks are
    await page.evaluate(() => localStorage.setItem('qg1.aprog.Ardougne', JSON.stringify({ tasks: { 503: 1, 504: 1, 505: 1, 506: 1, 507: 1 } })));
    await page.reload();
    await expect(goal(page, 'Ardougne Elite')).toHaveClass(/\bdone\b/);
    expect(page.errors).toEqual([]);
  });

  test('Add to list asks for a parent: none, or a goal or a sub task of the list', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, { todo: lists({
      Diary: [{ kind: 'other', title: 'Ardougne', subs: [{ id: 'a', title: 'Easy ones' }] }, { kind: 'other', title: 'Later' }],
      Other: [{ kind: 'other', title: 'Elsewhere' }]
    }) });
    await openApp(page, expect);
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await taskMenu(page, '448');
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    // the places of the list that is picked
    await expect(dialog(page).locator('label[for="ta-parent"]')).toHaveText('Parent');
    await expect(page.locator('#ta-parent option')).toHaveText(['None', 'Ardougne', '— Easy ones', 'Later']);
    await expect(page.locator('#ta-parent option:checked')).toHaveText('None');
    await page.locator('#ta-list').selectOption({ label: 'Other' });
    await expect(page.locator('#ta-parent option')).toHaveText(['None', 'Elsewhere']);
    // a new list has no places yet
    await page.locator('#ta-list').selectOption({ label: 'New list…' });
    await expect(page.locator('#ta-parent')).toBeHidden();
    await page.locator('#ta-list').selectOption({ label: 'Diary' });
    await expect(page.locator('#ta-parent')).toBeVisible();
    // under a sub task
    await page.locator('#ta-parent').selectOption({ label: '— Easy ones' });
    await addTo(page);
    await expect(page.locator('#toast')).toContainText('Added to Diary.');
    await taskMenu(page, '448');
    await expect(menuItems(page)).toHaveText(['Remove from Diary']);
    await page.keyboard.press('Escape');
    // no parent: a goal at the end of the list
    await taskMenu(page, '447');
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    await expect(page.locator('#ta-parent option:checked')).toHaveText('None');
    await addTo(page);
    // a level, under a goal
    await page.getByRole('button', { name: 'All achievements' }).click();
    await tab(page).click();
    await expect(goals(page, 'Diary').locator(':scope > .row .t')).toHaveText(['Ardougne', 'Later', 'The Essence of Magic']);
    const easy = page.locator('li.gsub').filter({ has: page.locator(':scope > .row .t', { hasText: 'Easy ones' }) });
    const yoink = easy.locator('li.gsub');
    await expect(yoink.locator('.t')).toHaveText(['Yoink!']);
    await expect(easy.locator(':scope > .row .sc')).toHaveText('0 / 1');
    // its menu has the way to its area
    await yoink.locator('[data-smenu]').click();
    await expect(menuItems(page)).toHaveText(['Edit', 'Add sub task', 'Open Ardougne Easy', 'Move up', 'Move down', 'Move out a level', 'Delete']);
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
    await toggle(page, 'Done steps and tasks');
    await page.locator('li[data-task="448"] > .row .cb').click();
    await page.getByRole('button', { name: 'All achievements' }).click();
    await tab(page).click();
    await expect(yoink).not.toHaveClass(/\bdone\b/);
    // the file says which task it is, and it comes back as one
    const j = JSON.parse(await exportText(page));
    expect(j.mylist.Diary.Ardougne).toEqual({ done: false, subs: { 'Easy ones': { done: false, subs: { 'Task 448: Yoink! (Ardougne Easy)': false } } } });
    await importText(page, JSON.stringify(j));
    expect((await stored(page, 'todo')).lists[0].items[0].subs[0].subs[0]).toMatchObject({ kind: 'task', area: 'Ardougne', task: '448', title: 'Yoink!' });
    // "Remove from …" in the task's menu takes it out from under its goal
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await taskMenu(page, '448');
    await page.locator('#tmenu .mi', { hasText: 'Remove from Diary' }).click();
    await page.getByRole('button', { name: 'All achievements' }).click();
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

test.describe('limits, storage and the look', () => {
  test('at most 300 goals and 30 lists', async ({ page }) => {
    const many = Array.from({ length: 300 }, (_, i) => ({ kind: 'other', title: 'Goal ' + (i + 1) }));
    await openList(page, lists({ Big: many }));
    await add(page, 'One more');
    await expect(page.locator('#toast')).toHaveText('You have 300 goals. Remove some first.');
    const t = lists(Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['List ' + (i + 1), []])));
    await openList(page, t);
    await page.getByRole('button', { name: 'Create list' }).click();
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
    await openSettings(page);
    await deleteEverything(page);
    expect(await stored(page, 'todo')).toBeNull();
    await page.locator('.bn[data-home="todo"]').click();
    await expect(page.locator('.empty')).toHaveText('Nothing on your list yet.');
  });
});

test.describe('the window', () => {
  test('the title band: the app on the start screen; the way back, the name and its menu in a quest or an area; no cog', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    await expect(page.locator('.hdr h1.qt')).toHaveText('Quick Guide');
    await expect(page.locator('.hdr img.emb')).toBeVisible();
    await expect(page.locator('.hdr [data-act="change"]')).toHaveCount(0);
    await expect(page.locator('#pg')).toHaveCount(0);
    await openQuest(page, expect, 'While Guthix Sleeps');
    const band = page.locator('.hdr');
    // in a quest the band holds it all, from left to right: back, name, menu; the app's name is gone, and there is no cog
    await expect(band.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    await expect(band.locator('img.emb')).toHaveCount(0);
    await expect(page.getByText('Quick Guide', { exact: true })).toHaveCount(0);
    await expect(band.locator('[data-act="change"]')).toHaveAttribute('aria-label', 'All quests');
    const x = async (sel) => (await band.locator(sel).boundingBox()).x;
    expect(await x('[data-act="change"]')).toBeLessThan(await x('h1.qt'));
    expect(await x('h1.qt')).toBeLessThan(await x('#menu-btn'));
    await expect(band.locator('[aria-label="Settings"]')).toHaveCount(0);
    // the thin progress line is right under the band, and the tabs right under it
    const hb = await band.boundingBox(), lb = await page.locator('#pg').boundingBox(), tb = await page.locator('.tabs').boundingBox();
    expect(lb.height).toBeLessThanOrEqual(5);
    expect(Math.abs(lb.y - (hb.y + hb.height))).toBeLessThanOrEqual(2);
    expect(tb.y).toBeGreaterThanOrEqual(lb.y + lb.height);
    expect(tb.y - (lb.y + lb.height)).toBeLessThanOrEqual(6);
    // one row of tabs
    await expect(page.locator('.tabs')).toHaveCount(1);
    await page.getByRole('button', { name: 'All quests' }).click();
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(band.locator('h1.qt')).toHaveText('Ardougne');
    await expect(band.locator('[data-act="change"]')).toHaveAttribute('aria-label', 'All achievements');
    await expect(band.locator('#menu-btn')).toBeVisible();
    await expect(band.locator('[aria-label="Settings"]')).toHaveCount(0);
    await expect(page.locator('.tabs')).toHaveCount(1);
  });

  test('Settings: the last button of the bar; it stays open after a reload; the button of where you were takes you back there, and so does Escape', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openApp(page, expect);
    const settings = page.locator('.bn[data-home="settings"]'), lit = page.locator('.bn[aria-current="page"]');
    // bottom right
    const bar = await page.locator('.bnav').boundingBox(), sb = await settings.boundingBox();
    expect(Math.abs(bar.x + bar.width - (sb.x + sb.width))).toBeLessThanOrEqual(1);
    // from a quest, on its Steps tab, scrolled down
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('.tab[data-tab="steps"]').click();
    await page.locator('#main').evaluate((m) => { m.scrollTop = 300; m.dispatchEvent(new Event('scroll')); });
    // (checked with the wiki today, so the weekly check does not change the line under Update from the wiki on the reload)
    await page.evaluate(() => localStorage.setItem('qg1.upd', JSON.stringify({ at: Date.now(), found: {}, failed: 0 })));
    await settings.click();
    await expect(page.locator('h1.qt')).toHaveText('Settings');
    await expect(lit).toHaveText('Settings');
    await expect(page.locator('#settings')).toBeVisible();
    await expect(page.locator('.hdr [data-act="change"]')).toHaveCount(0);   // no back button: the bar is the way back
    expect(await stored(page, 'last')).toBe('While Guthix Sleeps/Quick guide');
    // a reload keeps Settings open, scrolled where it was, and the quest under it
    const top = await page.locator('#main').evaluate((m) => { m.scrollTop = m.scrollHeight; m.dispatchEvent(new Event('scroll')); return m.scrollTop; });
    expect(top).toBeGreaterThan(0);
    await expect.poll(async () => ((await stored(page, 'view')) || {}).scroll).toMatchObject({ settings: top });
    await page.reload();
    await expect(page.locator('h1.qt')).toHaveText('Settings');
    await expect(lit).toHaveText('Settings');
    expect(await page.locator('#main').evaluate((m) => m.scrollTop)).toBe(top);
    // Quests: back in the quest, on the same tab, at the same place
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('h1.qt')).toHaveText('While Guthix Sleeps');
    await expect(page.locator('.tab[data-tab="steps"]')).toHaveAttribute('aria-selected', 'true');
    expect(await page.locator('#main').evaluate((m) => m.scrollTop)).toBe(300);
    // Quests again: the list
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('#quest-link')).toBeVisible();
    // from an area, Escape takes you back too
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await settings.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('h1.qt')).toHaveText('Ardougne');
    await expect(lit).toHaveText('Achievements');
    // another button goes to its list, and a reload stays there
    await settings.click();
    await page.locator('.bn[data-home="todo"]').click();
    await expect(lit).toHaveText(/^My list/);
    await expect(page.locator('#settings')).toHaveCount(0);
    await page.reload();
    await expect(lit).toHaveText(/^My list/);
    await expect(page.locator('#settings')).toHaveCount(0);
    // from a list: back to it, with the search text you typed
    await page.locator('.bn[data-home="quests"]').click();
    await page.locator('#quest-link').fill('imp');
    await settings.click();
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('#quest-link')).toHaveValue('imp');
    expect(page.errors).toEqual([]);
  });

  test('the bar at the bottom: Quests, Achievements, My list and Settings on every screen; the number on My list changes right there', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await seed(page, { todo: lists({ Today: [] }) });
    await openApp(page, expect);
    const bar = page.locator('.bnav'), lit = page.locator('.bn[aria-current="page"]');
    // on the start screen: at the very bottom of the window, Quests lit
    await expect(bar.locator('.bn .bnl')).toHaveText(['Quests', 'Achievements', 'My list', 'Settings']);
    await expect(lit).toHaveText('Quests');
    const win = await page.locator('#app').boundingBox();
    let bb = await bar.boundingBox();
    expect(Math.abs(win.y + win.height - (bb.y + bb.height))).toBeLessThanOrEqual(1);
    // in a quest: under the next step button, still Quests lit
    await openQuest(page, expect, 'While Guthix Sleeps');
    await page.locator('.tab[data-tab="steps"]').click();
    await expect(lit).toHaveText('Quests');
    bb = await bar.boundingBox();
    const nb = await page.locator('#next-btn').boundingBox();
    expect(bb.y).toBeGreaterThanOrEqual(nb.y + nb.height);
    await expect(tab(page).locator('.tc')).toHaveCount(0);
    await page.locator('#menu-btn').click();
    await page.locator('#menu .mi', { hasText: 'Add to list…' }).click();
    await addTo(page);
    await expect(tab(page).locator('.tc')).toHaveText('1');
    // the message shows above the bar, not over it
    const tt = await page.locator('#toast').boundingBox();
    expect(tt.y + tt.height).toBeLessThanOrEqual((await bar.boundingBox()).y);
    // a button takes you to its list, also the one that is lit
    await page.locator('.bn[data-home="quests"]').click();
    await expect(page.locator('#quest-link')).toBeVisible();
    await expect(page.locator('.hdr h1.qt')).toHaveText('Quick Guide');
    expect(await stored(page, 'last')).toBeNull();
    // in an area: Achievements lit; a task added to a list counts at once
    await page.locator('.bn[data-home="areas"]').click();
    await page.locator('.q[data-area="Ardougne"][data-atier="easy"]').click();
    await expect(lit).toHaveText('Achievements');
    await expect(page.locator('.tab[data-tier]')).toHaveCount(4);
    await taskMenu(page, '448');
    await page.locator('#tmenu .mi', { hasText: 'Add to list…' }).click();
    await addTo(page);
    await expect(tab(page).locator('.tc')).toHaveText('2');
    await tab(page).click();
    await expect(lit).toHaveText('My list2');
    await expect(goals(page, 'Today').locator('.t')).toHaveText(['While Guthix Sleeps', 'Yoink!']);
    // opened from My list, a reload stays in the area
    await goalMenu(page, 'Yoink!');
    await page.locator('#tmenu .mi', { hasText: 'Open Ardougne Easy' }).click();
    await page.reload();
    await expect(page.locator('.hdr h1.qt')).toHaveText('Ardougne');
    await expect(lit).toHaveText('Achievements');
    // no sideways scrolling in a narrow window
    await page.setViewportSize({ width: 280, height: 600 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(page.errors).toEqual([]);
  });
});

test.describe('export and import', () => {
  test('every list and goal goes out, and comes back the same', async ({ page, wiki }) => {
    withAllAreas(wiki);
    await openList(page, lists({
      Today: [{ kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!' }, { kind: 'other', title: 'Vis wax', done: Date.now() }, { kind: 'other', title: 'Unlock Soul Split', note: 'Needs a quest' }],
      'Skilling goals': [{ kind: 'skill', skill: 'thieving', level: 82 }, { kind: 'quest', title: 'While Guthix Sleeps' }, { kind: 'tier', area: 'Ardougne', tier: 'hard', title: 'Ardougne Hard' }],
      Gathering: [{ kind: 'other', title: '500 Magic logs', subs: [{ id: 'a', title: 'Cut 250', done: 1 }, { id: 'b', title: 'Cut 250 more', subs: [{ id: 'b1', title: 'Sharpen', done: 1 }, { id: 'b2', title: 'Sharpen' }] }] }],
      Empty: []
    }));
    const j = JSON.parse(await exportText(page));
    expect(Object.keys(j)).toContain('mylist');
    expect(j.mylist).toEqual({
      Today: { 'Task 448: Yoink! (Ardougne Easy)': false, 'Vis wax': true, 'Unlock Soul Split': { done: false, note: 'Needs a quest' } },
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
    expect(await saved(page)).toEqual({ Week: ['skill:96 herblore', 'other:1,000 yew logs', 'other:Unlock: overloads', 'other:Do the dishes', 'other:Penguins (every week)', 'other:Bank (monthly)'] });
    const t = await stored(page, 'todo');
    expect(t.lists[0].items.map((x) => [x.done ? 1 : 0, x.repeat || ''])).toEqual([[0, ''], [0, ''], [1, ''], [0, ''], [0, ''], [0, '']]);
  });

  test('a file with a mistake in its lists says so, and your lists stay', async ({ page }) => {
    await openList(page, lists({ Mine: [{ kind: 'other', title: 'Keep me' }] }));
    await importText(page, JSON.stringify({ app: 'Quick Guide', format: 2, mylist: { Today: ['Vis wax'] } }));
    await expect(page.locator('#bk-err')).toHaveText('There is a mistake in the lists. mylist \u2192 "Today" must look like { "a goal": true }.');
    expect(await saved(page)).toEqual({ Mine: ['other:Keep me'] });
    // a list or a goal with a name every object has is a name like any other
    await page.locator('#bk-text').fill(JSON.stringify({ app: 'Quick Guide', format: 2, mylist: { Constructor: { '82 constructor': false } } }));
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await page.locator('.bn[data-home="todo"]').click();
    await page.reload();
    await expect(names(page)).toHaveText(['Constructor']);
    await expect(goals(page, 'Constructor').locator('.t')).toHaveText(['82 constructor']);
    expect(page.errors).toEqual([]);
  });
});
