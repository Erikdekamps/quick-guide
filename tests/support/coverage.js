// Which code of the app no test runs. "npm run coverage" does both steps:
//   QG_COVERAGE=coverage npx playwright test --project=app
//   node tests/support/coverage.js coverage
// It prints, for each file, how much of it ran. Then it checks tests/coverage.json, the blocks of code no test
// runs (a part of an if, a || fallback, a function): a file may not get more of them, so new code comes with tests.
// When a file has fewer, save the new list, so it cannot go back up:
//   npm run coverage -- --update
// With --lines it also prints the lines that never run.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'coverage', root = path.resolve(__dirname, '..', '..');
const SAVED = path.join(root, 'tests', 'coverage.json');
const update = process.argv.includes('--update');

// What ran, per file: a byte is "ran" when any test ran it.
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

const now = {};
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

if (update) {
  const out = {};
  for (const name of Object.keys(now)) out[name] = now[name].map((b) => b.text);
  fs.writeFileSync(SAVED, JSON.stringify(out, null, 1) + '\n');
  console.log('\nSaved tests/coverage.json.');
  process.exit(0);
}

// Compared with tests/coverage.json.
const saved = fs.existsSync(SAVED) ? JSON.parse(fs.readFileSync(SAVED, 'utf8')) : {};
let failed = false, fewer = 0;
console.log('');
for (const name of Object.keys(now)) {
  const before = saved[name] || [];
  if (now[name].length > before.length) {
    failed = true;
    // The blocks that are not in the saved list (the same text can be there more than once).
    const left = {};
    for (const t of before) left[t] = (left[t] || 0) + 1;
    const added = now[name].filter((b) => !(left[b.text]-- > 0));
    console.log('✗ ' + name + ': ' + now[name].length + ' blocks never run, was ' + before.length + '. Test these, or explain in the pull request why not:');
    for (const b of added) console.log('    line ' + b.line + ': ' + b.text);
  } else if (now[name].length < before.length) fewer += before.length - now[name].length;
}
for (const name of Object.keys(saved)) {
  if (now[name]) continue;
  if (fs.existsSync(path.join(root, name))) { failed = true; console.log('✗ ' + name + ': no test ran it'); } else fewer++;
}
if (failed) {
  console.log('\nOnly when it is right that a block is not tested: npm run coverage -- --update, and commit tests/coverage.json.');
  process.exit(1);
}
console.log(fewer ? '✓ ' + fewer + ' fewer blocks never run than tests/coverage.json says. Save that with: npm run coverage -- --update'
  : '✓ No new code that no test runs.');
