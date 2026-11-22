// The app's version: one number for the whole app, MAJOR.MINOR.PATCH (semantic versioning, https://semver.org).
//   MAJOR  saved data or the export file changes so that old ones no longer work as before
//   MINOR  something new you can see or do
//   PATCH  a fix, or a change you do not see
// It is in package.json, and in every ?v= cache number in index.html (so Alt1 loads new copies of the files).
// CHANGELOG.md says what changed in each version.
//
//   npm run bump -- patch|minor|major      raises it everywhere. What is under "Unreleased" in CHANGELOG.md goes
//                                          under the new number, with today's date.
//   npm run check:version                  checks that package.json, index.html and CHANGELOG.md agree
//   npm run check:version -- origin/main   also checks that a change to the app raised the version one step
//   node tools/version.js notes [x.y.z]    prints what CHANGELOG.md says about a version (the release text)
//   node tools/version.js site <folder>    copies the app and data/, and nothing else, to a folder (what GitHub Pages gets)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LEVELS = ['patch', 'minor', 'major'];
// The app: the files GitHub Pages serves (.github/workflows/deploy.yml copies these, and nothing else). A change to
// one of them is a new version. CLAUDE.md, DEVELOPING.md and the pull request template name the same list.
const APP_FILES = ['index.html', 'style.css', 'appconfig.json', 'icon.svg', 'icon.png', 'js/', 'vendor/'];
// The wiki's data goes on the site too, but is no part of the app's version: a build makes it every night
// (tools/data/build.js), and a change to it needs no new version.
const SITE_FILES = APP_FILES.concat(['data/']);
// "## [1.2.3] - 2026-11-21" or "## [Unreleased]"
const HEADING = /^## \[([^\]]+)\](?: - (\S+))?[ \t]*$/gm;

