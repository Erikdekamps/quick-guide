// The code's own rules, checked without a browser: what index.html loads, what the files of the app share, which
// keys they save, and the docs that list them. A file or a saved key that is not added everywhere fails here, and so
// does a name one file takes from another that nobody shares (the app would only find out when that code runs).
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const { test, expect } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html'), readme = read('README.md'), core = read('js/app/core.js');
// The scripts of the app, in the order index.html loads them.
const scripts = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map((m) => m[1]);
const appFiles = scripts.filter((f) => f.startsWith('js/app/'));
const onDisk = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => dir + '/' + f);

test.describe('the files', () => {
  test('index.html loads every file in js/: the wiki reader first, then core.js, and main.js last', () => {
    expect([...scripts].sort()).toEqual([...onDisk('js/wiki'), ...onDisk('js/app')].sort());
    expect(scripts.slice(0, 2)).toEqual(['js/wiki/parser.js', 'js/wiki/quests.js']);
    expect(appFiles[0]).toBe('js/app/core.js');
    expect(appFiles[appFiles.length - 1]).toBe('js/app/main.js');
  });

  test('each file of the app says it loaded, and main.js starts only when all of them did', () => {
    const names = appFiles.slice(0, -1).map((f) => {
      const m = /\bA\.loaded\.(\w+) = true;/.exec(read(f));
      expect(m, f + ' ends with A.loaded.<name> = true').not.toBeNull();
      return m[1];
    });
    const wait = /\[([^\]]*)\]\.some\(function \(k\) \{ return !A\.loaded\[k\]; \}\)/.exec(read('js/app/main.js'));
    expect(wait, 'main.js checks A.loaded').not.toBeNull();
    expect(wait[1].split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual(names);
  });

  test('the README and the top of core.js name every file', () => {
    for (const f of scripts) expect(readme, 'README.md, Files').toContain('| `' + f + '` |');
    for (const f of appFiles) expect(core, 'the top of core.js').toMatch(new RegExp('^ \\* {3}' + path.basename(f).replace('.', '\\.') + ' ', 'm'));
  });
});

// What each file of the app puts on A (window.QuickGuideApp: A.share({...}) and A.x = ...) and what it takes from it.
// A name taken at the top of a file (when it loads) must come from a file loaded before it.
function sharing() {
  const shared = {}, uses = [];
  const share = (name, file) => { (shared[name] = shared[name] || []).push(file); };
  for (const file of appFiles) {
    const ast = espree.parse(read(file), { ecmaVersion: 2017, sourceType: 'script', loc: true });
    // depth: 1 is the top of the file (inside its (function (A) { ... }) wrapper), more is inside a function.
    (function walk(n, parent, depth) {
      if (n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && n.object.name === 'A') {
        const name = n.property.name;
        if (parent.type === 'AssignmentExpression' && parent.left === n) share(name, file);
        else if (name === 'share' && parent.type === 'CallExpression' && parent.callee === n) {
          for (const p of parent.arguments[0].properties) share(p.key.name, file);
        } else uses.push({ file, name, line: n.loc.start.line, atLoad: depth <= 1 });
      }
      // core.js makes A: var A = window.QuickGuideApp = { loaded, share }
      if (n.type === 'VariableDeclarator' && n.id.name === 'A' && n.init) {
        const o = n.init.type === 'AssignmentExpression' ? n.init.right : n.init;
        if (o.type === 'ObjectExpression') for (const p of o.properties) share(p.key.name, file);
      }
      const inner = depth + (/Function/.test(n.type) ? 1 : 0);
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'range') continue;
        for (const c of [].concat(n[k])) if (c && typeof c.type === 'string') walk(c, n, inner);
      }
    })(ast, null, 0);
  }
  return { shared, uses };
}

test.describe('what the files share', () => {
  const { shared, uses } = sharing();
  const where = (u) => u.file + ':' + u.line + ' A.' + u.name;

  test('every name a file takes from another one is shared by a file', () => {
    expect(uses.length).toBeGreaterThan(100);
    expect(uses.filter((u) => !shared[u.name]).map(where)).toEqual([]);
  });

  test('a name taken when a file loads comes from a file loaded before it', () => {
    const late = uses.filter((u) => u.atLoad && shared[u.name] && appFiles.indexOf(shared[u.name][0]) > appFiles.indexOf(u.file));
    expect(late.map((u) => where(u) + ' (shared by ' + shared[u.name][0] + ')')).toEqual([]);
  });

  test('no two files share the same name (the second would replace the first)', () => {
    expect(Object.keys(shared).filter((k) => shared[k].length > 1).map((k) => k + ': ' + shared[k].join(', '))).toEqual([]);
  });
});

test.describe('what is saved', () => {
  // The first part of each key the app reads or writes: sget('quest.' + page) is "quest".
  const used = new Set();
  for (const f of appFiles) for (const m of read(f).matchAll(/\bs(?:get|set|del)\('([a-z]+)/g)) used.add(m[1]);
  // Read once, to move it into "meta", then deleted.
  const OLD = ['recent'];
  const first = (k) => k.split(/[.<]/)[0];

  test('every key is in the README\'s "What is saved" table, and every key there is still used', () => {
    const part = readme.slice(readme.indexOf('## What is saved'), readme.indexOf('\n## ', readme.indexOf('## What is saved') + 1));
    const listed = new Set();
    for (const row of part.split('\n').filter((l) => /^\| `/.test(l))) for (const m of row.split(' | ')[0].matchAll(/`([^`]+)`/g)) listed.add(first(m[1]));
    expect([...used].filter((k) => !OLD.includes(k) && !listed.has(k)).sort()).toEqual([]);
    expect([...listed].filter((k) => !used.has(k)).sort()).toEqual([]);
  });

  test('every key is at the top of core.js', () => {
    const part = core.slice(core.indexOf('What is kept in localStorage'), core.indexOf('When the storage is full'));
    const listed = new Set();
    for (const m of part.matchAll(/^ \* {3}(\S+(?:, \S+)*)\s{2,}/gm)) for (const k of m[1].split(', ')) listed.add(first(k));
    expect([...used].filter((k) => !OLD.includes(k) && !listed.has(k)).sort()).toEqual([]);
    expect([...listed].filter((k) => !used.has(k)).sort()).toEqual([]);
  });

  test('only core.js and the backup touch localStorage itself; every key starts with qg1.', () => {
    for (const f of [...appFiles, ...onDisk('js/wiki')]) {
      if (f === 'js/app/core.js' || f === 'js/app/backup.js') continue;
      expect(read(f), f).not.toMatch(/localStorage/);
    }
    expect(core).toContain("var PREFIX = 'qg1.';");
  });
});
