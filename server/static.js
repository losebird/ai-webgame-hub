'use strict';
/* 开发用静态站：127.0.0.1:5500 提供本项目根目录。
   仅在 HTML 响应里注入一行 window.JIWAN_API_BASE，不动任何源文件。 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.JIWAN_WEB_PORT || 5500);
const HOST = process.env.JIWAN_WEB_HOST || '127.0.0.1';
const API_PORT = Number(process.env.JIWAN_PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    if (ext === '.html') {
      fs.readFile(file, 'utf8', (e2, html) => {
        if (e2) { res.writeHead(500); res.end('read error'); return; }
        const host = String(req.headers.host || HOST).split(':')[0];
        const inject = `<script>window.JIWAN_API_BASE=window.JIWAN_API_BASE||'http://${host}:${API_PORT}';</script>`;
        const out = html.includes('</head>') ? html.replace('</head>', inject + '</head>') : inject + html;
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(out) });
        res.end(out);
      });
      return;
    }
    let cache = 'public, max-age=3600';
    if (/\.(woff2?|ttf|otf|webp|png|jpe?g|gif|svg|ico)$/i.test(ext) || file.includes('/fonts/') || file.includes('/posters/')) cache = 'public, max-age=604800';
    else if (/\.(js|mjs|css)$/i.test(ext)) cache = 'public, max-age=86400';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[jiwan] web http://${HOST}:${PORT}  -> api :${API_PORT}`);
});

module.exports = { server };
