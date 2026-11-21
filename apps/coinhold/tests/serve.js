// Tiny static server for the tests: serves apps/coinhold with the same headers as _headers.
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const headers = {};
fs.readFileSync(path.join(ROOT, '_headers'), 'utf8').split('\n').forEach(l => { const m = l.match(/^\s+([\w-]+):\s*(.+)$/); if (m && m[1] !== 'Strict-Transport-Security') headers[m[1]] = m[2]; });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
module.exports = function serve(port = 0) {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT) || !TYPES[path.extname(f)] || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end('Not found'); }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)], ...headers });
      fs.createReadStream(f).pipe(rsp);
    }).listen(port, '127.0.0.1', () => res({ url: `http://localhost:${srv.address().port}/`, close: () => srv.close() }));
  });
};
if (require.main === module) module.exports(Number(process.env.PORT) || 8787).then(s => console.log('Coinhold at ' + s.url));
