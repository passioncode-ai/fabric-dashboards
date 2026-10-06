// One health probe: GET /.well-known/fabric-service on the service's own loopback origin.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { checkWellKnown, fetchWellKnown, request } from '../src/health';

const WELL_KNOWN = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../test/fixtures/contract/positive_service-well-known.json'), 'utf8'));

async function server(handler: http.RequestListener): Promise<{ origin: string; close: () => Promise<void> }> {
  const s = http.createServer(handler);
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  const port = (s.address() as AddressInfo).port;
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((r) => s.close(() => r())) };
}

test('checkWellKnown names the first thing missing', () => {
  assert.equal(checkWellKnown(WELL_KNOWN), null);
  assert.match(checkWellKnown(null)!, /not a JSON object/);
  assert.match(checkWellKnown({ ...WELL_KNOWN, protocol: 'other/1' })!, /protocol/);
  assert.match(checkWellKnown({ ...WELL_KNOWN, service: {} })!, /identity/);
  assert.match(checkWellKnown({ ...WELL_KNOWN, process: {} })!, /pid/);
  assert.match(checkWellKnown({ ...WELL_KNOWN, status: 'fine' })!, /not a protocol status/);
  const { degraded: _d, ...noDegraded } = WELL_KNOWN;
  assert.match(checkWellKnown(noDegraded)!, /degraded is missing/);
  assert.match(checkWellKnown({ ...WELL_KNOWN, surfaces: {} })!, /events/);
});

test('fetchWellKnown: an answer, another program, garbage, silence', async () => {
  let reply: { status: number; body: string } = { status: 200, body: JSON.stringify(WELL_KNOWN) };
  let seen: { path?: string; host?: string } = {};
  const s = await server((req, res) => { seen = { path: req.url, host: req.headers.host }; res.writeHead(reply.status, { 'Content-Type': 'application/json' }); res.end(reply.body); });
  try {
    const ok = await fetchWellKnown(s.origin);
    assert.equal(ok.kind, 'answer');
    assert.equal(ok.kind === 'answer' && ok.doc.service.id, 'example-agent');
    assert.equal(seen.path, '/.well-known/fabric-service');
    assert.equal(seen.host, s.origin.slice('http://'.length));
    reply = { status: 404, body: 'no' };
    assert.deepEqual(await fetchWellKnown(s.origin), { kind: 'not-protocol', detail: 'HTTP 404 on /.well-known/fabric-service' });
    reply = { status: 200, body: '<html>' };
    assert.deepEqual(await fetchWellKnown(s.origin), { kind: 'not-protocol', detail: 'the answer is not JSON' });
    reply = { status: 200, body: JSON.stringify({ ...WELL_KNOWN, degraded: undefined }) };
    assert.deepEqual(await fetchWellKnown(s.origin), { kind: 'not-protocol', detail: 'degraded is missing' });
  } finally {
    await s.close();
  }
  const gone = await fetchWellKnown(s.origin, 500);
  assert.equal(gone.kind, 'no-answer');
});

test('a service that never answers is no-answer within the timeout', async () => {
  const s = await server(() => { /* hold the request open */ });
  try {
    const started = Date.now();
    const r = await fetchWellKnown(s.origin, 300);
    assert.deepEqual(r, { kind: 'no-answer', detail: 'no answer within 300 ms' });
    assert.ok(Date.now() - started < 3000);
  } finally {
    s.close().catch(() => undefined);
  }
});

test('a service that trickles its answer is no-answer at the deadline, not when it pauses (audit MEDIUM-4)', async () => {
  const s = await server((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const tick = setInterval(() => { if (!res.writableEnded) res.write(' '); }, 100); // never idle for 300 ms
    res.on('close', () => clearInterval(tick));
  });
  try {
    const started = Date.now();
    const r = await fetchWellKnown(s.origin, 400);
    assert.deepEqual(r, { kind: 'no-answer', detail: 'no answer within 400 ms' });
    assert.ok(Date.now() - started < 1500, `ended after ${Date.now() - started} ms`);
  } finally {
    s.close().catch(() => undefined);
  }
});

test('request refuses an origin that is not the loopback, and an oversized answer', async () => {
  await assert.rejects(request('http://example.com:80', 'GET', '/'), /not http:\/\/127\.0\.0\.1/);
  const big = Buffer.alloc(2 * 1024 * 1024 + 10, 'x');
  const s = await server((_req, res) => { res.writeHead(200); res.end(big); });
  try {
    await assert.rejects(request(s.origin, 'GET', '/'), /larger than 2 MB/);
  } finally {
    await s.close();
  }
});
