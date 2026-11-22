// The app on your own computer: npm start, then open the address it prints.
// The app reads its data with fetch, and a browser does not allow that for a page opened from a file on disk
// (file://). This serves the folder at http://localhost:8000/ instead. Only to this computer; only reading.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

// Every file of the folder it may serve: { "/js/app/core.js": the file }. Not hidden files and folders, not
// node_modules. A request is looked up in this list, so what it asks for never becomes a path on disk itself.
function filesIn(root) {
  const out = new Map();
  (function walk(dir, at) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      if (e.isDirectory()) walk(path.join(dir, e.name), at + e.name + '/');
      else if (e.isFile()) out.set(at + e.name, path.join(dir, e.name));
    }
  })(root, '/');
  return out;
}
// The file a request path stands for, or null. files: the list from filesIn.
function fileFor(files, urlPath) {
  let rel;
  try { rel = decodeURIComponent(String(urlPath).split('?')[0]); } catch (e) { return null; }
  if (rel.endsWith('/')) rel += 'index.html';
  return files.get(rel) || null;
}

function server(root) {
  root = root || ROOT;
  let files = filesIn(root);
  // A file that is not in the list may be new: the list is made again, once, before it says "not found".
  const find = (url) => fileFor(files, url) || fileFor(files = filesIn(root), url);
  return http.createServer((req, res) => {
    const file = req.method === 'GET' || req.method === 'HEAD' ? find(req.url) : null;
    if (!file || !fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    // never an old copy: you are changing these files
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

// Starts it on this port, or on the next one that is free (20 tries). Gives the server; its port is the one it got.
function start(root, port, tries) {
  tries = tries == null ? 20 : tries;
  return new Promise((resolve, reject) => {
    const s = server(root);
    s.once('error', (e) => {
      if (e.code === 'EADDRINUSE' && tries > 0) resolve(start(root, port + 1, tries - 1));
      else reject(e);
    });
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}

module.exports = { server, start, filesIn, fileFor };

if (require.main === module) {
  const port = Number(process.env.PORT) || 8000;
  start(ROOT, port).then((s) => {
    const got = s.address().port;
    if (got !== port) console.log('Port ' + port + ' is in use: took ' + got + '.');
    console.log('Quick Guide is at http://localhost:' + got + '/  (Ctrl+C stops it)');
  }, (e) => { console.error('Could not start: ' + e.message); process.exit(1); });
}
