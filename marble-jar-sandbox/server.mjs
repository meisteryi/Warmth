import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THREE_BUILD_DIR = path.resolve(__dirname, '..', 'node_modules', 'three', 'build');
const PORT = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const rawUrl = (req.url || '/').split('?')[0];

  let filePath;
  if (rawUrl.startsWith('/vendor/')) {
    const rel = path.normalize(rawUrl.slice('/vendor/'.length)).replace(/^(\.\.[/\\])+/, '');
    filePath = path.join(THREE_BUILD_DIR, rel);
  } else {
    const rel = rawUrl === '/' ? 'index.html' : path.normalize(rawUrl.slice(1)).replace(/^(\.\.[/\\])+/, '');
    filePath = path.join(__dirname, rel);
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Marble Jar Sandbox running at http://localhost:${PORT}`);
});

