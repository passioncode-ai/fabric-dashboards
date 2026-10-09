// End to end, DEC-0019: an ONLINE service (https origin, no launchd) in the real app. The service
// is a small TLS server made here with a certificate for agent.example.com; the unpackaged app is
// told — through FD_TEST_REMOTE, honoured only when not packaged — to dial 127.0.0.1 for that name
// and to trust exactly that certificate. Covers SCN-030, SCN-031, SCN-032.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { tmp } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const haveOpenssl = spawnSync('openssl', ['version']).status === 0;

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

function onlineService(cert: string, key: string, state: { token: string }) {
  const codes = new Map<string, boolean>();
  const sessions = new Set<string>();
  const server = https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, (req, res) => {
    const url = new URL(req.url ?? '/', 'https://agent.example.com');
    const authed = req.headers.authorization === `Bearer ${state.token}`;
    const json = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/.well-known/fabric-service') {
      if (!authed) { res.writeHead(401); res.end(); return; }
      return json(200, {
        protocol: 'fabric-service/0.1', service: { id: 'example-agent', instance: 'default', name: 'Example Online Agent', version: '0.1.0', build: { commit: '0000000' } },
        process: { pid: 7777, startedAt: new Date().toISOString() }, status: 'ready', degraded: [],
        summary: [{ label: 'Jobs today', value: 3 }],
        surfaces: { dashboard: { path: '/', login: true }, events: { path: '/fabric/v1/events' } }, update: { available: null },
      });
    }
    if (url.pathname === '/fabric/v1/events') return authed ? json(200, { events: [], cursor: null }) : (res.writeHead(401), res.end());
    if (url.pathname === '/fabric/v1/login-code' && req.method === 'POST') {
      if (!authed) { res.writeHead(401); res.end(); return; }
      const code = crypto.randomBytes(24).toString('base64url');
      codes.set(code, false);
      return json(200, { url: `/fabric/v1/login?code=${code}`, expiresAt: new Date(Date.now() + 120_000).toISOString().replace(/\.\d{3}Z$/, 'Z') });
    }
    if (url.pathname === '/fabric/v1/login') {
      const code = url.searchParams.get('code') ?? '';
      if (codes.get(code) !== false) { res.writeHead(403); res.end('expired'); return; }
      codes.set(code, true);
      const session = crypto.randomBytes(18).toString('base64url');
      sessions.add(session);
      res.writeHead(302, { Location: '/', 'Set-Cookie': `__Host-fabric_session=${session}; Path=/; Secure; HttpOnly; SameSite=Strict` });
      res.end();
      return;
    }
    if (url.pathname === '/') {
      const cookie = /__Host-fabric_session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
      if (!cookie || !sessions.has(cookie)) { res.writeHead(401, { 'Content-Type': 'text/plain' }); res.end('Sign in from Fabric Dashboards.'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>Online</title><h1>Online dashboard signed in</h1>');
      return;
    }
    res.writeHead(404); res.end();
  });
  return server;
}

test('an online service sits in the Online group, opens signed in over https, and says why when it refuses the token', { skip: !haveOpenssl && 'openssl not available' }, async () => {
  const base = tmp('fd-e2e-remote-');
  const cert = path.join(base, 'cert.pem'), key = path.join(base, 'key.pem');
  const gen = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=agent.example.com',
    '-addext', 'subjectAltName=DNS:agent.example.com', '-keyout', key, '-out', cert], { encoding: 'utf8' });
  assert.equal(gen.status, 0, gen.stderr);
  const state = { token: 'e'.repeat(40) };
  const server = onlineService(cert, key, state);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const origin = `https://agent.example.com:${port}`;
  const services = path.join(base, 'services');
  const tokenFile = path.join(base, 'tokens', 'example-agent.default.token');
  fs.mkdirSync(services, { recursive: true });
  fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
  fs.writeFileSync(tokenFile, state.token, { mode: 0o600 });
  fs.writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify({
    protocol: 'fabric-service/0.1', id: 'example-agent', instance: 'default', name: 'Example Online Agent', placement: 'remote', origin,
    auth: { tokenFile }, lifecycle: { manager: 'none' }, installedAt: '2026-10-02T18:00:00Z', installedBy: 'e2e',
  }), { mode: 0o600 });
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({
      args: [ROOT],
      env: {
        ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8',
        FD_TEST_REMOTE: JSON.stringify({ name: 'agent.example.com', connect: `127.0.0.1:${port}`, caFile: cert }),
        FD_TEST_REMOTE_MS: '5000', // the 60 s online cadence, shortened: the refusal below no longer waits on a minute of wall clock
      },
    });
    const page = await app.firstWindow();
    const card = page.getByRole('button', { name: /Example Online Agent — Ready/ });
    await card.waitFor({ timeout: 30_000 });
    const group = page.getByRole('region', { name: 'Online' });
    await group.waitFor();
    assert.equal(await group.getByRole('button', { name: /Example Online Agent/ }).count(), 1, 'the card is in the Online group (SCN-030)');
    await page.getByText(`online · agent.example.com:${port}`).waitFor();

    await card.click();
    await page.getByRole('heading', { name: 'Example Online Agent' }).waitFor();
    await page.getByRole('button', { name: 'Show details' }).click(); // ADR-0017: the controls live in the full card
    await page.getByRole('button', { name: 'Hide details' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Restart' }).count(), 0, 'no lifecycle control for an online service');
    await page.getByRole('button', { name: 'Hide details' }).click();
    const embedded = async () => app!.evaluate(({ webContents }, o) =>
      webContents.getAllWebContents().filter((wc) => wc.getURL().startsWith(o)).map((wc) => ({ id: wc.id, url: wc.getURL(), loading: wc.isLoading() })), origin);
    let views = await embedded();
    for (let i = 0; i < 75 && (!views.length || views.some((v) => v.loading) || !views[0]!.url.endsWith('/')); i += 1) {
      await new Promise((r) => setTimeout(r, 200));
      views = await embedded();
    }
    assert.equal(views.length, 1, JSON.stringify(views));
    assert.equal(views[0]!.url, `${origin}/`, 'the login code was redeemed over https (SCN-031)');
    const text = await app.evaluate(async ({ webContents }, id) => webContents.fromId(id)!.executeJavaScript('document.body.innerText'), views[0]!.id);
    assert.match(text, /Online dashboard signed in/);
    const urls = await app.evaluate(({ webContents }) => webContents.getAllWebContents().map((wc) => wc.getURL()));
    assert.ok(urls.every((u) => !u.includes(state.token)), 'no URL carries the service token');

    state.token = 'f'.repeat(40); // the platform rotated the token; this computer still has the old one
    await page.getByRole('button', { name: 'Overview' }).click();
    // LC-08: an online service is probed once a minute even with the window visible (AGENTS.md →
    // Lifecycle); FD_TEST_REMOTE_MS makes it 5 s here, so the refusal shows within one interval plus
    // the 8 s remote probe timeout, with room for a machine that is slow or just woke (FD-38).
    await page.getByRole('button', { name: /Example Online Agent — Not answering/ }).waitFor({ timeout: 45_000 });
    await page.getByText(/refused the token/).first().waitFor({ timeout: 10_000 });
  } finally {
    await closeApp(app);
    await new Promise<void>((r) => server.close(() => r()));
  }
});
