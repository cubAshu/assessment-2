const http = require('http');
const fs = require('fs');

const started = Date.now();
let requests = 0;
const logs = [];
const cache = new Map();

function log(line) {
  const entry = new Date().toISOString() + ' ' + line;
  console.log(entry);            // stdout, so "docker logs" shows it too
  logs.unshift(entry);
  if (logs.length > 20) logs.pop();
}

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  const uptime = Math.floor((Date.now() - started) / 1000);

  // monitoring endpoints: not counted and not logged
  if (p === '/health') return json(res, 200, { status: 'ok', uptime_s: uptime });
  if (p === '/api/stats') return json(res, 200, { requests, cache_items: cache.size, uptime_s: uptime });
  if (p === '/api/logs') return json(res, 200, logs);

  requests++;
  res.on('finish', () => log(req.method + ' ' + p + ' ' + res.statusCode));

  if (p === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(__dirname + '/index.html'));
  }
  if (p === '/api/sample') {
    return json(res, 200, { id: Math.random().toString(36).slice(2, 8), time: new Date().toISOString() });
  }
  if (p === '/api/cache' && req.method === 'GET') {
    return json(res, 200, [...cache].map(([key, value]) => ({ key, value })));
  }
  if (p === '/api/cache' && req.method === 'POST') {
    const key = u.searchParams.get('key');
    const value = u.searchParams.get('value');
    if (!key || !value || key.length > 40 || value.length > 200) {
      return json(res, 400, { error: 'key and value are required' });
    }
    if (cache.size >= 20 && !cache.has(key)) cache.delete(cache.keys().next().value);
    cache.set(key, value);
    return json(res, 201, { key, value });
  }
  if (p === '/api/cache' && req.method === 'DELETE') {
    cache.clear();
    res.writeHead(204);
    return res.end();
  }
  json(res, 404, { error: 'not found' });
});

server.listen(3000, '0.0.0.0', () => log('listening on port 3000'));

// "docker stop" sends SIGTERM; exit cleanly instead of being killed after 10 seconds
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
