// End to end, ADR-0013: Spend reads each agent's own usage report (contract DEC-0021) in the real
// app. The agent is a small loopback server made here, unmanaged (no launchd), whose report is the
// contract's positive fixture with today's dates. Covers SCN-036 and SCN-037.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { tmp } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const TOKEN = 'spend-e2e-token-0123456789';

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

function report(): unknown {
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/contract/positive_service-usage.json'), 'utf8'));
  const day = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
  r.service = { id: 'spender', instance: 'default' };
  r.days[0].date = day(1);
  r.days[1].date = day(0);
  return r;
}

test('Spend shows what an agent reported, a lower bound where calls carry no price, and the model breakdown', async () => {
  const base = tmp('fd-e2e-spend-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services, { recursive: true });
  const tokenFile = path.join(base, 'service.token');
  fs.writeFileSync(tokenFile, TOKEN, { mode: 0o600 });
  let usageReads = 0;
  const server = http.createServer((req, res) => {
    const json = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    const authed = req.headers.authorization === `Bearer ${TOKEN}`;
    if (req.url === '/.well-known/fabric-service') {
      return json(200, {
        protocol: 'fabric-service/0.1', service: { id: 'spender', instance: 'default', name: 'Spender', version: '0.1.0', build: { commit: '0000000' } },
        process: { pid: process.pid, startedAt: new Date().toISOString() }, status: 'ready', degraded: [],
        surfaces: { events: { path: '/fabric/v1/events' }, usage: { path: '/fabric/v1/usage' } }, update: { available: null },
      });
    }
    if (req.url?.startsWith('/fabric/v1/events')) return authed ? json(200, { events: [], cursor: null }) : json(401, {});
    if (req.url === '/fabric/v1/usage') { usageReads += 1; return authed ? json(200, report()) : json(401, {}); }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  fs.writeFileSync(path.join(services, 'spender.default.json'), JSON.stringify({
    protocol: 'fabric-service/0.1', id: 'spender', instance: 'default', name: 'Spender', origin: `http://127.0.0.1:${port}`,
    auth: { tokenFile }, lifecycle: { manager: 'none' }, paths: { data: base, logs: [] },
    installedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), installedBy: 'spend e2e',
  }));
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /Spender — Ready/ }).waitFor({ timeout: 30_000 });
    assert.equal(usageReads, 0, 'nothing is read until someone opens Spend (LC-08)');

    await page.getByRole('button', { name: 'Spend', exact: true }).click();
    await page.getByRole('heading', { level: 1, name: 'Spend' }).waitFor();
    const row = page.getByRole('row', { name: /Spender/ });
    await row.waitFor({ timeout: 15_000 });
    const cells = await row.getByRole('cell').allInnerTexts();
    assert.deepEqual(cells.slice(0, 4), ['≥ $0.31', '≥ $1.59', '≥ $1.59', '$1.59 of $100.00 this month'], 'today, 7 and 30 days are lower bounds; the budget is the agent\'s own');
    await page.getByText(/An unknown cost is never counted as \$0/).waitFor();

    await row.getByRole('button', { name: 'Spender', exact: true }).click();
    const models = page.locator('.spend-models');
    await models.getByText('claude-sonnet-5-5').waitFor();
    assert.match(await models.innerText(), /llama-4-8b[\s\S]*unknown/, 'an unpriced model reads unknown, not $0.00');
    assert.ok(usageReads >= 1);
    // LC-08: while the window is hidden, a refresh gets the last sums and reads no service.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.hide());
    const before = usageReads;
    await page.evaluate(() => (window as unknown as { fabric: { spend(): Promise<unknown> } }).fabric.spend());
    assert.equal(usageReads, before, 'a hidden window reads nothing');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.show());
    await page.evaluate(() => (window as unknown as { fabric: { spend(): Promise<unknown> } }).fabric.spend());
    assert.ok(usageReads > before, 'shown again, it reads');
    if (process.env.FD_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.FD_SCREENSHOTS, '20-spend.png') });
  } finally {
    await closeApp(app);
    await new Promise<void>((r) => server.close(() => r()));
  }
});
