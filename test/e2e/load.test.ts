// End to end, FD-93 (SCN-076): two agents made here as loopback servers, unmanaged. Writer declares its load
// (DEC-0104) and serves a report under its token: two contexts, a queue against its limit, a failure. Reader declares
// it wrongly (FAC-SEM-133). The Load tab reads the first and reports the second; an agent that declares nothing has no
// Load tab.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { LOAD_EXTENSION } from '@passioncode-ai/fabric-service-host/load';
import { tmp } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** A report of the last six hours: the latest window has 3 waiting and 4 running in personal, 1 running in an org. */
function report(): unknown {
  const hour = 3_600_000;
  const now = Date.now();
  const first = Math.floor(now / hour) * hour - 5 * hour;
  const windows = Array.from({ length: 6 }, (_, i) => ({
    start: iso(first + i * hour),
    byContext: [
      { context: 'personal', queued: i === 5 ? 3 : 0, running: i === 5 ? 4 : 1, completed: 5 + i, failed: i === 2 ? 1 : 0, waitMs: { p50: 40, p95: 900 }, runMs: { p50: 8000, p95: 31000 } },
      ...(i >= 3 ? [{ context: 'org:org_e2e', queued: 0, running: 1, completed: 2, failed: 0 }] : []),
    ],
  }));
  return { type: 'service-load/1', generatedAt: iso(now), windowSeconds: 3600, windows };
}

interface Fake { id: string; name: string; load?: unknown; declares?: () => boolean }

