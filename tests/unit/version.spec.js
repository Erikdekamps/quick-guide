// The version tool (tools/version.js): raising the version, and checking that package.json, index.html and
// CHANGELOG.md agree, checking a branch against main, and copying the app for the site. It runs on copies of the
// files in a temporary folder (with git, for the branches); the last tests check the real ones.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const V = require('../../tools/version');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG = '# Changelog\n\nIntro.\n\n## [Unreleased]\n\n### Fixed\n\n- A fix.\n\n## [1.4.2] - 2026-01-02\n\n### Added\n\n- Something.\n';

const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
const write = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };

// A small copy of the project: package.json, package-lock.json, index.html and CHANGELOG.md.
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-version-'));
  const all = Object.assign({
    'package.json': '{\n  "name": "x",\n  "version": "1.4.2",\n  "private": true\n}\n',
    'package-lock.json': JSON.stringify({ name: 'x', version: '1.4.2', lockfileVersion: 3, packages: { '': { name: 'x', version: '1.4.2' } } }, null, 2) + '\n',
    'index.html': '<link rel="stylesheet" href="style.css?v=1.4.2">\n<script src="https://example.com/x.js"></script>\n<script src="js/a.js?v=1.4.2"></script>\n<script src="js/b.js?v=1.4.2"></script>\n',
    'CHANGELOG.md': LOG
  }, files);
  for (const [f, s] of Object.entries(all)) if (s !== null) write(dir, f, s);
  return dir;
}

