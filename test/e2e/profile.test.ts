// End to end, FD-02 / FD-46: SCN-068 walked on a real Electron — an agent that declares its runner and model
// profile (DEC-0046) shows it on Health with its spend by model, and Change in Fabric.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, tmp } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const fixture = (n: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/contract', n), 'utf8'));

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

test('SCN-068: Health shows the runner and model profile, spend by model, and Change in Fabric', { timeout: 120_000, skip: process.platform === 'win32' && 'POSIX token-file mode' }, async () => {
  const base = tmp('fd-e2e-profile-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const token = 'tok-profile-0123456789abcdef';
  const tokenFile = path.join(base, 'service.token');
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  const port = await freePort();
  const wk = { ...fixture('positive_service-well-known.json'), status: 'ready', degraded: [], process: { pid: process.pid, startedAt: new Date().toISOString() },
    surfaces: { ...fixture('positive_service-well-known.json').surfaces, usage: { path: '/fabric/v1/usage' } },
    configuration: { slots: ['runner', 'model'], resolved: { from: 'agent', runnerKind: 'claude-code', route: 'subscription', modelProfile: 'balanced', models: ['claude-sonnet-5-5'] } } };
  const usage = { ...fixture('positive_service-usage-budgets.json') };
  const today = new Date().toISOString().slice(0, 10);
  const n = usage.days.length; // keep the days in order, the last one today: the report runs forward
  usage.days = usage.days.map((d: { date: string }, i: number) => ({ ...d, date: new Date(Date.parse(today) - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10) }));
  usage.generatedAt = new Date().toISOString();
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/.well-known/fabric-service')) { res.writeHead(200, { 'content-type': 'application/json' }); return void res.end(JSON.stringify(wk)); }
    if (req.url?.startsWith('/fabric/v1/usage')) {
      if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401); return void res.end(); }
      res.writeHead(200, { 'content-type': 'application/json' }); return void res.end(JSON.stringify(usage));
    }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
  fs.writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify({
    protocol: 'fabric-service/0.1', id: 'example-agent', instance: 'default', name: 'Example Agent', origin: `http://127.0.0.1:${port}`,
    auth: { tokenFile }, lifecycle: { manager: 'none' }, paths: { data: path.join(base, 'data'), logs: [] }, installedAt: '2026-10-13T00:00:00Z', installedBy: 'test',
  }));
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8', FD_TEST_FABRIC: 'present' } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /Example Agent — Ready/ }).first().waitFor({ timeout: 20_000 });
    await page.locator('.nav-item', { hasText: 'Example Agent' }).first().click();
    await page.getByRole('tab', { name: 'Health' }).click();
    await page.getByRole('heading', { name: 'Runner and model' }).waitFor({ timeout: 15_000 });
    await page.getByText(/claude-code · subscription/).first().waitFor();
    await page.getByText(/balanced · claude-sonnet-5-5/).first().waitFor();
    await page.getByText('this agent').first().waitFor();
    await page.getByText(/claude-sonnet-5-5 \$\d+\.\d\d/).first().waitFor({ timeout: 20_000 });
    await page.getByText('Shown here once Project Observatory publishes its budgets').first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Change in Fabric' }).count(), 1);
  } finally {
    await closeApp(app);
    server.close();
  }
});
