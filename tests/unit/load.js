// Unit tests run the app's own files in Node, without a browser: a test takes a few milliseconds, and all of them run
// before the browser tests (npm run test:unit runs only them).
//
// load() runs js/wiki and js/app (not main.js, which starts the app) in a stand-in for a page, with only what the
// files touch while they load. Code that needs a real page (reading wiki HTML, drawing a screen) throws "needs a
// browser": test that in a browser test (tests/*.spec.js). load({ fetch, storage }) gives the files a fake fetch and
// what localStorage holds (without the "qg1." in front).
//
// With QG_COVERAGE set (npm run coverage), the unit tests also save which code of the app they ran, next to what the
// browser tests ran, so tests/coverage.json counts both.
const fs = require('fs');
const inspector = require('inspector');
const path = require('path');
const { pathToFileURL } = require('url');
const vm = require('vm');
const base = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');
const ORIGIN = 'http://quick-guide.test';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// The files, in the order index.html loads them.
const FILES = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map((m) => m[1]).filter((f) => f !== 'js/app/main.js');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const SOURCES = FILES.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
// The wiki reader: the files the data build uses (the app itself does not load them).
const READER_SOURCES = require('../../tools/data/collect').READER.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);

// Anything that needs a real page: using it throws.
const NO_PAGE = new Proxy({}, {
  get(t, k) {
    if (typeof k === 'symbol' || k === 'then') return undefined;
    throw new Error('This needs a browser (it uses the page: ' + String(k) + '). Test it in a browser test.');
  }
});

// localStorage, in memory. keys: what it holds, without "qg1.".
function storage(keys) {
  const m = new Map(Object.entries(keys || {}).map(([k, v]) => ['qg1.' + k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    // What the app saved under a key (without "qg1."), read back.
    saved: (k) => (m.has('qg1.' + k) ? JSON.parse(m.get('qg1.' + k)) : null)
  };
}

function load(opts = {}) {
  const el = () => ({ addEventListener() {}, removeEventListener() {} });
  const app = el();
  const document = {
    getElementById: (id) => (id === 'app' ? app : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    implementation: { createHTMLDocument: () => NO_PAGE },
    currentScript: null,
    documentElement: el()
  };
  const window = {
    document,
    localStorage: storage(opts.storage),
    fetch: opts.fetch || (() => Promise.reject(new Error('This test gave no fetch: load({ fetch })'))),
    setTimeout, clearTimeout, AbortController, URL, URLSearchParams,
    navigator: { userAgent: 'node' },
    location: opts.location || { href: ORIGIN + '/', protocol: 'http:' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}
  };
  window.window = window;
  const ctx = vm.createContext(window);
  // opts.reader: the wiki reader, not the app.
  for (const [f, src] of opts.reader ? READER_SOURCES : SOURCES) {
    // core.js reads the version from the ?v= it is loaded with, like in the browser
    document.currentScript = f === 'js/app/core.js' ? { src: ORIGIN + '/' + f + '?v=' + VERSION } : null;
    vm.runInContext(src, ctx, { filename: path.join(ROOT, f) });
  }
  document.currentScript = null;
  return {
    window, QG: window.QuickGuide, D: window.QuickGuideData, A: window.QuickGuideApp, storage: window.localStorage,
    // Runs code in the page: for what must come from the page itself, like its own TypeError.
    run: (code) => vm.runInContext(code, ctx)
  };
}

// A fake fetch: answer(url) gives { status, json } (or throws, like a network error). It keeps the URLs it was asked,
// and how many requests were open at once at most.
function fakeFetch(answer) {
  const f = (url) => {
    f.urls.push(String(url));
    f.open++;
    f.most = Math.max(f.most, f.open);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        f.open--;
        let a;
        try { a = answer(String(url)); } catch (e) { reject(e); return; }
        const status = a.status || 200;
        resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(a.json) });
      }, 1);
    });
  };
  f.urls = [];
  f.open = 0;
  f.most = 0;
  return f;
}
// The page titles a wiki API URL asks for.
function titlesOf(url) { return new URL(url).searchParams.get('titles').split('|'); }

const test = base.test.extend({
  appCoverage: [async ({}, use) => {
    const dir = process.env.QG_COVERAGE;
    if (!dir) { await use(); return; }
    const session = new inspector.Session();
    session.connect();
    const post = (m, p) => new Promise((res, rej) => { session.post(m, p || {}, (e, r) => (e ? rej(e) : res(r))); });
    await post('Profiler.enable');
    await post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    await use();
    const { result } = await post('Profiler.takePreciseCoverage');
    const root = pathToFileURL(ROOT).href + '/';
    const out = result.filter((r) => r.url.startsWith(root + 'js/')).map((r) => ({ url: ORIGIN + '/' + r.url.slice(root.length), functions: r.functions }));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'unit-' + process.pid + '.json'), JSON.stringify(out));
    session.disconnect();
  }, { scope: 'worker', auto: true }]
});

module.exports = { test, expect: base.expect, load, fakeFetch, titlesOf, storage, ROOT, VERSION };
