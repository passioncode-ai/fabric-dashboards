// One health probe: GET /.well-known/fabric-service on the service's own loopback origin.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { checkWellKnown, fetchWellKnown, request, tokenFileProblem, windowsAclProblem } from '../src/health';

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

// FD-37: a token file is refused for the same reasons on every OS, by the means each OS has.
test('FD-37: tokenFileProblem — POSIX owner and mode; Windows: no link, inside the profile', () => {
  const posix = { symlink: false, uid: 501, mode: 0o100600 };
  assert.equal(tokenFileProblem('/home/e/t', posix, { platform: 'linux', uid: 501, home: '/home/e' }), null);
  assert.match(tokenFileProblem('/home/e/t', { ...posix, mode: 0o100644 }, { platform: 'linux', uid: 501, home: '/home/e' }) ?? '', /0600/);
  assert.match(tokenFileProblem('/home/e/t', { ...posix, uid: 0 }, { platform: 'darwin', uid: 501, home: '/Users/e' }) ?? '', /another user/);
  assert.match(tokenFileProblem('/home/e/t', { ...posix, symlink: true }, { platform: 'linux', uid: 501, home: '/home/e' }) ?? '', /symlink/);
  // Windows has no POSIX mode or owner in fs.stat (mode reads 0o666): the profile's ACL is the guard.
  const win = { symlink: false, uid: 0, mode: 0o100666 };
  const opts = { platform: 'win32' as const, uid: undefined, home: 'C:\\Users\\e' };
  assert.equal(tokenFileProblem('C:\\Users\\e\\AppData\\Local\\agent\\token', win, opts), null);
  assert.equal(tokenFileProblem('c:\\users\\E\\AppData\\Local\\agent\\token', win, opts), null, 'drive letters and case do not matter on Windows');
  assert.match(tokenFileProblem('C:\\ProgramData\\agent\\token', win, opts) ?? '', /outside your user profile/);
  assert.match(tokenFileProblem('C:\\Users\\everyone\\token', win, opts) ?? '', /outside your user profile/, 'a sibling profile with a shared prefix is outside');
  assert.match(tokenFileProblem('C:\\Users\\e\\token', { ...win, symlink: true }, opts) ?? '', /symlink/);
});

// DEC-0032 (contract service.md, Windows token files): owner = the current user; every ACE that grants
// anything names the user, SYSTEM or Administrators; deny ACEs do not decide; a refusal names the SID.
test('DEC-0032: windowsAclProblem accepts the user, SYSTEM and Administrators, and names any other SID', () => {
  const user = 'S-1-5-21-1-2-3-1001';
  const own = { owner: user, aces: [{ sid: user, type: 'Allow', rights: 2032127 }, { sid: 'S-1-5-18', type: 'Allow', rights: 2032127 }, { sid: 'S-1-5-32-544', type: 'Allow', rights: 2032127 }] };
  assert.equal(windowsAclProblem(own, user), null);
  assert.equal(windowsAclProblem({ ...own, aces: [...own.aces, { sid: 'S-1-1-0', type: 'Deny', rights: 1179785 }] }, user), null, 'a deny ACE does not decide');
  assert.match(windowsAclProblem({ ...own, aces: [...own.aces, { sid: 'S-1-1-0', type: 'Allow', rights: 1179785 }] }, user) ?? '', /S-1-1-0/);
  assert.match(windowsAclProblem({ ...own, aces: [...own.aces, { sid: 'S-1-5-32-545', type: 'Allow', rights: 1179785 }] }, user) ?? '', /S-1-5-32-545/);
  assert.match(windowsAclProblem({ ...own, owner: 'S-1-5-21-9-9-9-1002' }, user) ?? '', /owned by S-1-5-21-9-9-9-1002/);
  assert.equal(windowsAclProblem({ ...own, owner: 'S-1-5-32-544' }, user), null, 'an elevated administrator\'s file is owned by Administrators');
  assert.equal(windowsAclProblem({ ...own, aces: [...own.aces, { sid: 'S-1-5-11', type: 'Allow', rights: 0 }] }, user), null, 'an ACE that grants nothing is no grant');
});
