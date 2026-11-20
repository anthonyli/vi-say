// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

// Local preview server with byte ranges. Python's http.server answers Range
// with the whole file, and Chrome then refuses to seek the narration WAV.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

export function createPreviewServer(root) {
  const directory = path.resolve(root);
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    let relative;
    try {
      relative = decodeURIComponent(url.pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (relative.endsWith('/')) relative += 'index.html';
    relative = relative.replace(/^\/+/, '');
    const file = path.resolve(directory, relative);
    if (file !== directory && !file.startsWith(directory + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        response.writeHead(404).end();
        return;
      }
      const type = types[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
      const headers = {'Accept-Ranges': 'bytes', 'Content-Type': type};
      const send = (status, extra, start, end) => {
        response.writeHead(status, {...headers, ...extra});
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        fs.createReadStream(file, {start, end}).pipe(response);
      };
      const range = request.headers.range;
      if (!range) {
        send(200, {'Content-Length': stat.size});
        return;
      }
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) {
        response.writeHead(416, {'Content-Range': `bytes */${stat.size}`}).end();
        return;
      }
      const start = match[1] === '' ? Math.max(0, stat.size - Number(match[2] || 0)) : Number(match[1]);
      const end = match[2] === '' || match[1] === '' ? stat.size - 1 : Number(match[2]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= stat.size || end < 0) {
        response.writeHead(416, {'Content-Range': `bytes */${stat.size}`}).end();
        return;
      }
      const last = Math.min(end, stat.size - 1);
      send(206, {
        'Content-Range': `bytes ${start}-${last}/${stat.size}`,
        'Content-Length': last - start + 1,
      }, start, last);
    });
  });
}

function main() {
  const directory = process.argv[2];
  const port = process.argv[3] === undefined ? 8765 : Number(process.argv[3]);
  if (!directory || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Usage: node preview-server.mjs DIRECTORY [PORT]');
  }
  if (!fs.existsSync(directory)) throw new Error(`Preview directory does not exist: ${directory}`);
  const server = createPreviewServer(directory);
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use` : error.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    console.log(`http://127.0.0.1:${address.port}/`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
