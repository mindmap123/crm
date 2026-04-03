const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const API_ROUTES = {
  '/api/google/status': path.join(ROOT, 'api/google/status.js'),
  '/api/google/oauth/start': path.join(ROOT, 'api/google/oauth/start.js'),
  '/api/google/oauth/callback': path.join(ROOT, 'api/google/oauth/callback.js'),
  '/api/google/calendar/event': path.join(ROOT, 'api/google/calendar/event.js'),
  '/api/google/gmail/invite': path.join(ROOT, 'api/google/gmail/invite.js'),
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendFile(filePath, res) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const pathname = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  if (API_ROUTES[pathname]) {
    try {
      delete require.cache[require.resolve(API_ROUTES[pathname])];
      const handler = require(API_ROUTES[pathname]);
      Promise.resolve(handler(req, res)).catch(error => {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: error.message || 'Erreur serveur API' }));
      });
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message || 'Erreur serveur API' }));
    }
    return;
  }

  const urlPath = pathname;
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(filePath, res);
      return;
    }

    sendFile(path.join(ROOT, 'index.html'), res);
  });
}).listen(PORT, HOST, () => {
  console.log(`L'Atelier CRM disponible sur http://${HOST}:${PORT}`);
});
