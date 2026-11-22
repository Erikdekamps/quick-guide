// Builds data/ from the RuneScape Wiki: npm run data
// GitHub runs it every night (.github/workflows/data.yml) and opens a pull request when the wiki changed.
//
// It reads every quest guide, area and cape with the app's own reader (tools/data/collect.js, in Chromium), makes the
// files (tools/data/shape.js) and writes the ones that changed. A file that is no longer wanted goes. What could not
// be read keeps its file from before, and the build says so. It stops, and changes nothing, when the lists cannot be
// read, an area or a cape is missing, or too many guides fail: a broken wiki must not empty the data.
//
//   DATA_SUMMARY=<file>   also writes what changed there, in Markdown (for the pull request)
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { serveFile, ORIGIN, ROOT } = require('../../tests/support/app');
const { READER, collect } = require('./collect');
const shape = require('./shape');

const DATA = path.join(ROOT, 'data');
// More guides than this that cannot be read: something is wrong with the wiki or the reader, not with a page.
const MAX_FAILED = 10;

// The .json files in data/ now: { "quests/x.json": text }.
function filesNow(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { recursive: true }).map(String)) {
    if (f.endsWith('.json')) out[f.split(path.sep).join('/')] = fs.readFileSync(path.join(dir, f), 'utf8');
  }
  return out;
}
// Writes what changed and removes what is gone. Gives how many files it touched.
function write(dir, now, old) {
  let n = 0;
  for (const [p, text] of Object.entries(now)) {
    if (old[p] === text) continue;
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), text);
    n++;
  }
  for (const p of Object.keys(old)) if (!(p in now)) { fs.rmSync(path.join(dir, p)); n++; }
  return n;
}

async function readWiki() {
  // (behind a proxy, like in some build machines: the browser uses it too)
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  try {
    const page = await browser.newPage();
    // The reader's own files come from this folder; everything else is the real wiki.
    await page.route(ORIGIN + '/**', (route) => serveFile(route));
    await page.goto(ORIGIN + '/__blank');
    for (const f of READER) await page.addScriptTag({ url: '/' + f });
    return await collect(page);
  } finally { await browser.close(); }
}

async function main() {
  const today = new Date().toISOString().slice(0, 10), old = filesNow(DATA);
  console.log('Reading the wiki…');
  const read = await readWiki();
  const guides = Object.values(read.guides).filter(Boolean).length;
  console.log('Read ' + guides + ' of ' + read.list.length + ' guides, ' + read.areas.length + ' areas, ' + read.capes.length + ' capes.');
  for (const f of read.failed) console.log('  could not read ' + f);
  const stop = read.list.length < 5 ? 'The quest list is too short.' :
    read.areas.length < read.want.areas ? 'An area could not be read.' :
    read.capes.length < read.want.capes ? 'A cape could not be read.' :
    read.failed.length > MAX_FAILED ? read.failed.length + ' pages could not be read.' : '';
  if (stop) { console.error('✗ ' + stop + ' Nothing is changed.'); process.exit(1); }
  const before = (p) => (old[p] ? JSON.parse(old[p]) : null);
  const now = shape.build(read, before, today), s = shape.summary(now, old);
  const n = write(DATA, now, old);
  const lines = s.lines.concat(read.failed.length ? ['', 'Could not be read this time (what was there stays):', ...read.failed.map((f) => '- ' + f)] : []);
  if (process.env.DATA_SUMMARY) fs.writeFileSync(process.env.DATA_SUMMARY, lines.join('\n') + '\n');
  console.log(n ? '✓ ' + n + ' files written or removed in data/.' : '✓ Nothing changed.');
  if (lines.length) console.log(lines.join('\n'));
}

module.exports = { filesNow, write };

if (require.main === module) main().catch((e) => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
