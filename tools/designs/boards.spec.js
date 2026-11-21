// Builds the design boards and their pictures: npm run designs
//   npm run designs                  every board below
//   npm run designs -- -g "MyList"   only the boards with that in their name
// Each board below is a screen of the app: what is saved before it starts, and the clicks that lead to it. The app
// runs like in the tests (tests/support/app.js: the fake wiki, no internet), so a board always comes out the same.
// The board is the app's own markup with the current style.css (tools/designs/board.js). Its picture is made from
// the board file, at 2x, with the real fonts and the wiki's pictures: that step needs the internet.
const fs = require('fs');
const path = require('path');
const { test, expect, seed, openQuest, openTab, withAllAreas, withCapes } = require('../../tests/support/app');
const B = require('./board');

const css = fs.readFileSync(path.join(B.ROOT, 'style.css'), 'utf8');
const NOW = '2026-11-21T12:00:00Z';

// The pictures show the scrollbar of the list, like the Alt1 browser does (a browser without a window hides it).
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

// Writes the board of what the page shows now, then its picture.
async function save(page, browser, name, title) {
  const shot = await page.evaluate(B.snapshot);
  const text = B.board({ title, html: shot.html, theme: shot.theme === 'blue' ? 'blue' : '', css });
  const changed = B.save(name, text);
  // A board cannot say how far its list is scrolled: the picture gets that from the page.
  const scroll = await page.evaluate(() => { const m = document.getElementById('main'); return m ? m.scrollTop : 0; });
  await picture(browser, name, text, scroll);
  console.log((changed ? 'new   ' : 'same  ') + name);
}
// The picture of a board, from the board file itself. The fonts and the wiki's pictures come from the internet; the
// app's own files (its icon) from this folder, so a picture shows the icon as it is here.
async function picture(browser, name, text, scroll) {
  const p = B.parts(text);
  const context = await browser.newContext({
    viewport: { width: p.width, height: p.height }, deviceScaleFactor: 2, reducedMotion: 'reduce',
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined
  });
  const view = await context.newPage(), missed = [];
  await view.route(B.SITE + '**', (route) => route.fulfill({ path: path.join(B.ROOT, new URL(route.request().url()).pathname.replace(/^\/quick-guide\//, '')) }));
  view.on('requestfailed', (r) => missed.push(r.url()));
  await view.setContent(B.page(text), { waitUntil: 'networkidle' });
  await view.evaluate((top) => { const m = document.getElementById('main'); if (m) m.scrollTop = top; return document.fonts.ready; }, scroll || 0);
  if (missed.length) console.log('      ' + name + ': the picture misses ' + missed.length + ' files from the internet (the first: ' + missed[0] + ')');
  await view.screenshot({ path: B.picture(name) });
  await context.close();
}

// ---------- My list ----------
// The character: a few levels, Cook's Assistant done, and some quests not done yet.
function player(wiki, levels) {
  const quests = { "Cook's Assistant": 'COMPLETED' };
  for (const q of ["Legends' Quest", 'Tower of Life', 'Back to my Roots', 'Watchtower', 'Underground Pass', 'Enlightened Journey', "Mourning's End Part I", 'While Guthix Sleeps']) quests[q] = 'NOT_STARTED';
  wiki.setPlayerData('Sir Example', quests, Object.assign({ magic: 80, thieving: 52, agility: 61, farming: 48, hunter: 55, herblore: 66, defence: 70, summoning: 30 }, levels));
}
const sub = (id, title, more) => Object.assign({ id, title, wiki: '' }, more);
const YOINK = { id: 'g1', kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!' };
const VIS_WAX = { id: 'g2', kind: 'other', title: 'Vis wax', wiki: 'Vis wax', done: 1 };
const HATCHET = { id: 'g3', kind: 'other', title: 'Hatchet of bloom and blight', wiki: 'Hatchet of bloom and blight', subs: [
  sub('s1', 'Hatchet of ember and glade', { wiki: 'Hatchet of ember and glade', subs: [sub('s1a', 'Crystal hatchet', { done: 1, wiki: 'Crystal hatchet' }), sub('s1b', 'Ember shard')] }),
  sub('s2', 'Blight shard')] };
const COOK = { id: 'g4', kind: 'quest', title: "Cook's Assistant" };
// A goal that is done with its sub tasks: it folds by itself.
const PENGUINS = { id: 'g0', kind: 'other', title: 'Penguin points', wiki: '', done: 1, subs: [sub('p1', 'Spy on 10 penguins', { done: 1 }), sub('p2', 'Find the polar bear', { done: 1 })] };
// Four lists: flat goals, one with sub tasks two deep, levels with a note, and a list that is folded.
function lists(today) {
  return { v: 1, lists: [
    { id: 'l1', name: 'Today', items: today || [YOINK, VIS_WAX, HATCHET, COOK] },
    { id: 'l2', name: 'Skilling goals', items: [
      { id: 'g5', kind: 'skill', skill: 'thieving', level: 82, note: 'For the Ardougne Hard tasks' },
      { id: 'g6', kind: 'skill', skill: 'herblore', level: 96 }] },
    { id: 'l3', name: 'Gathering', items: [
      { id: 'g7', kind: 'other', title: '500 Magic logs', wiki: 'Magic logs' },
      { id: 'g8', kind: 'other', title: 'Penguin Hide and Seek', wiki: 'Penguin Hide and Seek' }] },
    { id: 'l4', name: 'Ardougne diary', items: [
      { id: 'g9', kind: 'tier', area: 'Ardougne', tier: 'hard', tname: 'Hard', title: 'Ardougne Hard' },
      { id: 'g10', kind: 'other', title: 'Buy a Quest point cape', wiki: 'Quest point cape' }] }
  ] };
}
// What is saved before the app starts: the lists, the character, and the last list folded.
// o: { todo, closed, settings, levels (the character's, where they are not the usual ones), more (other keys) }
function saved(wiki, o) {
  o = o || {};
  player(wiki, o.levels);
  const data = {
    settings: Object.assign({ home: 'todo' }, o.settings),
    // Looked up long ago: the app asks for the character again when it starts.
    player: { name: 'Sir Example', at: '2000-01-01T00:00:00Z', quests: {} },
    view: { closed: Object.assign({ 'todo:l4': true }, o.closed) }
  };
  if (o.todo !== null) data.todo = o.todo || lists();
  return Object.assign(data, o.more);
}
// Puts what is saved in place and starts the app. The clock stands still, so a new list or goal gets the same id every
// time, and a board only changes when the app does.
async function start(page, data) {
  await page.clock.setFixedTime(new Date(NOW));
  await seed(page, data);
  await page.goto('/');
}
// Opens My list. With the character there, Cook's Assistant ticks itself.
async function myList(page, wiki, o) {
  await start(page, saved(wiki, o));
  await expect(page.locator('.bn[data-home="todo"]')).toHaveAttribute('aria-current', 'page');
  if (o && o.todo === null) return;
  await expect(page.locator('.qmeta .how')).toContainText('Sir Example');
  await expect(page.locator('.goal.done').first()).toBeVisible();
}
const goal = (page, text) => page.locator('li.goal').filter({ has: page.locator('.row > .rb > .t', { hasText: text }) });
const listBar = (page, name) => page.locator('h2.gh.lh').filter({ has: page.locator('.ghb .n', { hasText: name }) });
const menu = (page) => page.locator('#tmenu');
const PASTED = '- Hatchet of bloom and blight\n  - Hatchet of ember and glade\n    - [x] Crystal hatchet\n    - Ember shard\n  - Blight shard\n- 82 Thieving\n- Vis wax';

// Ardougne, the Hard tier, with nine tasks ticked (and two of Easy), scrolled to the next task.
async function ardougneHard(page, wiki) {
  withAllAreas(wiki);
  const tasks = {};
  for (const id of ['449', '450', '486', '487', '488', '489', '490', '491', '492', '493', '494']) tasks[id] = 1;
  await start(page, saved(wiki, { settings: { home: 'areas' }, more: { 'aprog.Ardougne': { tasks, tier: 'hard' } } }));
  await page.locator('[data-area="Ardougne"]').first().click();
  await expect(page.locator('h1.qt')).toHaveText('Ardougne');
  await page.locator('.tab[data-tier="hard"]').click();
  await expect(page.locator('li[data-task="495"] .mk').first()).toBeVisible();
  await page.locator('[data-asec-btn="hard:needs"][aria-expanded="true"]').click();
  await page.locator('li[data-task="495"]').evaluate((li) => { const m = document.getElementById('main'); m.scrollTop += li.getBoundingClientRect().top - m.getBoundingClientRect().top - 72; });
}

const BOARDS = {
  MyList: ['My list', async ({ page, wiki }) => {
    await myList(page, wiki);
  }],
  MyListBlue: ['My list, Blue', async ({ page, wiki }) => {
    await myList(page, wiki, { settings: { theme: 'blue' } });
  }],
  MyListEmpty: ['My list: empty', async ({ page, wiki }) => {
    await myList(page, wiki, { todo: null });
    await expect(page.locator('.empty')).toBeVisible();
  }],
  // A sub task folded by hand, and a goal that is done with all its sub tasks, folded by itself.
  MyListFold: ['My list, folded', async ({ page, wiki }) => {
    await myList(page, wiki, { todo: lists([PENGUINS, YOINK, VIS_WAX, HATCHET, COOK]) });
    await page.locator('[data-fold="todosub:g3:s1"]').click();
  }],
  MyListType: ['My list: type the next goal', async ({ page, wiki }) => {
    await myList(page, wiki);
    await page.getByLabel('Add a goal to Skilling goals').fill('75 magic');
  }],
  MyListNew: ['My list: a new list', async ({ page, wiki }) => {
    await myList(page, wiki);
    await page.getByRole('button', { name: 'Create list' }).click();
    await page.locator('#tl-name').fill('This week');
  }],
  MyListImport: ['My list: import a list', async ({ page, wiki }) => {
    await myList(page, wiki);
    await page.getByRole('button', { name: 'Import list' }).click();
    await page.locator('#tl-name').fill('Hatchets');
    await page.locator('#tp-text').fill(PASTED);
    await expect(page.locator('#tp-count')).toHaveText('3 goals and 4 sub tasks.');
  }],
  MyListLists: ["My list: a list's menu", async ({ page, wiki }) => {
    await myList(page, wiki);
    await listBar(page, 'Skilling goals').locator('[data-lmenu]').click();
    await expect(menu(page)).toBeVisible();
  }],
  MyListPaste: ['My list: paste a list', async ({ page, wiki }) => {
    await myList(page, wiki);
    await listBar(page, 'Gathering').locator('[data-lmenu]').click();
    await menu(page).locator('[data-tm="lpaste"]').click();
    await page.locator('#tp-text').fill(PASTED);
    await expect(page.locator('#tp-count')).toHaveText('3 goals and 4 sub tasks.');
  }],
  MyListCopy: ['My list: copy as text', async ({ page, wiki }) => {
    await myList(page, wiki);
    await listBar(page, 'Today').locator('[data-lmenu]').click();
    await menu(page).locator('[data-tm="lcopy"]').click();
    await expect(page.locator('#tp-text')).toHaveValue(/Yoink!/);
  }],
  MyListAdd: ['My list: add a goal', async ({ page, wiki }) => {
    await myList(page, wiki);
    await listBar(page, 'Skilling goals').locator('[data-lmenu]').click();
    await menu(page).locator('[data-tm="ladd"]').click();
    await page.locator('#tg-text').fill('82 thieving');
    await page.locator('#tg-note').fill('For the Ardougne Hard tasks');
  }],
  MyListMenu: ["My list: a goal's menu", async ({ page, wiki }) => {
    await myList(page, wiki);
    await goal(page, 'Hatchet of bloom and blight').locator('[data-gmenu]').click();
    await expect(menu(page)).toBeVisible();
  }],
  MyListSub: ['My list: a sub task', async ({ page, wiki }) => {
    await myList(page, wiki);
    await goal(page, 'Hatchet of bloom and blight').locator('[data-gmenu]').click();
    await menu(page).locator('[data-tm="gsub"]').click();
    await page.getByLabel('Add a sub task to Hatchet of bloom and blight').fill('Bloom shard');
  }],
  MyListSubMenu: ["My list: a sub task's menu", async ({ page, wiki }) => {
    await myList(page, wiki);
    await page.locator('[data-smenu="s1a"]').click();
    await expect(menu(page)).toBeVisible();
  }],
  MyListToList: ['My list: a goal became a list', async ({ page, wiki }) => {
    await myList(page, wiki);
    await goal(page, 'Hatchet of bloom and blight').locator('[data-gmenu]').click();
    await menu(page).locator('[data-tm="glist"]').click();
    await expect(page.locator('#toast')).toContainText('Made the list');
  }],
  // Achievements on My list: a goal's menu opens its cape, or its page on the wiki.
  MyListCheevo: ["My list, an achievement's menu", async ({ page, wiki }) => {
    withCapes(wiki);
    const cheevo = (id, n, title) => ({ id, kind: 'cheevo', cape: 'mqc', cheevo: n, title });
    await myList(page, wiki, { levels: { magic: 99 }, todo: { v: 1, lists: [
      { id: 'l1', name: 'Today', items: [Object.assign({}, VIS_WAX, { done: 0 }), { id: 'g1', kind: 'skill', skill: 'magic', level: 93 }] },
      { id: 'l3', name: 'Master quest cape', items: [cheevo('g4', '2112', "Aereck's Old Bones"), cheevo('g5', '4949', 'A Sliver of Silver Helps the Sanguine Go Down'), cheevo('g6', '2111', 'Advanced Sweeping')] }
    ] } });
    await goal(page, 'Advanced Sweeping').locator('[data-gmenu]').click();
    await expect(menu(page)).toBeVisible();
  }],
  MyListFrom: ["My list: a task's menu", async ({ page, wiki }) => {
    await ardougneHard(page, wiki);
    await page.locator('li[data-task="495"] > .row [data-imenu]').click();
    await expect(menu(page)).toBeVisible();
  }],
  MyListAddTo: ['My list: add to a list', async ({ page, wiki }) => {
    await ardougneHard(page, wiki);
    await page.locator('li[data-task="495"] > .row [data-imenu]').click();
    await menu(page).locator('[data-addto]').click();
    await page.locator('#ta-list').selectOption({ label: 'Ardougne diary' });
    await page.locator('#ta-parent').selectOption({ label: 'Ardougne Hard' });
  }],
  // A quest's menu, next to its name in the title band: Jump to next step, then Add to list.
  MyListQuest: ["My list: from a quest's menu", async ({ page, wiki }) => {
    await start(page, saved(wiki, { settings: { home: 'quests' } }));
    await openQuest(page, expect, 'While Guthix Sleeps');
    await openTab(page, 'items');
    await page.locator('li[data-item] > .row > .cb').first().check();
    await openTab(page, 'steps');
    for (let n = 0; n < 5; n++) await page.locator('li[data-step]:not(.done) > .row > .cb').first().check();
    // The map stays shut: its tiles come from the wiki's map server, and the board is about the menu.
    await page.locator('details.acc[open] > summary', { hasText: 'Map:' }).first().click();
    await page.locator('#main').evaluate((m) => { m.scrollTop = 0; });
    await page.locator('#menu-btn').click();
    await expect(page.locator('#menu')).toBeVisible();
  }]
};

// ---------- the Components sheet ----------
// The sheet shows the parts of the app next to each other. Its parts are built one by one, as they get a recipe here:
// the markup of the part comes from the app, the words under it are written here. The other parts stay as they are.
const PARTS = {
  // One list with every kind of row: a flat goal, sub tasks two deep with the count that folds them, and a goal
  // that is done with all its sub tasks, folded by itself.
  'My list': {
    caption: 'A list: its name, done / all, and its menu. A goal is one flat row: a tick box, what it says, and its menu. The box at the end of the list ' +
      'takes the next goal: type, Enter, and type another. A goal can have sub tasks under it (Add sub task in its menu), and those their own, four deep: ' +
      'each is done when all under it are, and ticking it ticks them all. The count after it (0 / 2) folds its sub tasks: the small arrow points down ' +
      'when they show, and right when they are folded. A goal that is done with everything under it folds by itself (Penguin points). A sub task has its ' +
      'own menu: edit, add a sub task, move, delete. A goal you wrote yourself can become a list (its sub tasks are the goals), and it gets Open on the ' +
      'wiki when the wiki has a page for it. You can tick any goal; skill levels, quests and tiers also tick themselves. Ticking an area task here ticks ' +
      'it in its area too, and a quest in the quest list. A done goal stays where it is, struck through.',
    pick: ['h2.gh.lh', 'ul.todo'],
    show: async ({ page, wiki }) => {
      await myList(page, wiki, { todo: lists([YOINK, { id: 'g5', kind: 'skill', skill: 'mining', level: 99 }, HATCHET, PENGUINS,
        { id: 'g8', kind: 'other', title: 'Penguin Hide and Seek', wiki: 'Penguin Hide and Seek' }, VIS_WAX, COOK]) });
    }
  }
};

test('Components', async ({ page, wiki, browser }) => {
  let text = B.sheetCss(fs.readFileSync(B.file('Components'), 'utf8'), css);
  for (const [name, part] of Object.entries(PARTS)) {
    await part.show({ page, wiki });
    text = B.sheetPart(text, name, (await page.evaluate(B.snapshot, part.pick)).html, part.caption);
  }
  // How high the sheet is now: the canvas and the picture need to know.
  const context = await browser.newContext({ viewport: { width: B.parts(text).width, height: 800 } });
  const view = await context.newPage();
  await view.route(/^https?:/, (route) => route.abort());
  await view.setContent(B.page(text));
  const height = Math.ceil(await view.locator('.sheet').evaluate((el) => el.getBoundingClientRect().height));
  await context.close();
  text = B.sheetHeight(text, height);
  const layout = JSON.parse(fs.readFileSync(path.join(B.CANVAS, 'canvas.json'), 'utf8'));
  if (layout.boards['Components.dc.html'].h !== height) {
    layout.boards['Components.dc.html'].h = height;
    fs.writeFileSync(path.join(B.CANVAS, 'canvas.json'), JSON.stringify(layout, null, 2) + '\n');
  }
  const changed = B.save('Components', text);
  await picture(browser, 'Components', text);
  console.log((changed ? 'new   ' : 'same  ') + 'Components (' + height + ' px high)');
});

for (const [name, [title, show]] of Object.entries(BOARDS)) {
  test(name, async ({ page, wiki, browser }) => {
    await show({ page, wiki });
    await save(page, browser, name, title);
  });
}
