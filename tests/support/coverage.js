// Which code of the app no test runs. "npm run coverage" does both steps:
//   QG_COVERAGE=coverage npx playwright test --project=app
//   node tests/support/coverage.js coverage
// It prints, for each file, how much of it ran. Then it checks tests/coverage.json, the blocks of code no test
// runs (a part of an if, a || fallback, a function): a block that is not in that list fails, so new code comes with
// tests. The blocks themselves are compared, not how many there are: a new one cannot hide behind one that went away.
// When blocks went away, save the new list, so they cannot come back:
//   npm run coverage -- --update
// With --lines it also prints the lines that never run.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const SAVED = path.join(root, 'tests', 'coverage.json');

// What ran, per file, from what the tests saved in a folder: a byte is "ran" when any test ran it.
function ranIn(dir) {
  const files = {};
  for (const f of fs.readdirSync(dir)) {
    for (const e of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      const name = new URL(e.url).pathname.slice(1), src = fs.readFileSync(path.join(root, name), 'utf8');
      const hit = files[name] || (files[name] = { src, ran: new Uint8Array(src.length) });
      // V8 ranges nest: a later (inner) range overrides an outer one. Mark what ran in this test, then add it up.
      const mine = new Int8Array(src.length).fill(-1);
      for (const fn of e.functions) for (const r of fn.ranges) mine.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, src.length));
      for (let i = 0; i < src.length; i++) if (mine[i] === 1) hit.ran[i] = 1;
    }
  }
  return files;
}

// The blocks no test runs: [{ line, text }]. Only brackets, commas and comments do not count.
function blocks(src, ran) {
  const out = [];
  for (let i = 0; i < src.length;) {
    if (ran[i]) { i++; continue; }
    let j = i;
    while (j < src.length && !ran[j]) j++;
    const t = src.slice(i, j);
    if (/[^\s})\];,]/.test(t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''))) {
      out.push({ line: src.slice(0, i).split('\n').length, text: t.replace(/\s+/g, ' ').trim().slice(0, 80) });
    }
    i = j;
  }
  return out;
}

// The blocks of one file against its saved list (texts). The same text can be there more than once: each saved one
// stands for one block. Returns { added: the blocks that are not in the list, gone: how many of the list are no more }.
function compareFile(saved, now) {
  const left = {};
  for (const t of saved) left[t] = (left[t] || 0) + 1;
  const added = now.filter((b) => !(left[b.text]-- > 0));
  return { added, gone: saved.length - (now.length - added.length) };
}

// Everything against tests/coverage.json. saved: { file: [text] }, now: { file: [{ line, text }] }, exists: is a
// file still there? Returns { problems: lines to print (none: fine), gone: how many saved blocks are no more }.
function compare(saved, now, exists) {
  const problems = [];
  let gone = 0;
  for (const name of Object.keys(now)) {
    const r = compareFile(saved[name] || [], now[name]);
    gone += r.gone;
    if (!r.added.length) continue;
    problems.push('✗ ' + name + ': ' + r.added.length + (r.added.length === 1 ? ' new block' : ' new blocks') + ' that no test runs. Test ' +
      (r.added.length === 1 ? 'it' : 'them') + ', or explain in the pull request why not:');
    for (const b of r.added) problems.push('    line ' + b.line + ': ' + b.text);
  }
  for (const name of Object.keys(saved)) {
    if (now[name]) continue;
    if (exists(name)) problems.push('✗ ' + name + ': no test ran it'); else gone += saved[name].length || 1;
  }
  return { problems, gone };
}

module.exports = { blocks, compareFile, compare };

if (require.main === module) {
  const dir = process.argv[2] || 'coverage', files = ranIn(dir), now = {};
  for (const name of Object.keys(files).sort()) {
    const { src, ran } = files[name], lines = src.split('\n');
    let at = 0, code = 0, done = 0;
    const missed = [];
    lines.forEach((line, n) => {
      const t = line.trim();
      if (t && !t.startsWith('//') && !/^[})\];,]*$/.test(t)) {
        code++;
        let any = false;
        for (let i = at + line.indexOf(t); i < at + line.length; i++) if (ran[i]) { any = true; break; }
        if (any) done++; else missed.push(n + 1);
      }
      at += line.length + 1;
    });
    now[name] = blocks(src, ran);
    console.log(name + ': ' + Math.round(100 * done / code) + '% of ' + code + ' lines, ' + now[name].length + ' blocks never run');
    if (process.argv.includes('--lines')) console.log('  never run: ' + missed.join(' '));
  }

  if (process.argv.includes('--update')) {
    const out = {};
    for (const name of Object.keys(now)) out[name] = now[name].map((b) => b.text);
    fs.writeFileSync(SAVED, JSON.stringify(out, null, 1) + '\n');
    console.log('\nSaved tests/coverage.json.');
    process.exit(0);
  }

  const saved = fs.existsSync(SAVED) ? JSON.parse(fs.readFileSync(SAVED, 'utf8')) : {};
  const r = compare(saved, now, (name) => fs.existsSync(path.join(root, name)));
  console.log('');
  if (r.problems.length) {
    console.log(r.problems.join('\n'));
    console.log('\nOnly when it is right that a block is not tested: npm run coverage -- --update, and commit tests/coverage.json.');
    process.exit(1);
  }
  console.log(r.gone ? '✓ No new code that no test runs. ' + r.gone + ' of the blocks in tests/coverage.json are gone: save that with npm run coverage -- --update'
    : '✓ No new code that no test runs.');
}
