// Inlines app.css and app.js into one HTML file (dist/coinhold.html) for hosts that take a single page.
const fs = require('fs'), path = require('path');
const dir = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n/, '') // inline script can't run under script-src 'self'
  .replace('<link rel="stylesheet" href="app.css">', () => '<style>\n' + fs.readFileSync(path.join(dir, 'app.css'), 'utf8') + '</style>')
  .replace('<script src="app.js" defer></script>', '')
  .replace('</body>', () => '<script>\n' + fs.readFileSync(path.join(dir, 'app.js'), 'utf8') + '</script>\n</body>');
const out = path.resolve(dir, '../../dist/coinhold.html');
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(process.cwd(), out) + ' (' + (html.length / 1024).toFixed(0) + 'KB)');
