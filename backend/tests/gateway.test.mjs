import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { createGateway } from '../server.mjs';

async function listen(server, t) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('gateway forwards API method, JSON, query, token, and upstream status', async (t) => {
  const upstream = await listen(createServer(async (req, res) => {
    const chunks = [];
    for await (const part of req) chunks.push(part);
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      path: req.url, method: req.method, token: req.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks)),
    }));
  }), t);
  const frontend = 'http://localhost:5173';
  const gateway = await listen(createServer(createGateway({ upstream, frontend })), t);
  const response = await fetch(`${gateway}/api/sessions?x=1`, {
    method: 'POST', headers: { Origin: frontend, Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation: 'subtraction' }),
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('access-control-allow-origin'), frontend);
  assert.deepEqual(await response.json(), {
    path: '/api/sessions?x=1', method: 'POST', token: 'Bearer test', body: { operation: 'subtraction' },
  });
  const preflight = await fetch(`${gateway}/api/sessions`, { method: 'OPTIONS', headers: { Origin: frontend } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  const denied = await fetch(`${gateway}/api/sessions`, { headers: { Origin: 'https://other.example' } });
  assert.equal(denied.status, 403);
});
