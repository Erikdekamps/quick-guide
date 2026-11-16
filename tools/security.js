// Security and update check. Run it with: npm run security
// GitHub runs it on every change and every Monday (.github/workflows/security.yml).
//
// It fails when a known high or critical security problem affects:
//   - the npm packages: the test tools (Playwright), from package-lock.json
//   - Leaflet, the map library copied into vendor/leaflet (npm does not see it there, so it is checked on its own)
// Lower-rated problems and newer versions are listed so you can plan an update, but do not fail it.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const onGitHub = !!process.env.GITHUB_ACTIONS;
const summary = [];   // lines for the GitHub job summary
let failed = false;

function npm(args, cwd) {
  try {
    return execFileSync('npm', args, { cwd: cwd || root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return String(e.stdout || '');   // npm audit and npm outdated exit with 1 when they find something
  }
}
// Known security problems in a folder with a package-lock.json: counts per level.
function audit(cwd) {
  let j;
  try { j = JSON.parse(npm(['audit', '--json'], cwd)); } catch (e) { j = null; }
  const v = j && j.metadata && j.metadata.vulnerabilities;
  if (!v) throw new Error('npm audit gave no answer (is the internet reachable?)');
  return v;
}
function report(what, v) {
  const bad = (v.high || 0) + (v.critical || 0), any = bad + (v.moderate || 0) + (v.low || 0) + (v.info || 0);
  const text = any ? `${v.critical || 0} critical, ${v.high || 0} high, ${v.moderate || 0} moderate, ${v.low || 0} low` : 'none known';
  console.log(`${bad ? 'FAIL' : 'ok  '} ${what}: ${text}`);
  summary.push(`| ${what} | ${bad ? '❌ ' : any ? '⚠️ ' : '✅ '}${text} |`);
  if (bad) failed = true;
  if (any && onGitHub) console.log(`::${bad ? 'error' : 'warning'}::${what}: ${text}. Run npm audit for details.`);
}
function newer(name, have, latest) {
  console.log(`note ${name} ${have} is not the newest: ${latest}`);
  summary.push(`| ${name} | ${have} → ${latest} available |`);
  if (onGitHub) console.log(`::notice::${name} ${latest} is out (we use ${have}).`);
}

// 1. The npm packages
summary.push('### Known security problems', '', '| What | Problems |', '| --- | --- |');
report('npm packages (test tools)', audit(root));

// 2. Leaflet, copied into vendor/leaflet: audit the same version in a scratch folder
const head = fs.readFileSync(path.join(root, 'vendor/leaflet/leaflet.js'), 'utf8').slice(0, 400);
const m = /Leaflet (\d+\.\d+\.\d+)/.exec(head);
if (!m) throw new Error('Could not read the Leaflet version from vendor/leaflet/leaflet.js');
const leaflet = m[1], tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-leaflet-'));
try {
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'vendored', private: true, dependencies: { leaflet } }));
  npm(['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], tmp);
  report('Leaflet ' + leaflet + ' (vendor/leaflet)', audit(tmp));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// 3. Newer versions, to plan an update (never fails)
summary.push('', '### Newer versions', '', '| What | Version |', '| --- | --- |');
let out = {};
try { out = JSON.parse(npm(['outdated', '--json']) || '{}'); } catch (e) { out = {}; }
Object.keys(out).forEach((name) => {
  const have = out[name].current || out[name].wanted;   // (wanted: what package-lock.json has, before npm ci)
  if (have && out[name].latest && out[name].latest !== have) newer(name, have, out[name].latest);
});
const latestLeaflet = npm(['view', 'leaflet', 'version']).trim();
if (latestLeaflet && latestLeaflet !== leaflet) newer('leaflet (vendor/leaflet)', leaflet, latestLeaflet);
if (summary[summary.length - 1] === '| --- | --- |') { summary.push('| Everything | up to date |'); console.log('ok   everything is up to date'); }

if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
if (failed) { console.log('\nA known high or critical security problem: update the package (npm audit fix, or a newer vendor/leaflet).'); process.exit(1); }
