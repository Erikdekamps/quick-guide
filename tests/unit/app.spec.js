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
    expect(app.A.importTodo(file)).toEqual({ lists: 2, left: { lists: 0, twice: 0, goals: 0 } });
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

test.describe('My list: a finished goal (it folds by itself)', () => {
  const fin = (g) => A.T.finished(g, { done: !!g.done });
  test('done, with everything under it done, however deep', () => {
    expect(fin({ title: 'A', done: 1 })).toBe(true);
    expect(fin({ title: 'A' })).toBe(false);
    expect(fin({ title: 'A', done: 1, subs: [{ title: 'b', done: 1, subs: [{ title: 'c', done: 1 }] }] })).toBe(true);
    expect(fin({ title: 'A', done: 1, subs: [{ title: 'b', done: 1, subs: [{ title: 'c' }] }] })).toBe(false);
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

  test('with no guides or areas left to drop, the cape read longest ago goes; its ticks stay', () => {
    const app = load({ storage: {
      'cape.mqc': { key: 'mqc', fetchedAt: '2026-11-01T00:00:00Z', cheevos: [{ id: '1' }] },
      'cape.comp': { key: 'comp', fetchedAt: '2026-10-01T00:00:00Z', cheevos: [{ id: '2' }] },
      'cprog.comp': { ticks: { 2: 1 } }
    } });
    const set = app.storage.setItem;
    // full while the older cape is there
    app.storage.setItem = (k, v) => {
      if (k === 'qg1.note' && app.storage.getItem('qg1.cape.comp') != null) throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
      set(k, v);
    };
    expect(app.A.sset('note', { n: 1 })).toBe(true);
    expect(app.storage.saved('cape.comp')).toBeNull();
    expect(app.storage.saved('cape.mqc')).not.toBeNull();
    expect(app.storage.saved('cprog.comp')).toEqual({ ticks: { 2: 1 } });
    // a cape that is being saved is not dropped to make room for itself
    app.storage.setItem = (k, v) => {
      if (k === 'qg1.cape.mqc' && app.storage.getItem('qg1.note') != null) throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
      set(k, v);
    };
    expect(app.A.sset('cape.mqc', { key: 'mqc', fetchedAt: '2026-11-02T00:00:00Z', cheevos: [] })).toBe(false);
    expect(app.storage.saved('cape.mqc')).toMatchObject({ fetchedAt: '2026-11-01T00:00:00Z' });
  });

  test('only what could not be saved is kept in memory', () => {
    const app = load();
    const set = app.storage.setItem;
    app.storage.setItem = (k, v) => { if (k === 'qg1.big') throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' }); set(k, v); };
    app.A.sset('small', { n: 1 });
    app.A.sset('big', { n: 2 });
    expect(Object.keys(app.A.memory)).toEqual(['big']);
    expect(app.A.sget('small')).toEqual({ n: 1 });
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
  const area = { kind: 'area', title: 'Ardougne achievements', old: { hash: 'aaa' } };

  test('a guide, an area or a cape: when the data has another file for it (another mark)', () => {
    expect(A.pageChanged({ kind: 'quest', title: 'Q', old: { hash: 'abc' } }, { Q: { hash: 'abc', rev: 9 } })).toBe(false);
    expect(A.pageChanged({ kind: 'quest', title: 'Q', old: { hash: 'abc' } }, { Q: { hash: 'abd', rev: 9 } })).toBe(true);
    expect(A.pageChanged(area, { 'Ardougne achievements': { hash: 'aaa' } })).toBe(false);
    expect(A.pageChanged(area, { 'Ardougne achievements': { hash: 'bbb' } })).toBe(true);
  });

  test('an area or a cape saved before the app read its data from files (it has no mark) is read once more', () => {
    expect(A.pageChanged({ kind: 'cape', title: 'C', old: { revid: 9, fetchedAt: '2026-11-20T10:00:00Z', cheevos: [] } }, { C: { hash: 'abc', rev: 9 } })).toBe(true);
    expect(A.pageChanged({ kind: 'area', title: 'A achievements', old: { revid: 9 } }, { 'A achievements': { hash: 'abc', rev: 9 } })).toBe(true);
  });

  test('a guide without a mark: its revision on the wiki says it; without one too, it stays', () => {
    const info = { Q: { hash: 'abc', rev: 9 } };
    expect(A.pageChanged({ kind: 'quest', title: 'Q', old: { revid: 9 } }, info)).toBe(false);
    expect(A.pageChanged({ kind: 'quest', title: 'Q', old: { revid: 8 } }, info)).toBe(true);
    expect(A.pageChanged({ kind: 'quest', title: 'Q', old: {} }, info)).toBe(false);
  });

  test('the data did not say: read it; the page is gone: keep what we have', () => {
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

test.describe('a cape is read once', () => {
  // A cape with 40 achievements, and a list with all of them on it.
  const cheevos = Array.from({ length: 40 }, (_, i) => ({ id: String(100 + i), name: 'Cheevo ' + i, cat: 'Lore' }));
  const start = () => {
    const app = load({ storage: {
      'cape.mqc': { key: 'mqc', cheevos }, 'cprog.mqc': { ticks: { 100: 1, 101: 1 } },
      todo: { v: 1, lists: [{ id: 'l1', name: 'Cape', items: cheevos.map((x, i) => ({ id: 'g' + i, at: i, kind: 'cheevo', cape: 'mqc', cheevo: x.id, title: x.name })) }] }
    } });
    const get = app.storage.getItem;
    app.reads = 0;
    app.storage.getItem = (k) => { if (k === 'qg1.cape.mqc') app.reads++; return get(k); };
    return app;
  };

  test('for all the goals of My list at once', () => {
    const app = start();
    expect(app.A.T.openCount()).toBe(38);
    expect(app.reads).toBe(1);
  });

  test('again after a tick: what was read before a write is not used', () => {
    const app = start();
    expect(app.A.T.openCount()).toBe(38);
    app.A.tickCheevoIn('mqc', '102', true);
    expect(app.A.T.openCount()).toBe(37);
    expect(app.reads).toBe(3);
  });

  test('for the goals in an export of the lists', () => {
    const app = start();
    const out = app.A.exportTodo();
    expect(Object.values(out.Cape).filter(Boolean)).toHaveLength(2);
    expect(app.reads).toBe(1);
  });
});

test.describe('the shape your ticks are saved in', () => {
  test('ticks saved before they had a version are read as version 1, and saved with it', () => {
    const app = load({ storage: { 'aprog.Ardougne': { tasks: { 448: 1 } }, 'cprog.mqc': { ticks: { 2: 1 } }, todo: { lists: [] } } });
    expect(app.A.loadAprog('Ardougne')).toEqual({ v: 1, tasks: { 448: 1 } });
    expect(app.A.loadCprog('mqc')).toEqual({ v: 1, ticks: { 2: 1 } });
    expect(app.A.T.todo().v).toBe(app.A.T.TODO_VERSION);
    expect(app.A.T.TODO_VERSION).toBe(1);
  });
});

test.describe('My list: a link to the wiki', () => {
  test('a goal with no name the wiki could have ("#1", "x") is not asked about, and has no link', () => {
    const app = load({
      fetch: () => { throw new Error('asked the wiki'); },
      storage: { todo: { v: 1, lists: [{ id: 'l1', name: 'Today', items: [{ id: 'g1', at: 1, kind: 'other', title: '#1' }, { id: 'g2', at: 2, kind: 'other', title: 'x' }] }] } }
    });
    app.A.T.lookUpWiki();
    expect(app.storage.saved('todo').lists[0].items.map((g) => g.wiki)).toEqual(['', '']);
  });
});
