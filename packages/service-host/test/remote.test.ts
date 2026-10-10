// DEC-0019 — the remote placement: an online service at an https origin, read the way a host
// reads it. TLS is real (a certificate made for this run with openssl); only the dial address is
// redirected to 127.0.0.1, while the name, SNI, certificate and Host stay the origin's.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { claimConflicts, placementOf, readDirectory, validateDescriptor } from '../src/descriptor';
import { fetchWellKnown, readToken } from '../src/health';
import { lookAtServices } from '../src/look';
import { UNMANAGED, type LaunchdReader } from '../src/launchd';

const remote = (over: Record<string, unknown> = {}) => ({
  protocol: 'fabric-service/0.1', id: 'example-agent', instance: 'default', name: 'Example Agent', placement: 'remote',
  origin: 'https://agent.example.com', auth: { tokenFile: '~/x/t.token' }, lifecycle: { manager: 'none' },
  installedAt: '2026-10-02T18:00:00Z', installedBy: 'test', ...over,
});

test('a remote descriptor is valid without paths and refuses everything that is not https on a public name', () => {
  assert.deepEqual(validateDescriptor(remote()), []);
  assert.equal(placementOf(remote()), 'remote');
  for (const origin of ['http://agent.example.com', 'https://203.0.113.7', 'https://agent.example.com/x', 'http://127.0.0.1:47300', 'https://agent.localhost']) {
    assert.ok(validateDescriptor(remote({ origin })).length, origin);
  }
  assert.ok(validateDescriptor(remote({ lifecycle: { manager: 'launchd', label: 'a.b.c', plist: '/x.plist' } })).length);
  assert.ok(validateDescriptor(remote({ commands: { update: ['/usr/bin/true'] } })).length);
  const local = { ...remote(), placement: undefined, origin: 'http://127.0.0.1:47300' };
  assert.ok(validateDescriptor(local).includes('missing paths'), 'a local descriptor still needs paths');
});

test('a remote origin claims no port: same number as a local service, no conflict', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-remote-'));
  fs.writeFileSync(path.join(dir, 'maker.default.json'), JSON.stringify({ ...remote({ id: 'maker', placement: undefined, origin: 'http://127.0.0.1:8443' }), paths: { data: path.join(dir, 'm'), logs: [] } }));
  fs.writeFileSync(path.join(dir, 'example-agent.default.json'), JSON.stringify(remote({ origin: 'https://agent.example.com:8443' })));
  const entries = readDirectory(dir);
  assert.equal(entries.filter((e) => e.descriptor).length, 2);
  assert.equal(claimConflicts(entries).size, 0);
});

const haveOpenssl = spawnSync('openssl', ['version']).status === 0;

function makeCert(dir: string): { cert: string; key: string } {
  const cert = path.join(dir, 'cert.pem'), key = path.join(dir, 'key.pem');
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=agent.example.com',
    '-addext', 'subjectAltName=DNS:agent.example.com', '-keyout', key, '-out', cert], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return { cert, key };
}

const TOKEN = 'h'.repeat(40);
const WELL_KNOWN = {
  protocol: 'fabric-service/0.1', service: { id: 'example-agent', instance: 'default', name: 'Example Agent', version: '0.1.0', build: { commit: '0000000' } },
  process: { pid: 4242, startedAt: '2026-10-02T18:00:00Z' }, status: 'ready', degraded: [], surfaces: { events: { path: '/fabric/v1/events' } },
};

async function tlsServer(dir: string, handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const { cert, key } = makeCert(dir);
  const s = https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, handler);
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', () => r()));
  const port = (s.address() as AddressInfo).port;
  return { port, origin: `https://agent.example.com:${port}`, ca: fs.readFileSync(cert), close: () => new Promise<void>((r) => s.close(() => r())) };
}

test('fetchWellKnown over verified TLS: refused without the token, the document with it, never a redirect', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-tls-'));
  const seen: string[] = [];
  const s = await tlsServer(dir, (req, res) => {
    seen.push(String(req.headers.host));
    if (req.url === '/.well-known/fabric-service' && req.headers.authorization === `Bearer ${TOKEN}`) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(WELL_KNOWN)); return; }
    if (req.headers['x-test'] === 'redirect') { res.writeHead(302, { Location: 'https://evil.example.com/' }); res.end(); return; }
    res.writeHead(401); res.end();
  });
  const tls = { ca: s.ca, connect: { host: '127.0.0.1', port: s.port } };
  try {
    assert.deepEqual(await fetchWellKnown(s.origin, 3000, tls), { kind: 'refused', detail: 'HTTP 401 on /.well-known/fabric-service' });
    const ok = await fetchWellKnown(s.origin, 3000, { ...tls, headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.equal(ok.kind, 'answer');
    assert.equal(seen.at(-1), `agent.example.com:${s.port}`, 'Host is the origin, not the dial address');
    const redirect = await fetchWellKnown(s.origin, 3000, { ...tls, headers: { 'x-test': 'redirect' } });
    assert.equal(redirect.kind, 'no-answer');
    assert.equal(redirect.kind === 'no-answer' && redirect.cause, 'redirect');
    const untrusted = await fetchWellKnown(s.origin, 3000, { connect: tls.connect, headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.equal(untrusted.kind === 'no-answer' && untrusted.cause, 'tls', 'a certificate the system store does not trust is TLS, not an answer');
  } finally {
    await s.close();
  }
});

test('one look at a remote service reads its token, probes with it, and is invalid when the token is unreadable', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-look-'));
  const s = await tlsServer(dir, (req, res) => {
    if (req.headers.authorization === `Bearer ${TOKEN}`) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(WELL_KNOWN)); return; }
    res.writeHead(401); res.end();
  });
  const services = path.join(dir, 'services');
  fs.mkdirSync(services);
  const tokenFile = path.join(dir, 'token');
  fs.writeFileSync(tokenFile, TOKEN, { mode: 0o600 });
  fs.writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify(remote({ origin: s.origin, auth: { tokenFile } })));
  const launchd = { status: async () => ({ ...UNMANAGED }), disabledTable: async () => '' } as unknown as LaunchdReader;
  const probe = (origin: string, options?: Parameters<typeof fetchWellKnown>[2]) => fetchWellKnown(origin, 3000, { ...options, ca: s.ca, connect: { host: '127.0.0.1', port: s.port } });
  try {
    const look = await lookAtServices({ servicesDir: services, launchd, wellKnown: probe });
    assert.equal(look.services[0]!.state, 'ready', look.services[0]!.problems.join('; '));
    // POSIX widens the mode; Windows grants Everyone (S-1-1-0) read access — DEC-0032's refusal names it.
    const windows = process.platform === 'win32';
    if (windows) execFileSync('icacls', [tokenFile, '/grant', '*S-1-1-0:R'], { stdio: 'ignore' });
    else fs.chmodSync(tokenFile, 0o644);
    const bad = await lookAtServices({ servicesDir: services, launchd, wellKnown: probe });
    assert.equal(bad.services[0]!.state, 'invalid');
    assert.match(bad.services[0]!.problems.join(' '), windows ? /S-1-1-0/ : /readable by others/);
    assert.equal(bad.services[0]!.probe, null, 'a service whose token cannot be read is never contacted');
    assert.throws(() => readToken(tokenFile), windows ? /S-1-1-0/ : /0600/);
  } finally {
    await s.close();
  }
});
