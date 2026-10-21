// End to end, FD-78 (SCN-071, SCN-072, SCN-073): three agents made here as loopback servers, unmanaged. Ads uses the
// communicator (declared), which uses a relay that has stopped answering; ads also reports a connector and a store,
// one of them failing. The Connections tab draws the chain and the worst state in it; the communicator, which offers
// no dashboard, is listed under Services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { CONNECTIONS_EXTENSION } from '@passioncode-ai/fabric-service-host/connections';
import { tmp } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

interface Fake { id: string; name: string; dashboard: boolean; mcp?: string[]; degraded?: { source: string; reason: string }[]; connections?: unknown[] }

async function agent(f: Fake, services: string, base: string): Promise<http.Server> {
  const tokenFile = path.join(base, `${f.id}.token`);
  fs.writeFileSync(tokenFile, `token-${f.id}-0123456789abcdef`, { mode: 0o600 });
  const server = http.createServer((req, res) => {
    const json = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/.well-known/fabric-service') {
      return json(200, {
        protocol: 'fabric-service/0.1', service: { id: f.id, instance: 'default', name: f.name, version: '0.1.0', build: { commit: '0000000' } },
        process: { pid: process.pid, startedAt: new Date(Date.now() - 60_000).toISOString() }, status: f.degraded?.length ? 'degraded' : 'ready', degraded: f.degraded ?? [],
        surfaces: { events: { path: '/fabric/v1/events' }, ...(f.dashboard ? { dashboard: { path: '/', login: false } } : {}), ...(f.mcp ? { mcp: { path: '/mcp', transport: 'streamable-http', capabilities: f.mcp } } : {}) },
        update: { available: null },
        ...(f.connections ? { extensions: { [CONNECTIONS_EXTENSION]: { connections: f.connections } } } : {}),
      });
    }
    if (req.url?.startsWith('/fabric/v1/events')) return json(200, { events: [], cursor: null });
    if (req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>x</title><p>dashboard'); }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  fs.writeFileSync(path.join(services, `${f.id}.default.json`), JSON.stringify({
    protocol: 'fabric-service/0.1', id: f.id, instance: 'default', name: f.name, origin: `http://127.0.0.1:${port}`,
    auth: { tokenFile }, lifecycle: { manager: 'none' }, paths: { data: base, logs: [] },
    installedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), installedBy: 'connections e2e',
  }));
  return server;
}

test('FD-78: Connections draws the chain and the worst state in it; a service without a dashboard is listed under Services', { timeout: 120_000 }, async () => {
  const base = tmp('fd-e2e-conn-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services, { recursive: true });
  const servers = [
    await agent({ id: 'ads', name: 'Ads Manager', dashboard: true, mcp: ['ads.report'], degraded: [{ source: 'google-ads', reason: 'quota exhausted until 12:00' }], connections: [
      { id: 'notify', kind: 'service', target: 'communicator', capability: 'communicator.notify', purpose: 'tells the operator about failures', state: 'ok', lastAt: new Date().toISOString() },
      { id: 'google-ads', kind: 'connector', target: 'google-ads', label: 'Google Ads API', state: 'ok' },
      { id: 'db', kind: 'store', target: 'postgres', state: 'ok' },
    ] }, services, base),
    await agent({ id: 'communicator', name: 'Communicator', dashboard: false, mcp: ['communicator.notify'], connections: [
      { id: 'relay', kind: 'service', target: 'relay.default', state: 'ok' },
      { id: 'telegram', kind: 'channel', target: 'telegram', label: 'Telegram', state: 'ok' },
    ] }, services, base),
  ];
  // The relay is registered and does not answer: a descriptor whose port nothing listens on.
  const deadPort = await new Promise<number>((r) => { const s = http.createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as AddressInfo).port; s.close(() => r(p)); }); });
  fs.writeFileSync(path.join(base, 'relay.token'), 'token-relay-0123456789abcdef', { mode: 0o600 });
  fs.writeFileSync(path.join(services, 'relay.default.json'), JSON.stringify({
    protocol: 'fabric-service/0.1', id: 'relay', instance: 'default', name: 'Relay', origin: `http://127.0.0.1:${deadPort}`,
    auth: { tokenFile: path.join(base, 'relay.token') }, lifecycle: { manager: 'none' }, paths: { data: base, logs: [] },
    installedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), installedBy: 'connections e2e',
  }));
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 }).catch(() => undefined);
    await page.getByRole('button', { name: /Ads Manager — / }).first().waitFor({ timeout: 30_000 });
    // SCN-071: the communicator answers and offers no dashboard: a service.
    await page.locator('[role="group"]', { has: page.locator('.nav-section', { hasText: 'Services' }) }).getByText('Communicator').waitFor({ timeout: 20_000 });

    await page.locator('.nav-row').filter({ hasText: 'Ads Manager' }).locator('.nav-item').click();
    await page.getByRole('tab', { name: 'Connections' }).click();
    const conn = page.locator('.conn');
    await conn.getByText('Communicator', { exact: true }).waitFor({ timeout: 20_000 });
    // The relay does not answer: the chain through the communicator reaches it and the summary reads the worst.
    await conn.locator('.conn-tree .conn-tree .conn-label', { hasText: 'Relay' }).first().waitFor({ timeout: 40_000 });
    await conn.locator('.conn-summary').getByText('Does not work').waitFor({ timeout: 40_000 });
    assert.match(await conn.locator('.conn-node', { hasText: 'Google Ads API' }).innerText(), /quota exhausted/, 'a failing part a declaration names marks that connection');
    await conn.getByText('ads.report').waitFor();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '27-connections-chain.png') });

    // A connected agent opens on its own Connections tab, where Ads Manager is listed under Used by.
    await conn.getByRole('button', { name: /Communicator/ }).first().click();
    await page.getByRole('heading', { level: 1, name: 'Communicator' }).waitFor();
    await page.locator('.conn').getByRole('button', { name: /Ads Manager/ }).waitFor();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '28-connections-used-by.png') });

    // FD-81 SCN-074: the Connections page draws the map left to right and the auditor lists what to fix, by agent.
    await page.getByRole('button', { name: /^Connections/ }).first().click();
    await page.getByRole('heading', { level: 1, name: 'Connections' }).waitFor();
    await page.locator('.cmap-graph svg').waitFor();
    assert.equal(await page.locator('.cmap-graph .edge').count(), 2, 'ads → communicator → relay');
    await page.locator('.cmap-summary').getByText('Does not work').waitFor();
    await page.getByText('Agents that declare their connections: 2 of 3.').waitFor();
    const group = page.locator('.audit-group', { hasText: 'Ads Manager' });
    await group.getByText(/Google Ads API|google-ads fails/).first().waitFor();
    await page.locator('.audit-group', { hasText: 'Communicator' }).getByText('It relies on Relay, which does not answer.').waitFor();
    assert.equal(await page.locator('.audit-group', { hasText: 'Communicator' }).getByRole('button', { name: 'Fix with agent' }).count(), 0, 'a chain finding is fixed where the cause is');
    assert.equal(await page.locator('.audit-group', { hasText: 'Relay' }).getByRole('button', { name: 'Fix with agent' }).count(), 1);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '29-connections-map.png') });
    // The nav carries what does not work.
    assert.match(await page.locator('.nav-item', { hasText: 'Connections' }).innerText(), /\d/);
  } finally {
    await closeApp(app);
    for (const s of servers) await new Promise<void>((r) => s.close(() => r()));
  }
});
