// The coverage check (tests/support/coverage.js): which blocks of code no test runs, compared with the saved list in
// tests/coverage.json. New code that no test runs must fail, also when other untested code went away.
const { test, expect } = require('@playwright/test');
const C = require('../support/coverage');

const at = (line, text) => ({ line, text });
const yes = () => true, no = () => false;

test.describe('the blocks no test runs', () => {
  // ran: one character per character of the source, "x" where a test ran it.
  const blocks = (src, ran) => C.blocks(src, [...ran].map((c) => (c === 'x' ? 1 : 0)));

  test('a piece of code that never ran is a block, with its line and its first 80 characters', () => {
    const src = 'a();\nif (b) {\n  c();\n}\n';
    expect(blocks(src, 'xxxxxxxxxxxxxxx.....xxx')).toEqual([at(3, 'c();')]);
    expect(blocks(src, '.'.repeat(src.length))).toEqual([at(1, 'a(); if (b) { c(); }')]);
    const long = 'call(' + '1, '.repeat(40) + '2);';
    expect(blocks(long, '.'.repeat(long.length))[0].text).toHaveLength(80);
  });

  test('only brackets, commas and comments: not a block', () => {
    expect(blocks('a(); }\n// never\n/* at all */ ];,', 'xxxx...................')).toEqual([]);
    expect(blocks('a();', 'xxxx')).toEqual([]);
  });
});

test.describe('against tests/coverage.json', () => {
  test('nothing new: fine', () => {
    expect(C.compare({ 'js/a.js': ['x()', 'y()'] }, { 'js/a.js': [at(3, 'x()'), at(9, 'y()')] }, yes)).toEqual({ problems: [], gone: 0 });
    expect(C.compare({}, {}, yes)).toEqual({ problems: [], gone: 0 });
  });

  test('one new block fails, with its line', () => {
    const r = C.compare({ 'js/a.js': ['x()'] }, { 'js/a.js': [at(3, 'x()'), at(9, 'fresh()')] }, yes);
    expect(r.problems).toEqual(['✗ js/a.js: 1 new block that no test runs. Test it, or explain in the pull request why not:', '    line 9: fresh()']);
  });

  test('one new block fails even when another one went away (the count is the same, or lower)', () => {
    const same = C.compare({ 'js/a.js': ['x()', 'y()'] }, { 'js/a.js': [at(3, 'x()'), at(9, 'fresh()')] }, yes);
    expect(same.problems).toEqual(['✗ js/a.js: 1 new block that no test runs. Test it, or explain in the pull request why not:', '    line 9: fresh()']);
    expect(same.gone).toBe(1);
    const lower = C.compare({ 'js/a.js': ['x()', 'y()', 'z()'] }, { 'js/a.js': [at(9, 'fresh()')] }, yes);
    expect(lower.problems).toHaveLength(2);
    expect(lower.gone).toBe(3);
  });

  test('a block that went away in one file does not pay for a new one in another', () => {
    const r = C.compare({ 'js/a.js': ['x()'], 'js/b.js': ['y()'] }, { 'js/a.js': [], 'js/b.js': [at(1, 'y()'), at(2, 'more()'), at(5, 'and()')] }, yes);
    expect(r.problems).toEqual(['✗ js/b.js: 2 new blocks that no test runs. Test them, or explain in the pull request why not:', '    line 2: more()', '    line 5: and()']);
  });

  test('the same text twice: each saved one stands for one block', () => {
    expect(C.compare({ 'js/a.js': ['return;', 'return;'] }, { 'js/a.js': [at(1, 'return;'), at(2, 'return;')] }, yes).problems).toEqual([]);
    const r = C.compare({ 'js/a.js': ['return;'] }, { 'js/a.js': [at(1, 'return;'), at(2, 'return;')] }, yes);
    expect(r.problems[1]).toBe('    line 2: return;');
    expect(C.compareFile(['return;', 'return;'], [at(1, 'return;')])).toEqual({ added: [], gone: 1 });
  });

  test('a block that moved to another line is the same block', () => {
    expect(C.compare({ 'js/a.js': ['x()'] }, { 'js/a.js': [at(400, 'x()')] }, yes)).toEqual({ problems: [], gone: 0 });
  });

  test('blocks that went away: fine, and it says how many', () => {
    expect(C.compare({ 'js/a.js': ['x()', 'y()'] }, { 'js/a.js': [at(3, 'x()')] }, yes)).toEqual({ problems: [], gone: 1 });
  });

  test('a new file: every block in it that no test runs is new', () => {
    expect(C.compare({}, { 'js/new.js': [at(1, 'x()')] }, yes).problems[0]).toContain('✗ js/new.js: 1 new block');
    expect(C.compare({}, { 'js/new.js': [] }, yes).problems).toEqual([]);
  });

  test('a file in the list that no test ran: fails when it is still there, fine when it was deleted', () => {
    expect(C.compare({ 'js/a.js': ['x()'] }, {}, yes).problems).toEqual(['✗ js/a.js: no test ran it']);
    expect(C.compare({ 'js/a.js': ['x()'] }, {}, no)).toEqual({ problems: [], gone: 1 });
  });
});
