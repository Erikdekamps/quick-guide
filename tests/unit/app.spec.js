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
