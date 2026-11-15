// Which lines of the app no test runs. "npm run coverage" does both steps:
//   QG_COVERAGE=coverage npx playwright test --project=app
//   node tests/support/coverage.js coverage
// It prints, for each file, how much of it ran, and the lines that never did.
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || 'coverage', root = path.resolve(__dirname, '..', '..');
const files = {};
for (const f of fs.readdirSync(dir)) {
  for (const e of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) {
    const name = e.url.replace(/^.*\//, ''), src = fs.readFileSync(path.join(root, name), 'utf8');
    const hit = files[name] || (files[name] = { src, ran: new Uint8Array(src.length) });
    // V8 ranges nest: a later (inner) range overrides an outer one. Mark what ran in this test, then add it up.
    const mine = new Int8Array(src.length).fill(-1);
    for (const fn of e.functions) for (const r of fn.ranges) mine.fill(r.count > 0 ? 1 : 0, r.startOffset, Math.min(r.endOffset, src.length));
    for (let i = 0; i < src.length; i++) if (mine[i] === 1) hit.ran[i] = 1;
  }
}
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
  console.log(name + ': ' + Math.round(100 * done / code) + '% of ' + code + ' lines');
  if (process.argv.includes('--lines')) console.log('  never run: ' + missed.join(' '));
}
