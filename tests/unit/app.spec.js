// The app (js/app), without a browser: small helpers, what you type or paste in My list, and how Update from the wiki
// decides what to read again. Screens and clicks need a browser: tests/*.spec.js.
const { test, expect, load } = require('./load');

const DAY = 24 * 3600 * 1000;
const { A } = load();

test.describe('helpers', () => {
  test('esc makes text safe in HTML', () => {
    expect(A.esc('<a href="x">\'&')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    expect([A.esc(null), A.esc(undefined), A.esc(0)]).toEqual(['', '', '0']);
  });

  test('plural', () => {
    expect([A.plural(0, 'task', 'tasks'), A.plural(1, 'task', 'tasks'), A.plural(2, 'task', 'tasks')]).toEqual(['0 tasks', '1 task', '2 tasks']);
  });

  test('"New" lasts 30 days from when the app found it', () => {
    const now = Date.now();
    expect([A.isNew(now), A.isNew(now - 29 * DAY), A.isNew(now - 31 * DAY), A.isNew(0), A.isNew(undefined)]).toEqual([true, true, false, false, false]);
  });

  test('what a failed load says', () => {
    const { A: a, run } = load();
    expect(a.loadError({ code: 'missingtitle' })).toBe('The wiki has no page for this quest yet.');
    expect(a.loadError({ code: 'timeout' })).toBe('The wiki took too long to answer. Try again.');
    expect(a.loadError({ code: 'http', message: 'The wiki answered with error 503.' })).toBe('The wiki answered with error 503. Try again in a moment.');
    // no internet: fetch fails with the page's own TypeError
    expect(a.loadError(run('new TypeError("Failed to fetch")'))).toBe('Could not reach the wiki. Check your internet, then try again.');
    expect(a.loadError(null)).toBe('Something went wrong. Try again.');
  });
});

test.describe('My list: what you type', () => {
  const cases = [
    ['82 thieving', { kind: 'skill', skill: 'thieving', level: 82 }],
    ['attack 99', { kind: 'skill', skill: 'attack', level: 99 }],
    ['thiev 50', { kind: 'skill', skill: 'thieving', level: 50 }],
    ['1 attack', { kind: 'other', title: '1 attack' }],
    ['121 attack', { kind: 'other', title: '121 attack' }],
    ["quest: Cook's Assistant", { kind: 'quest', title: "Cook's Assistant" }],
    ['Tier: Ardougne Hard', { kind: 'tier', area: 'Ardougne', tier: 'hard', title: 'Ardougne Hard' }],
    ['Task 448: Yoink! (Ardougne Easy)', { kind: 'task', task: '448', title: 'Yoink!', area: 'Ardougne', tier: 'easy', tname: 'Easy' }],
    ['Task 448: Yoink! (Nowhere Easy)', { kind: 'other', title: 'Task 448: Yoink! (Nowhere Easy)' }],
    ['Achievement 2111: Advanced Sweeping (Master quest cape)', { kind: 'cheevo', cape: 'mqc', cheevo: '2111', title: 'Advanced Sweeping' }],
    ['buy   a rune pickaxe ', { kind: 'other', title: 'Buy a rune pickaxe' }]
  ];
  for (const [typed, goal] of cases) {
    test('"' + typed + '"', () => { expect(A.T.parseGoal(typed)).toEqual(goal); });
  }
  test('nothing is no goal', () => {
    expect([A.T.parseGoal(''), A.T.parseGoal('   '), A.T.parseGoal(null)]).toEqual([null, null, null]);
  });
});

test.describe('My list: names that every object has ("constructor", "__proto__")', () => {
  test('they are no skill: "82 constructor" is a goal as you typed it', () => {
    expect(A.T.skillKey('constructor')).toBe('');
    expect(A.T.parseGoal('82 constructor')).toEqual({ kind: 'other', title: '82 constructor' });
    expect(A.T.parseGoal('constructor 5')).toEqual({ kind: 'other', title: 'Constructor 5' });
    expect(A.T.cleanGoal({ kind: 'constructor', title: 'x' })).toBeNull();
  });
  test('a list may have such a name: it is kept, and it is in the file', () => {
    const lists = [{ id: 'l1', name: 'Constructor', items: [{ kind: 'other', title: 'Vis wax' }] }, { id: 'l2', name: '__proto__', items: [{ kind: 'other', title: 'Buy a cape' }] }];
    expect(A.T.cleanTodo({ lists }).lists.map((l) => l.name)).toEqual(['Constructor', '__proto__']);
    const app = load({ storage: { todo: { v: 1, lists } } });
    const file = JSON.parse(JSON.stringify(app.A.exportTodo()));
    expect(Object.keys(file)).toEqual(['Constructor', '__proto__']);
    expect(file.__proto__).toEqual({ 'Buy a cape': false });
    // and it comes back
    expect(app.A.todoFileError(file)).toBe('');
    expect(app.A.importTodo(file)).toBe(2);
    expect(app.storage.saved('todo').lists.map((l) => l.name)).toEqual(['Constructor', '__proto__']);
  });
});

test.describe('My list: a task that is ticked in its area', () => {
  const task = () => ({ id: 'g1', at: 1, kind: 'task', area: 'Ardougne', tier: 'easy', tname: 'Easy', task: '448', title: 'Yoink!', subs: [{ id: 's1', title: 'Buy a lockpick' }] });
  const start = (goal) => load({ storage: { todo: { v: 1, lists: [{ id: 'l1', name: 'Today', items: [goal] }] }, 'aprog.Ardougne': { tasks: { 448: 1 } } } });
  test('showing the lists, or an export, leaves it ticked there, with a sub task still open', () => {
    const app = start(task());
    app.A.T.settleAll();
    expect(app.storage.saved('aprog.Ardougne').tasks).toEqual({ 448: 1 });
    expect(app.A.exportTodo()).toEqual({ Today: { 'Task 448: Yoink! (Ardougne Easy)': { done: true, subs: { 'Buy a lockpick': false } } } });
    expect(app.storage.saved('aprog.Ardougne').tasks).toEqual({ 448: 1 });
  });
  test('so does ticking one of its sub tasks; opening one unticks it', () => {
    const app = start(Object.assign(task(), { subs: [{ id: 's1', title: 'Buy a lockpick', done: 1 }, { id: 's2', title: 'Go to Ardougne' }] }));
    const g = app.A.T.todo().lists[0].items[0];
    app.A.T.settleGoal(g, true);
    expect(app.storage.saved('aprog.Ardougne').tasks).toEqual({ 448: 1 });
    delete g.subs[0].done;
    app.A.T.settleGoal(g, false);
    expect(app.storage.saved('aprog.Ardougne').tasks).toEqual({});
  });
  test('the same deeper down: a task under a goal, with its own sub task open', () => {
    const app = start({ id: 'g1', at: 1, kind: 'other', title: 'Diary', subs: [Object.assign(task(), { id: 's0' })] });
    app.A.T.settleAll();
    expect(app.storage.saved('aprog.Ardougne').tasks).toEqual({ 448: 1 });
  });
});

test.describe('Import: the lists of a file are checked before anything changes', () => {
  const bad = [
    [['Vis wax'], '"mylist" must look like { "a list": { "a goal": true } }.'],
    [{ Today: ['Vis wax'] }, 'mylist \u2192 "Today" must look like { "a goal": true }.'],
    [{ Today: { 'Vis wax': ['x'] } }, 'mylist \u2192 "Today" \u2192 "Vis wax" must be true or false, or { "done": true, "subs": { \u2026 } }.'],
    [{ Today: { 'Vis wax': { subs: ['x'] } } }, 'mylist \u2192 "Today" \u2192 "Vis wax": its "subs" must look like { "a sub task": true }.'],
    [{ Today: { 'Vis wax': { subs: { Buy: { subs: { Sell: [] } } } } } }, 'mylist \u2192 "Today" \u2192 "Vis wax" \u2192 "Buy" \u2192 "Sell" must be true or false, or { "done": true, "subs": { \u2026 } }.']
  ];
  for (const [lists, says] of bad) {
    test(JSON.stringify(lists), () => { expect(A.todoFileError(lists)).toBe(says); });
  }
  test('what the app writes itself is fine', () => {
    expect(A.todoFileError({ Today: { 'Vis wax': true, '500 Magic logs': '320 / 500', Old: null, Hatchet: { done: false, note: 'n', subs: { Crystal: true, Deep: { done: false, subs: { Deeper: false } } } } }, Empty: {} })).toBe('');
  });
});

test.describe('My list: limits, and names with a number', () => {
  test('at most 3,000 sub tasks in all lists together: what was saved past that is left out', () => {
    const subs = (n) => Array.from({ length: n }, (_, i) => ({ title: 'Sub ' + i }));
    const lists = [{ id: 'l1', name: 'Big', items: Array.from({ length: 200 }, (_, i) => ({ kind: 'other', title: 'Goal ' + i, subs: subs(20) })) }];
    const t = A.T.cleanTodo({ lists });
    expect(t.lists[0].items).toHaveLength(200);
    expect(t.lists[0].items.reduce((n, g) => n + (g.subs || []).length, 0)).toBe(3000);
    expect(t.lists[0].items[150].subs).toBeUndefined();
  });
  test('one more sub task: not under a goal that has 20, and not past 3,000 in all', () => {
    const full = { subs: Array.from({ length: 20 }, () => ({})) };
    expect(A.T.subsFull(full)).toBe('A goal has at most 20 sub tasks.');
    const subs = () => Array.from({ length: 20 }, (_, i) => ({ id: 's' + i, title: 'Sub ' + i }));
    const items = Array.from({ length: 150 }, (_, i) => ({ id: 'g' + i, at: 1, kind: 'other', title: 'Goal ' + i, subs: subs() }));
    const app = load({ storage: { todo: { v: 1, lists: [{ id: 'l1', name: 'Big', items: items.concat([{ id: 'x', at: 1, kind: 'other', title: 'Free' }]) }] } } });
    expect(app.A.T.subCount()).toBe(3000);
    expect(app.A.T.subsFull(app.A.T.todo().lists[0].items[150])).toBe('You have 3,000 sub tasks. Remove some first.');
    expect(A.T.subsFull({})).toBe('');
  });
  test('a pasted list: sub tasks that do not fit in all are left out, and counted', () => {
    const r = A.T.parseOutline('- A\n  - one\n  - two\n  - three\n- B', 10, 2);
    expect([r.goals.length, r.subs, r.left]).toEqual([2, 2, 1]);
    expect(A.T.parseOutline('- A\n  - one\n  - two\n  - three', 10).subs).toBe(3);
  });
  test('a goal you called "Floor #2" keeps its name in a file; only the number an export added goes', () => {
    const app = load({ storage: { todo: { v: 1, lists: [] } } });
    app.A.importTodo({ Today: { 'Floor #2': false, 'Vis wax': true, 'Vis wax #2': false, Hatchet: { done: false, subs: { 'Step #3': false, Rope: true, 'Rope #2': false } } } });
    const l = app.storage.saved('todo').lists[0];
    expect(l.items.map((g) => g.title)).toEqual(['Floor #2', 'Vis wax', 'Vis wax', 'Hatchet']);
    expect(l.items[3].subs.map((u) => u.title)).toEqual(['Step #3', 'Rope', 'Rope']);
  });
});

test.describe('storage that is full', () => {
  test('a change that does not fit is kept until the app closes, and sset says it did not fit', () => {
    const app = load({ storage: { todo: { v: 1, lists: [] } } });
    const set = app.storage.setItem;
    let full = true;
    app.storage.setItem = (k, v) => {
      if (full && k === 'qg1.note') throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
      set(k, v);
    };
    expect(app.A.sset('note', { n: 1 })).toBe(false);
    expect(app.A.sget('note')).toEqual({ n: 1 });
    // an older value in the storage does not win from the one that did not fit
    full = false;
    expect(app.A.sset('note', { n: 2 })).toBe(true);
    full = true;
    expect(app.A.sset('note', { n: 3 })).toBe(false);
    expect(app.storage.saved('note')).toEqual({ n: 2 });
    expect(app.A.sget('note')).toEqual({ n: 3 });
    // room again: it is saved, and read from the storage again
    full = false;
    expect(app.A.sset('note', { n: 4 })).toBe(true);
    expect(app.storage.saved('note')).toEqual({ n: 4 });
    expect(app.A.sget('note')).toEqual({ n: 4 });
  });
});

test.describe('My list: a pasted list', () => {
  test('bullets, numbers, tick boxes, and a line further in is under the one above', () => {
    const r = A.T.parseOutline('1. 82 thieving\n- [x] Quest: Cook\'s Assistant\n  * Buy an egg\n    + [ ] Find a cow\n• thieving 90\n\n', 10);
    expect(r).toEqual({ subs: 2, left: 0, goals: [
      { kind: 'skill', skill: 'thieving', level: 82 },
      { kind: 'quest', title: "Cook's Assistant", done: 1, subs: [{ kind: 'other', title: 'Buy an egg', subs: [{ kind: 'other', title: 'Find a cow' }] }] },
      { kind: 'skill', skill: 'thieving', level: 90 }
    ] });
  });

  test('a tab is four spaces', () => {
    expect(A.T.parseOutline('- A\n  - B\n\t- C', 10).goals)
      .toEqual([{ kind: 'other', title: 'A', subs: [{ kind: 'other', title: 'B', subs: [{ kind: 'other', title: 'C' }] }] }]);
  });

  test('what does not fit is counted, with what is under it', () => {
    expect(A.T.parseOutline('a\nb\n  b1\nc\n  c1', 2)).toMatchObject({ subs: 1, left: 2, goals: [{ title: 'A' }, { title: 'B' }] });
  });

  test('at most 20 sub tasks under a goal', () => {
    const r = A.T.parseOutline('goal\n' + Array.from({ length: 22 }, (_, i) => '  sub ' + i).join('\n'), 10);
    expect(r.goals[0].subs).toHaveLength(20);
    expect([r.subs, r.left]).toEqual([20, 2]);
  });
});

test.describe('Update from the wiki: what to read again', () => {
  const quest = (old) => ({ kind: 'quest', title: 'Q', old });
  const area = { kind: 'area', title: 'Ardougne achievements', old: { fetchedAt: '2026-11-10T00:00:00Z' } };
  const cape = { kind: 'cape', title: 'Master quest cape', old: { fetchedAt: '2026-11-10T00:00:00Z', cheevos: [{ page: 'Swept Away', rev: 5 }] } };
  const touched = (t) => ({ rev: 1, edited: '', touched: t });

  test('a quest guide: when it was edited', () => {
    expect(A.pageChanged(quest({ revid: 9 }), { Q: { rev: 9 } })).toBe(false);
    expect(A.pageChanged(quest({ revid: 9 }), { Q: { rev: 10 } })).toBe(true);
    // saved before the app kept revisions: by date
    expect(A.pageChanged(quest({ fetchedAt: '2026-11-10T00:00:00Z' }), { Q: { rev: 10, edited: '2026-11-11T00:00:00Z' } })).toBe(true);
    expect(A.pageChanged(quest({ fetchedAt: '2026-11-10T00:00:00Z' }), { Q: { rev: 10, edited: '2026-11-09T00:00:00Z' } })).toBe(false);
  });

  test('an area: when anything on it changed (a new task comes from a template, not an edit)', () => {
    expect(A.pageChanged(area, { 'Ardougne achievements': touched('2026-11-11T00:00:00Z') })).toBe(true);
    expect(A.pageChanged(area, { 'Ardougne achievements': touched('2026-11-09T00:00:00Z') })).toBe(false);
  });

  test("a cape: also when one of its achievements' pages was edited", () => {
    const page = touched('2026-11-09T00:00:00Z');
    expect(A.pageChanged(cape, { 'Master quest cape': page, 'Swept Away': { rev: 5 } })).toBe(false);
    expect(A.pageChanged(cape, { 'Master quest cape': page, 'Swept Away': { rev: 6 } })).toBe(true);
    expect(A.pageChanged(cape, { 'Master quest cape': page })).toBe(true);
    expect(A.pageChanged(cape, { 'Master quest cape': page, 'Swept Away': { missing: true } })).toBe(false);
  });

  test('a cape whose levels page could not be read last time is read again', () => {
    const cape = { kind: 'cape', title: 'C', old: { fetchedAt: '2026-11-20T10:00:00Z', partial: true, cheevos: [] } };
    expect(A.pageChanged(cape, { C: { rev: 1, touched: '2026-11-01T10:00:00Z' } })).toBe(true);
    delete cape.old.partial;
    expect(A.pageChanged(cape, { C: { rev: 1, touched: '2026-11-01T10:00:00Z' } })).toBe(false);
  });

  test('the wiki did not say: read it; the page is gone: keep what we have', () => {
    expect(A.pageChanged(area, {})).toBe(true);
    expect(A.pageChanged(area, { 'Ardougne achievements': { missing: true } })).toBe(false);
  });

  test('what it found, in words', () => {
    expect(A.foundText({})).toBe('');
    expect(A.foundText({ tasks: 1 })).toBe('1 new task');
    expect(A.foundText({ cheevos: 2, tasks: 1 })).toBe('2 new achievements and 1 new task');
    expect(A.foundText({ cheevos: 2, tasks: 1, quests: 1, guides: 3 })).toBe('2 new achievements, 1 new task, 1 new quest and 3 quest guides changed');
  });

  test('the line under the button, from what was saved', () => {
    const at = Date.UTC(2026, 10, 21, 12);
    expect(load().A.updateText()).toBe('Reads again what changed: the quest lists, the guides you opened, the areas and the capes. It checks by itself once a week.');
    expect(load({ storage: { upd: { at, found: { tasks: 1 } } } }).A.updateText()).toMatch(/^Checked .*2026: 1 new task\. It checks by itself once a week\.$/);
    expect(load({ storage: { upd: { at, found: {}, failed: 2 } } }).A.updateText()).toMatch(/: nothing new\. Could not read 2 pages\. It checks by itself once a week\.$/);
  });
});
