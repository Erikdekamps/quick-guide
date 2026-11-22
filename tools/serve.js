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

// The file a request path stands for, or null: not outside the folder, not a hidden file, not a folder.
function fileFor(root, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath.split('?')[0]); } catch (e) { return null; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, path.normalize(rel));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  if (path.relative(root, file).split(path.sep).some((p) => p.startsWith('.'))) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

function server(root) {
  root = root || ROOT;
  return http.createServer((req, res) => {
    const file = req.method === 'GET' || req.method === 'HEAD' ? fileFor(root, req.url) : null;
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    // never an old copy: you are changing these files
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

module.exports = { server, fileFor };

if (require.main === module) {
  const port = Number(process.env.PORT) || 8000;
  server().listen(port, '127.0.0.1', () => { console.log('Quick Guide is at http://localhost:' + port + '/  (Ctrl+C stops it)'); });
}
