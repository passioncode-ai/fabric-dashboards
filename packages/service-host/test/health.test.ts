// One health probe: GET /.well-known/fabric-service on the service's own loopback origin.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkWellKnown, fetchWellKnown, request, tokenFileProblem, windowsAclProblem, windowsAclRefusal, windowsPowerShellEnv } from '../src/health';

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
  const own = { owner: user, aces: [{ sid: user, type: 'Allow', mask: 2032127 }, { sid: 'S-1-5-18', type: 'Allow', mask: 2032127 }, { sid: 'S-1-5-32-544', type: 'Allow', mask: 2032127 }] };
  assert.equal(windowsAclProblem(own, user), null);
  assert.equal(windowsAclProblem({ ...own, aces: [...own.aces, { sid: 'S-1-1-0', type: 'Deny', mask: 1179785 }] }, user), null, 'a deny ACE does not decide');
  assert.match(windowsAclProblem({ ...own, aces: [...own.aces, { sid: 'S-1-1-0', type: 'Allow', mask: 1179785 }] }, user) ?? '', /S-1-1-0/);
  assert.match(windowsAclProblem({ ...own, aces: [...own.aces, { sid: 'S-1-5-32-545', type: 'Allow', mask: 1179785 }] }, user) ?? '', /S-1-5-32-545/);
  assert.match(windowsAclProblem({ ...own, owner: 'S-1-5-21-9-9-9-1002' }, user) ?? '', /owned by S-1-5-21-9-9-9-1002/);
  assert.equal(windowsAclProblem({ ...own, owner: 'S-1-5-32-544' }, user), null, 'an elevated administrator\'s file is owned by Administrators');
  assert.equal(windowsAclProblem({ ...own, aces: [...own.aces, { sid: 'S-1-5-11', type: 'Allow', mask: 0 }] }, user), null, 'an ACE that grants nothing is no grant');
});

// CT-21 / DEC-0057: the contract's vectors (fixtures/vectors/windows-token.json, vendored byte-identical). The ACL
// cases run through windowsAclRefusal; the file cases (reparse point, outside the profile) through tokenFileProblem,
// and "not a regular file" is refused by the read itself (EISDIR), which no vector can stand in for.
const WINDOWS_TOKEN = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../test/fixtures/contract/vectors_windows-token.json'), 'utf8'));
test('DEC-0057: every windows-token vector of the contract gets the contract\'s answer', () => {
  const home = 'C:\\Users\\me';
  const opts = { platform: 'win32' as NodeJS.Platform, uid: undefined, home };
  let ran = 0;
  for (const c of WINDOWS_TOKEN.cases) {
    const f = c.file;
    if (f.isReparsePoint || !f.realPathInProfile) {
      const where = f.realPathInProfile ? `${home}\\token` : 'C:\\ProgramData\\agent\\token';
      assert.ok(tokenFileProblem(where, { symlink: f.isReparsePoint, uid: 0, mode: 0 }, opts), c.name);
      ran++;
      continue;
    }
    if (!f.isRegularFile) continue;
    const got = windowsAclRefusal({ owner: f.ownerSid, aces: f.aces }, WINDOWS_TOKEN.currentUserSid);
    assert.equal(got ? got.problem : null, c.problem, c.name);
    ran++;
  }
  assert.ok(ran >= WINDOWS_TOKEN.cases.length - 1, `ran ${ran} of ${WINDOWS_TOKEN.cases.length}`);
});

test('DEC-0057: GENERIC_READ for Everyone is refused once the mask is read unsigned', () => {
  const user = 'S-1-5-21-1-2-3-1001';
  const genericRead = 0x80000000;
  assert.match(windowsAclProblem({ owner: user, aces: [{ sid: user, type: 'Allow', mask: 2032127 }, { sid: 'S-1-1-0', type: 'Allow', mask: genericRead }] }, user) ?? '', /S-1-1-0/);
  assert.match(windowsAclProblem({ owner: user, aces: [{ sid: 'S-1-1-0', type: 'Allow', mask: -2147483648 }] }, user) ?? '', /mask is unreadable/, 'a signed mask is refused, never skipped');
  assert.match(windowsAclProblem({ owner: user, aces: [{ sid: user, type: 'AllowCallback', mask: 2032127 }] }, user) ?? '', /type the reader does not read/);
  assert.equal(windowsAclProblem({ owner: user.toLowerCase(), aces: [{ sid: user, type: 'Allow', mask: 2032127 }] }, user), null, 'SIDs compare case-insensitively');
});

test('FD-37: Windows PowerShell 5.1 runs without the PSModulePath a parent PowerShell 7 set, in any spelling', () => {
  const env = windowsPowerShellEnv({ Path: 'C:\\Windows', PSModulePath: 'C:\\Program Files\\PowerShell\\7\\Modules', psmodulepath: 'x', USERPROFILE: 'C:\\Users\\me' });
  assert.deepEqual(env, { Path: 'C:\\Windows', USERPROFILE: 'C:\\Users\\me' });
});

// ── FD-94: the compiled ACL reader (build/win/acl.cs), on Windows ──────────────────────────────

test('FD-94: the compiled reader and Windows PowerShell give one verdict; a reader that fails falls back to PowerShell', { skip: process.platform !== 'win32' && 'Windows only' }, async (t) => {
  const { windowsAclReader } = await import('../../../test/win-acl');
  const { readTokenAsync, setWindowsAclReader } = await import('../src/health');
  const { execFileSync } = await import('node:child_process');
  const reader = windowsAclReader();
  assert.ok(reader, 'csc.exe builds the reader on every Windows runner');
  t.after(() => setWindowsAclReader(null));
  const dir = fs.mkdtempSync(path.join(os.homedir(), '.fd-acl-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const token = path.join(dir, 'token');
  fs.writeFileSync(token, 'r'.repeat(32));
  setWindowsAclReader(reader);
  const started = Date.now();
  assert.equal(await readTokenAsync(token), 'r'.repeat(32));
  const viaReader = Date.now() - started;
  execFileSync('icacls', [token, '/grant', '*S-1-1-0:R'], { stdio: 'ignore' });
  setWindowsAclReader(reader); // a fresh read: an ACL change need not move the file's times
  await assert.rejects(readTokenAsync(token), /S-1-1-0/, 'the reader sees Everyone');
  setWindowsAclReader(null);
  await assert.rejects(readTokenAsync(token), /S-1-1-0/, 'and so does Windows PowerShell');
  setWindowsAclReader(path.join(dir, 'missing.exe'));
  await assert.rejects(readTokenAsync(token), /S-1-1-0/, 'a reader that does not start is never trusted: PowerShell reads it');
  t.diagnostic(`reader read the token in ${viaReader} ms`);
});