function parse(v) {
  const m = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(v));
  if (!m) throw new Error('Not a version like 1.2.3: ' + v);
  return [+m[1], +m[2], +m[3]];
}
function next(v, level) {
  const [a, b, c] = parse(v);
  if (level === 'major') return (a + 1) + '.0.0';
  if (level === 'minor') return a + '.' + (b + 1) + '.0';
  if (level === 'patch') return a + '.' + b + '.' + (c + 1);
  throw new Error('Say patch, minor or major, not: ' + level);
}
// 1 when a is higher, -1 when b is, 0 when they are the same.
function compare(a, b) {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
// True when "to" is one step up from "from": the next patch, minor or major.
function isStep(from, to) { return LEVELS.some((l) => next(from, l) === to); }
function isApp(file) { return APP_FILES.some((f) => (f.endsWith('/') ? file.startsWith(f) : file === f)); }

// ---------- the files ----------
function read(root, f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function cacheNumbers(htmlText) { return [...htmlText.matchAll(/\?v=([^"'&\s>]+)/g)].map((m) => m[1]); }
// The scripts and styles of the app that index.html loads (not the ones from other sites).
function localFiles(htmlText) {
  return [...htmlText.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)].map((m) => m[1])
    .filter((u) => !/^(https?:)?\/\//.test(u) && /\.(js|css)(\?|$)/.test(u));
}
// The headings of CHANGELOG.md, top to bottom: [{ name, date, at, end }] (end: where the next heading starts).
function headings(text) {
  const out = [...text.matchAll(HEADING)].map((m) => ({ name: m[1], date: m[2] || '', at: m.index, body: m.index + m[0].length }));
  out.forEach((h, i) => { h.end = i + 1 < out.length ? out[i + 1].at : text.length; });
  return out;
}
// What CHANGELOG.md says under a heading (a version, or "Unreleased"), or null when it has no such heading.
function notes(text, name) {
  const h = headings(text).find((x) => x.name === name);
  return h ? text.slice(h.body, h.end).trim() : null;
}

// ---------- the checks ----------
// What does not agree: [] when everything is fine.
function problems(root) {
  root = root || ROOT;
  const out = [];
  let version;
  try { version = JSON.parse(read(root, 'package.json')).version; parse(version); } catch (e) {
    return ['package.json has no version like 1.2.3 (' + e.message + ')'];
  }
  if (fs.existsSync(path.join(root, 'package-lock.json'))) {
    const lock = JSON.parse(read(root, 'package-lock.json'));
    const inLock = [lock.version, lock.packages && lock.packages[''] && lock.packages[''].version];
    if (inLock.some((v) => v !== version)) out.push('package-lock.json says ' + inLock.join(' and ') + ', package.json says ' + version + ' (run npm install)');
  }
  const html = read(root, 'index.html');
  const numbers = cacheNumbers(html);
  if (!numbers.length) out.push('index.html has no ?v= cache numbers');
  const wrong = [...new Set(numbers.filter((v) => v !== version))];
  if (wrong.length) out.push('index.html has ?v=' + wrong.join(', ?v=') + '; package.json says ' + version + ' (use npm run bump)');
  for (const u of localFiles(html)) if (!/\?v=/.test(u)) out.push('index.html loads ' + u + ' without a ?v= cache number');
  let log = '';
  try { log = read(root, 'CHANGELOG.md'); } catch (e) { out.push('CHANGELOG.md is missing'); }
  if (log) {
    const hs = headings(log), names = hs.map((h) => h.name);
    if (names[0] !== 'Unreleased') out.push('CHANGELOG.md does not start with "## [Unreleased]"');
    const versions = hs.filter((h) => h.name !== 'Unreleased');
    for (const h of versions) {
      try { parse(h.name); } catch (e) { out.push('CHANGELOG.md has a heading that is no version: ' + h.name); continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(h.date)) out.push('CHANGELOG.md: ' + h.name + ' has no date like 2026-11-21');
    }
    if (new Set(names).size !== names.length) out.push('CHANGELOG.md has a heading twice');
    const ok = versions.map((h) => h.name).filter((v) => { try { parse(v); return true; } catch (e) { return false; } });
    for (let i = 1; i < ok.length; i++) if (compare(ok[i - 1], ok[i]) <= 0) out.push('CHANGELOG.md: ' + ok[i - 1] + ' is above ' + ok[i] + ' (the newest goes on top)');
    const mine = notes(log, version);
    if (mine === null) out.push('CHANGELOG.md has no "## [' + version + ']" (use npm run bump)');
    else if (!/^- /m.test(mine)) out.push('CHANGELOG.md says nothing under ' + version);
  }
  return out;
}

function git(root, args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
// The version on another branch (package.json, or the cache number in index.html before package.json had one).
function versionAt(root, ref) {
  try {
    const v = JSON.parse(git(root, ['show', ref + ':package.json'])).version;
    if (v) return v;
  } catch (e) { /* no package.json there */ }
  return cacheNumbers(git(root, ['show', ref + ':index.html']))[0];
}
// Compared with a base branch: a change to the app must raise the version one step.
// "From" is the version where this branch left the base, not the base as it is now: a branch that only changes the
// docs still passes after the base got a new version. (On GitHub a pull request is checked merged into the base, so
// there the two are the same.)
function stepProblems(root, base) {
  root = root || ROOT;
  if (!/^[\w./-]+$/.test(base) || base.startsWith('-')) return ['Not a branch name: ' + base];
  const left = git(root, ['merge-base', base, 'HEAD']).trim();
  const from = versionAt(root, left), now = versionAt(root, base), to = JSON.parse(read(root, 'package.json')).version;
  // What this branch changed since it left the base (with what is not committed yet).
  const changed = git(root, ['diff', '--name-only', left]).split('\n').filter(Boolean);
  const app = changed.filter(isApp);
  if (to === from) {
    return app.length ? ['The app changed (' + app.slice(0, 5).join(', ') + (app.length > 5 ? ', …' : '') + ') but the version is ' + to +
      ', like ' + base + '. Run: npm run bump -- patch (a fix), minor (something new) or major (saved data changes)'] : [];
  }
  if (!isStep(from, to)) return ['The version goes from ' + from + ' to ' + to + '; one step up is ' + LEVELS.map((l) => next(from, l)).join(', ')];
  // The base got a new version after this branch left it: this one must be a step up from that too.
  if (now !== from && !isStep(now, to)) return [base + ' is at ' + now + ' now, this branch at ' + to + '. Merge ' + base + ', then run npm run bump again'];
  return [];
}

// ---------- raising it ----------
function today() { return new Date().toISOString().slice(0, 10); }
// Raises the version in package.json, package-lock.json, index.html and CHANGELOG.md. Returns { from, to }.
function bump(root, level, date) {
  root = root || ROOT;
  const pkgText = read(root, 'package.json'), from = JSON.parse(pkgText).version, to = next(from, level);
  const html = read(root, 'index.html'), numbers = cacheNumbers(html);
  if (!numbers.length || numbers.some((v) => v !== from)) throw new Error('index.html has cache numbers that are not ' + from + ': fix them first (npm run check:version)');
  const log = read(root, 'CHANGELOG.md'), top = headings(log)[0];
  if (!top || top.name !== 'Unreleased') throw new Error('CHANGELOG.md does not start with "## [Unreleased]"');
  const text = log.slice(top.body, top.end).trim();
  if (!/^- /m.test(text)) throw new Error('Write what changed under "## [Unreleased]" in CHANGELOG.md first');
  if (notes(log, to) !== null) throw new Error('CHANGELOG.md has ' + to + ' already');
  const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
  write('package.json', pkgText.replace(/("version":\s*")[^"]*(")/, '$1' + to + '$2'));
  if (fs.existsSync(path.join(root, 'package-lock.json'))) {
    const lock = JSON.parse(read(root, 'package-lock.json'));
    lock.version = to;
    if (lock.packages && lock.packages['']) lock.packages[''].version = to;
    write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  }
  write('index.html', html.split('?v=' + from).join('?v=' + to));
  write('CHANGELOG.md', log.slice(0, top.body) + '\n\n## [' + to + '] - ' + (date || today()) + '\n\n' + text + '\n' +
    (top.end < log.length ? '\n' + log.slice(top.end) : ''));
  return { from, to, files: numbers.length };
}

// ---------- the site ----------
// Copies the app's files and the data to a folder (made new, or emptied first): what goes on GitHub Pages. Not the
// designs, the tests, the tools or the docs. Returns what it copied.
function site(root, out) {
  root = root || ROOT;
  const to = path.resolve(root, out);
  if (to === root || root.startsWith(to + path.sep)) throw new Error('Not a folder for the site: ' + out);
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  const there = SITE_FILES.filter((f) => APP_FILES.includes(f) || fs.existsSync(path.join(root, f)));
  for (const f of there) fs.cpSync(path.join(root, f), path.join(to, f), { recursive: true });
  return there;
}

module.exports = { site, APP_FILES, SITE_FILES, parse, next, compare, isStep, isApp, cacheNumbers, localFiles, headings, notes, problems, stepProblems, bump };

if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === 'bump') {
      const r = bump(ROOT, arg);
      console.log('Version ' + r.from + ' → ' + r.to + ': package.json, package-lock.json, ' + r.files + ' cache numbers in index.html, CHANGELOG.md.');
    } else if (cmd === 'check') {
      const out = problems(ROOT).concat(arg ? stepProblems(ROOT, arg) : []);
      if (out.length) { console.error(out.map((p) => '✗ ' + p).join('\n')); process.exit(1); }
      console.log('✓ Version ' + JSON.parse(read(ROOT, 'package.json')).version + ': package.json, index.html and CHANGELOG.md agree' +
        (arg ? ', and it is right compared with ' + arg : '') + '.');
    } else if (cmd === 'site') {
      if (!arg) throw new Error('Say which folder: node tools/version.js site _site');
      console.log('The app is in ' + arg + ': ' + site(ROOT, arg).join(', ') + '.');
    } else if (cmd === 'notes') {
      const v = arg || JSON.parse(read(ROOT, 'package.json')).version, n = notes(read(ROOT, 'CHANGELOG.md'), v);
      if (n === null) throw new Error('CHANGELOG.md has no ' + v);
      console.log(n);
    } else {
      console.error('Use: node tools/version.js bump patch|minor|major, check [base branch], notes [version], or site <folder>');
      process.exit(2);
    }
  } catch (e) {
    console.error('✗ ' + e.message);
    process.exit(1);
  }
}
