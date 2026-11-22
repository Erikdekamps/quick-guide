// npm start (tools/serve.js): the app on your own computer.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { server, start, fileFor } = require('../../tools/serve');

const ROOT = path.resolve(__dirname, '..', '..');

test('which file a path stands for: inside the folder only, no hidden files, no folders', () => {
  expect(fileFor(ROOT, '/')).toBe(path.join(ROOT, 'index.html'));
  expect(fileFor(ROOT, '/data/index.json?h=abc')).toBe(path.join(ROOT, 'data', 'index.json'));
  expect(fileFor(ROOT, '/js/app/core.js')).toBe(path.join(ROOT, 'js', 'app', 'core.js'));
  expect(fileFor(ROOT, '/../../etc/passwd')).toBeNull();
  expect(fileFor(ROOT, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull();
  expect(fileFor(ROOT, '/.git/config')).toBeNull();
  expect(fileFor(ROOT, '/js')).toBeNull();
  expect(fileFor(ROOT, '/nothing.html')).toBeNull();
  expect(fileFor(ROOT, '/%E0%A4%A')).toBeNull();
});

test('it serves the files with their type, never an old copy, and 404 for the rest', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-serve-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<p>hi</p>');
  fs.mkdirSync(path.join(dir, 'data'));
  fs.writeFileSync(path.join(dir, 'data', 'index.json'), '{"format":1}');
  fs.writeFileSync(path.join(dir, 'thing.bin'), 'x');
  const s = server(dir);
  await new Promise((done) => { s.listen(0, '127.0.0.1', done); });
  const at = 'http://127.0.0.1:' + s.address().port;
  try {
    const page = await fetch(at + '/');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(await page.text()).toBe('<p>hi</p>');
    expect(await (await fetch(at + '/data/index.json?h=1')).json()).toEqual({ format: 1 });
    expect((await fetch(at + '/thing.bin')).headers.get('content-type')).toBe('application/octet-stream');
    const head = await fetch(at + '/', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect((await fetch(at + '/nope')).status).toBe(404);
    expect((await fetch(at + '/', { method: 'POST' })).status).toBe(404);
  } finally {
    await new Promise((done) => { s.close(done); });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a port that is in use: it takes the next free one; with no tries left it fails', async () => {
  const first = await start(ROOT, 0);
  const port = first.address().port;
  let second;
  try {
    second = await start(ROOT, port);
    expect(second.address().port).toBeGreaterThan(port);
    await expect(start(ROOT, port, 0)).rejects.toMatchObject({ code: 'EADDRINUSE' });
  } finally {
    await new Promise((done) => { first.close(done); });
    if (second) await new Promise((done) => { second.close(done); });
  }
});

test('with no folder given it serves this project', () => {
  expect(server()).toBeTruthy();
});