async function agent(f: Fake, services: string, base: string, seen: string[]): Promise<http.Server> {
  const token = `token-${f.id}-0123456789abcdef`;
  const tokenFile = path.join(base, `${f.id}.token`);
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  const server = http.createServer((req, res) => {
    const json = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/.well-known/fabric-service') {
      return json(200, {
        protocol: 'fabric-service/0.1', service: { id: f.id, instance: 'default', name: f.name, version: '0.1.0', build: { commit: '0000000' } },
        process: { pid: process.pid, startedAt: new Date(Date.now() - 60_000).toISOString() }, status: 'ready', degraded: [],
        surfaces: { events: { path: '/fabric/v1/events' } }, update: { available: null },
        ...(f.load === undefined || (f.declares && !f.declares()) ? {} : { extensions: { [LOAD_EXTENSION]: f.load } }),
      });
    }
    if (req.url?.startsWith('/fabric/v1/events')) return json(200, { events: [], cursor: null });
    if (req.url === '/fabric/v1/load') {
      seen.push(`${f.id} ${req.headers.authorization === `Bearer ${token}` ? 'token' : 'no-token'}`);
      return req.headers.authorization === `Bearer ${token}` ? json(200, report()) : json(401, {});
    }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  fs.writeFileSync(path.join(services, `${f.id}.default.json`), JSON.stringify({
    protocol: 'fabric-service/0.1', id: f.id, instance: 'default', name: f.name, origin: `http://127.0.0.1:${port}`,
    auth: { tokenFile }, lifecycle: { manager: 'none' }, paths: { data: base, logs: [] },
    installedAt: iso(Date.now()), installedBy: 'load e2e',
  }));
  return server;
}

test('FD-93: the Load tab shows the queue and its limits, by context; a wrong declaration is reported; it never leaves an empty pane', { timeout: 120_000 }, async () => {
  const base = tmp('fd-e2e-load-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services, { recursive: true });
  const seen: string[] = [];
  let writerDeclares = true;
  const servers = [
    await agent({ id: 'writer', name: 'Writer', declares: () => writerDeclares, load: { path: '/fabric/v1/load', windowSeconds: 3600, limits: { concurrency: 4, perCaller: 2, queueMax: 3 } } }, services, base, seen),
    await agent({ id: 'reader', name: 'Reader', load: { path: 'load', windowSeconds: 5, limits: { concurrency: 0, perCaller: 1, queueMax: 1 } } }, services, base, seen),
    await agent({ id: 'quiet', name: 'Quiet' }, services, base, seen),
  ];
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 }).catch(() => undefined);
    const openAgent = async (name: string) => {
      await page.locator('.nav-item', { hasText: name }).first().waitFor({ timeout: 30_000 });
      await page.locator('.nav-item', { hasText: name }).first().click();
      await page.getByRole('heading', { level: 1, name }).waitFor({ timeout: 20_000 });
    };

    await openAgent('Writer');
    await page.getByRole('tab', { name: 'Load' }).waitFor({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'Load' }).click();
    const load = page.locator('.load');
    const strip = load.locator('.load-strip');
    await strip.waitFor({ timeout: 20_000 });
    // The latest window: 4 + 1 running, 3 waiting. DEC-0104's limits are per agent and context and the report sums every
    // agent the service hosts, so no count is set against a limit (no "of N", no at-limit mark); waiting reads as work
    // to watch, a failure as trouble.
    assert.match(await strip.locator('.cell', { hasText: 'Running now' }).innerText(), /^5\s+Running now$/);
    assert.match(await strip.locator('.cell', { hasText: 'Waiting' }).innerText(), /^3\s+Waiting$/);
    assert.equal(await strip.locator('.cell.attn', { hasText: 'Waiting' }).count(), 1);
    assert.equal(await strip.locator('.cell.attn', { hasText: 'Running now' }).count(), 0, 'running is never marked against a limit');
    assert.match(await strip.locator('.cell', { hasText: 'Failed in 24 h' }).innerText(), /^1/);
    await load.getByText('Each agent it hosts runs at most 4 at once in each context and 2 for one caller; 3 more may wait.').waitFor();
    // Two contexts: the times belong to their rows, never to the agent as a whole.
    assert.equal(await load.getByText(/Wait in the queue/).count(), 0);
    assert.match(await load.locator('table.load-contexts tr', { hasText: 'Personal' }).innerText(), /900 ms[\s\S]*31 s/);
    await load.locator('.load-chart svg').waitFor();
    await load.locator('table.load-contexts').getByRole('rowheader', { name: 'Organization org_e2e' }).waitFor();
    assert.match(await load.locator('table.load-contexts tr', { hasText: 'Organization org_e2e' }).innerText(), /not measured/, 'no bare dash for a time never measured');
    assert.ok(seen.includes('writer token'), 'read with the descriptor token');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '30-load.png') });
    // LC-08: a hidden window reads nothing, the last read is answered.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.hide());
    const reads = seen.length;
    await page.evaluate(() => (window as unknown as { fabric: { load(key: string): Promise<unknown> } }).fabric.load('writer.default'));
    assert.equal(seen.length, reads, 'a hidden window reads no load report');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.show());
    // FD-93 review: the declaration goes (the agent stops answering, or drops the key): the page falls back to a tab
    // that exists, never an empty pane.
    writerDeclares = false;
    await page.getByRole('tab', { name: 'Load' }).waitFor({ state: 'detached', timeout: 30_000 });
    await page.getByRole('tab', { name: 'Health', selected: true }).waitFor({ timeout: 10_000 });
    writerDeclares = true;

    await openAgent('Reader');
    await page.getByRole('tab', { name: 'Load' }).click();
    await page.locator('.load .notice.warning').getByText('This agent declares its load wrongly, so it is not read').waitFor({ timeout: 20_000 });
    await page.locator('.load-errors').getByText(/^\/path/).waitFor();
    assert.ok(!seen.some((x) => x.startsWith('reader')), 'a wrong declaration is never read');

    await openAgent('Quiet');
    assert.equal(await page.getByRole('tab', { name: 'Load' }).count(), 0, 'no load declared: no Load tab');
  } finally {
    await closeApp(app);
    for (const s of servers) await new Promise<void>((r) => s.close(() => r()));
  }
});