// Git in a copy of the project, with its own name and no signing, whatever this computer is set to.
function git(dir, ...args) {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function commit(dir, message) { git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', message); }
// A copy of the project in git: "main" at 1.4.2 with an app, and a branch "work" cut from it (checked out).
function repo() {
  const dir = project({ 'style.css': 'body { color: red; }\n', 'js/a.js': '// a\n', 'README.md': '# X\n' });
  git(dir, 'init', '-q', '-b', 'main');
  commit(dir, 'Start');
  git(dir, 'checkout', '-q', '-b', 'work');
  return dir;
}
// Main gets a new version (and a change to the app) while the branch is out. The branch stays checked out.
function mainMovesOn(dir, level) {
  git(dir, 'checkout', '-q', 'main');
  write(dir, 'js/a.js', '// a, on main\n');
  write(dir, 'CHANGELOG.md', read(dir, 'CHANGELOG.md').replace('- A fix.', '- A fix on main.'));
  V.bump(dir, level, '2026-11-21');
  commit(dir, 'Main moves on');
  git(dir, 'checkout', '-q', 'work');
}

test.describe('the next version', () => {
  test('patch, minor and major', () => {
    expect(V.next('1.42.0', 'patch')).toBe('1.42.1');
    expect(V.next('1.42.3', 'minor')).toBe('1.43.0');
    expect(V.next('1.42.3', 'major')).toBe('2.0.0');
    expect(V.next('0.9.9', 'patch')).toBe('0.9.10');
  });

  test('anything else is refused', () => {
    expect(() => V.next('1.42.0', 'big')).toThrow('Say patch, minor or major, not: big');
    expect(() => V.next('1.42', 'patch')).toThrow('Not a version like 1.2.3: 1.42');
    expect(() => V.next('v1.42.0', 'patch')).toThrow('Not a version like 1.2.3');
    expect(() => V.next('01.2.3', 'patch')).toThrow('Not a version like 1.2.3');
  });

  test('one step up is the next patch, minor or major, and nothing else', () => {
    for (const to of ['1.42.1', '1.43.0', '2.0.0']) expect(V.isStep('1.42.0', to), to).toBe(true);
    for (const to of ['1.42.0', '1.42.2', '1.44.0', '1.43.1', '3.0.0', '1.41.0']) expect(V.isStep('1.42.0', to), to).toBe(false);
    expect(V.compare('1.10.0', '1.9.9')).toBe(1);
    expect(V.compare('1.9.9', '1.10.0')).toBe(-1);
    expect(V.compare('2.0.0', '2.0.0')).toBe(0);
  });

  test('a change to what GitHub Pages serves is a change to the app; docs, tests and tools are not', () => {
    for (const f of ['index.html', 'style.css', 'js/app/core.js', 'js/wiki/parser.js', 'vendor/leaflet/leaflet.js', 'appconfig.json', 'icon.svg', 'icon.png']) expect(V.isApp(f), f).toBe(true);
    for (const f of ['README.md', 'CHANGELOG.md', 'CLAUDE.md', 'tests/unit/code.spec.js', 'tests/support/app.js', 'tools/version.js', 'index.html.old', 'icons/x.svg', 'designs/canvas/Main.dc.html', 'package.json', '.github/workflows/tests.yml']) expect(V.isApp(f), f).toBe(false);
  });
});

test.describe('npm run bump', () => {
  test('raises the version everywhere, and what is under Unreleased gets the number and the date', () => {
    const dir = project();
    expect(V.bump(dir, 'minor', '2026-11-21')).toEqual({ from: '1.4.2', to: '1.5.0', files: 3 });
    expect(read(dir, 'package.json')).toBe('{\n  "name": "x",\n  "version": "1.5.0",\n  "private": true\n}\n');
    const lock = JSON.parse(read(dir, 'package-lock.json'));
    expect([lock.version, lock.packages[''].version]).toEqual(['1.5.0', '1.5.0']);
    expect(read(dir, 'index.html')).toBe('<link rel="stylesheet" href="style.css?v=1.5.0">\n<script src="https://example.com/x.js"></script>\n<script src="js/a.js?v=1.5.0"></script>\n<script src="js/b.js?v=1.5.0"></script>\n');
    expect(read(dir, 'CHANGELOG.md')).toBe('# Changelog\n\nIntro.\n\n## [Unreleased]\n\n## [1.5.0] - 2026-11-21\n\n### Fixed\n\n- A fix.\n\n## [1.4.2] - 2026-01-02\n\n### Added\n\n- Something.\n');
    expect(V.problems(dir)).toEqual([]);
  });

  test('the first version in a changelog', () => {
    const dir = project({ 'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n- First.\n' });
    V.bump(dir, 'patch', '2026-11-21');
    expect(read(dir, 'CHANGELOG.md')).toBe('# Changelog\n\n## [Unreleased]\n\n## [1.4.3] - 2026-11-21\n\n- First.\n');
  });

  test('without notes under Unreleased, or with cache numbers that do not agree, it changes nothing', () => {
    for (const [files, error] of [
      [{ 'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n## [1.4.2] - 2026-01-02\n\n- Something.\n' }, 'Write what changed under "## [Unreleased]" in CHANGELOG.md first'],
      [{ 'CHANGELOG.md': '# Changelog\n\n## [1.4.2] - 2026-01-02\n\n- Something.\n' }, 'CHANGELOG.md does not start with "## [Unreleased]"'],
      [{ 'index.html': '<script src="js/a.js?v=1.4.2"></script><script src="js/b.js?v=1.4.1"></script>' }, 'index.html has cache numbers that are not 1.4.2'],
      [{ 'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n- New.\n\n## [1.4.3] - 2026-01-03\n\n- Odd.\n\n## [1.4.2] - 2026-01-02\n\n- Something.\n' }, 'CHANGELOG.md has 1.4.3 already']
    ]) {
      const dir = project(files), before = ['package.json', 'index.html', 'CHANGELOG.md'].map((f) => read(dir, f));
      expect(() => V.bump(dir, 'patch', '2026-11-21')).toThrow(error);
      expect(['package.json', 'index.html', 'CHANGELOG.md'].map((f) => read(dir, f))).toEqual(before);
    }
  });
});

test.describe('npm run check:version', () => {
  test('says what does not agree', () => {
    const dir = project({
      'index.html': '<link rel="stylesheet" href="style.css">\n<script src="js/a.js?v=1.4.2"></script>\n<script src="js/b.js?v=1.4.1"></script>\n',
      'package-lock.json': JSON.stringify({ version: '1.4.1', packages: { '': { version: '1.4.1' } } }),
      'CHANGELOG.md': '# Changelog\n\n## [1.4.1] - 2026-01-01\n\n- Old.\n\n## [1.4.2] - 2026-01-02\n\n- New.\n\n## [1.5.0]\n\nNothing.\n'
    });
    expect(V.problems(dir)).toEqual([
      'package-lock.json says 1.4.1 and 1.4.1, package.json says 1.4.2 (run npm install)',
      'index.html has ?v=1.4.1; package.json says 1.4.2 (use npm run bump)',
      'index.html loads style.css without a ?v= cache number',
      'CHANGELOG.md does not start with "## [Unreleased]"',
      'CHANGELOG.md: 1.5.0 has no date like 2026-11-21',
      'CHANGELOG.md: 1.4.1 is above 1.4.2 (the newest goes on top)',
      'CHANGELOG.md: 1.4.2 is above 1.5.0 (the newest goes on top)'
    ]);
  });

  test('a version that CHANGELOG.md does not have, or says nothing about', () => {
    expect(V.problems(project({ 'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n## [1.4.1] - 2026-01-01\n\n- Old.\n' })))
      .toEqual(['CHANGELOG.md has no "## [1.4.2]" (use npm run bump)']);
    expect(V.problems(project({ 'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n## [1.4.2] - 2026-01-02\n\nNothing yet.\n' })))
      .toEqual(['CHANGELOG.md says nothing under 1.4.2']);
    expect(V.problems(project({ 'package.json': '{ "name": "x" }' }))).toEqual(['package.json has no version like 1.2.3 (Not a version like 1.2.3: undefined)']);
  });

  test('notes prints what CHANGELOG.md says about one version', () => {
    expect(V.notes(LOG, '1.4.2')).toBe('### Added\n\n- Something.');
    expect(V.notes(LOG, 'Unreleased')).toBe('### Fixed\n\n- A fix.');
    expect(V.notes(LOG, '9.9.9')).toBeNull();
  });

  test('the app changed and the version did not: it says so, and how to raise it', () => {
    const dir = repo();
    write(dir, 'style.css', 'body { color: blue; }\n');
    // not committed yet: it counts already
    expect(V.stepProblems(dir, 'main')).toEqual(['The app changed (style.css) but the version is 1.4.2, like main. ' +
      'Run: npm run bump -- patch (a fix), minor (something new) or major (saved data changes)']);
    write(dir, 'js/new.js', '// new\n');
    commit(dir, 'Change the app');
    expect(V.stepProblems(dir, 'main')[0]).toContain('The app changed (js/new.js, style.css) but the version is 1.4.2');
    // more than five files: the first five, then "…"
    for (const n of [1, 2, 3, 4, 5]) write(dir, 'vendor/x/' + n + '.js', '// ' + n + '\n');
    commit(dir, 'More');
    expect(V.stepProblems(dir, 'main')[0]).toContain('(js/new.js, style.css, vendor/x/1.js, vendor/x/2.js, vendor/x/3.js, …)');
  });

  test('the app changed and the version went one step up: fine. Two steps is not', () => {
    const dir = repo();
    write(dir, 'style.css', 'body { color: blue; }\n');
    V.bump(dir, 'patch', '2026-11-21');
    commit(dir, 'A fix');
    expect(V.stepProblems(dir, 'main')).toEqual([]);
    write(dir, 'CHANGELOG.md', read(dir, 'CHANGELOG.md').replace('## [Unreleased]\n', '## [Unreleased]\n\n- More.\n'));
    V.bump(dir, 'patch', '2026-11-21');
    expect(V.stepProblems(dir, 'main')).toEqual(['The version goes from 1.4.2 to 1.4.4; one step up is 1.4.3, 1.5.0, 2.0.0']);
  });

  test('only the docs, tests or tools changed: no new version is needed', () => {
    const dir = repo();
    write(dir, 'README.md', '# X\n\nMore.\n');
    write(dir, 'tests/a.spec.js', '// a test\n');
    write(dir, 'tools/a.js', '// a tool\n');
    commit(dir, 'Docs');
    expect(V.stepProblems(dir, 'main')).toEqual([]);
  });

  test('only the docs changed, and main got a new version since the branch left it: still fine', () => {
    const dir = repo();
    write(dir, 'README.md', '# X\n\nMore.\n');
    commit(dir, 'Docs');
    mainMovesOn(dir, 'minor');
    expect(read(dir, 'package.json')).toContain('"version": "1.4.2"');
    expect(V.stepProblems(dir, 'main')).toEqual([]);
    // main's change to the app is not this branch's change
    write(dir, 'style.css', 'body { color: blue; }\n');
    expect(V.stepProblems(dir, 'main')[0]).toContain('The app changed (style.css) but the version is 1.4.2');
  });

  test('the app changed with a new version, and main got that version too: merge main, then bump again', () => {
    const dir = repo();
    write(dir, 'style.css', 'body { color: blue; }\n');
    V.bump(dir, 'patch', '2026-11-21');
    commit(dir, 'A fix');
    mainMovesOn(dir, 'patch');
    expect(V.stepProblems(dir, 'main')).toEqual(['main is at 1.4.3 now, this branch at 1.4.3. Merge main, then run npm run bump again']);
    // main merged, and one step up from there: fine again
    git(dir, 'merge', '-q', '-X', 'ours', '--no-edit', 'main');
    write(dir, 'CHANGELOG.md', read(dir, 'CHANGELOG.md').replace('## [Unreleased]\n', '## [Unreleased]\n\n- The fix, again.\n'));
    V.bump(dir, 'patch', '2026-11-21');
    expect(V.stepProblems(dir, 'main')).toEqual([]);
  });

  test('a base branch name that could be read as an option is refused', () => {
    expect(V.stepProblems(ROOT, '--output=x')).toEqual(['Not a branch name: --output=x']);
    expect(V.stepProblems(ROOT, 'main;rm')).toEqual(['Not a branch name: main;rm']);
  });

  test('the site is the app and nothing else', () => {
    const dir = project({ 'style.css': 'body {}\n', 'appconfig.json': '{}\n', 'icon.svg': '<svg/>', 'icon.png': 'png', 'README.md': '# X\n' });
    for (const f of ['js/app/a.js', 'vendor/x/x.js', 'tests/a.spec.js', 'tools/a.js', 'designs/a.html', '_site/old.txt']) write(dir, f, '// ' + f + '\n');
    expect(V.site(dir, '_site')).toEqual(V.APP_FILES);
    const found = fs.readdirSync(path.join(dir, '_site'), { recursive: true }).map((f) => f.split(path.sep).join('/'))
      .filter((f) => fs.statSync(path.join(dir, '_site', f)).isFile()).sort();
    expect(found).toEqual(['appconfig.json', 'icon.png', 'icon.svg', 'index.html', 'js/app/a.js', 'style.css', 'vendor/x/x.js']);
    for (const f of found) expect(V.isApp(f), f).toBe(true);
    // never over the project itself, or a folder around it
    expect(() => V.site(dir, '.')).toThrow('Not a folder for the site: .');
    expect(() => V.site(dir, '..')).toThrow('Not a folder for the site: ..');
  });

  test('this project: every file index.html loads is part of the app that goes on the site', () => {
    const html = read(ROOT, 'index.html');
    for (const f of V.localFiles(html)) expect(V.isApp(f.replace(/\?.*$/, '')), f).toBe(true);
    for (const m of html.matchAll(/<link rel="[^"]*icon[^"]*" href="([^"]+)"/g)) expect(V.isApp(m[1]), m[1]).toBe(true);
  });

  test('this project: CLAUDE.md, DEVELOPING.md and the pull request template name the same files as the app', () => {
    const list = V.APP_FILES.join(', ');
    expect(list).toBe('index.html, style.css, appconfig.json, icon.svg, icon.png, js/, vendor/');
    for (const f of ['CLAUDE.md', 'DEVELOPING.md', '.github/pull_request_template.md']) expect(read(ROOT, f).replace(/`/g, ''), f).toContain(list);
    // and the site gets them through the tool, not a list of its own
    expect(read(ROOT, '.github/workflows/deploy.yml')).toContain('node tools/version.js site _site');
  });

  test('this project: package.json, package-lock.json, index.html and CHANGELOG.md agree', () => {
    expect(V.problems(ROOT)).toEqual([]);
  });
});
