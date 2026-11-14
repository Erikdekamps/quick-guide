/* A tiny web server, so Alt1 can load the app from this computer.
   Use: node tools/serve.js [port] */
var http = require('http'), fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..'), port = +(process.argv[2] || 8232);
var TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

http.createServer(function (req, res) {
  var rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.slice(-1) === '/') rel += 'index.html';
  var file = path.join(root, path.normalize(rel));
  if (file.indexOf(root) !== 0) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404); return res.end('not found: ' + rel); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}).listen(port, '127.0.0.1', function () {
  console.log('Quick Guide is on http://localhost:' + port + '/');
  console.log('Add it to Alt1: alt1://addapp/http://localhost:' + port + '/appconfig.json');
});
