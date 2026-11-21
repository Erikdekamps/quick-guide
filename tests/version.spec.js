// The version tool (tools/version.js): raising the version, and checking that package.json, index.html and
// CHANGELOG.md agree. It runs on copies of the files in a temporary folder; the last test checks the real ones.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const V = require('../tools/version');

const ROOT = path.resolve(__dirname, '..');
const LOG = '# Changelog\n\nIntro.\n\n## [Unreleased]\n\n### Fixed\n\n- A fix.\n\n## [1.4.2] - 2026-01-02\n\n### Added\n\n- Something.\n';

// A small copy of the project: package.json, package-lock.json, index.html and CHANGELOG.md.
function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-version-'));
  const all = Object.assign({
    'package.json': '{\n  "name": "x",\n  "version": "1.4.2",\n  "private": true\n}\n',
    'package-lock.json': JSON.stringify({ name: 'x', version: '1.4.2', lockfileVersion: 3, packages: { '': { name: 'x', version: '1.4.2' } } }, null, 2) + '\n',
    'index.html': '<link rel="stylesheet" href="style.css?v=1.4.2">\n<script src="https://example.com/x.js"></script>\n<script src="js/a.js?v=1.4.2"></script>\n<script src="js/b.js?v=1.4.2"></script>\n',
    'CHANGELOG.md': LOG
  }, files);
  for (const [f, s] of Object.entries(all)) if (s !== null) fs.writeFileSync(path.join(dir, f), s);
  return dir;
}
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

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
    for (const f of ['README.md', 'CHANGELOG.md', 'CLAUDE.md', 'tests/code.spec.js', 'tools/version.js', 'designs/canvas/Main.dc.html', 'package.json', '.github/workflows/tests.yml']) expect(V.isApp(f), f).toBe(false);
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

  test('a base branch name that could be read as an option is refused', () => {
    expect(V.stepProblems(ROOT, '--output=x')).toEqual(['Not a branch name: --output=x']);
    expect(V.stepProblems(ROOT, 'main;rm')).toEqual(['Not a branch name: main;rm']);
  });

  test('this project: package.json, package-lock.json, index.html and CHANGELOG.md agree', () => {
    expect(V.problems(ROOT)).toEqual([]);
  });
});
