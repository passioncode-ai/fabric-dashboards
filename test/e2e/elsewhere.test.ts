// End to end, FD-132 (SCN-089): agents this machine's placement record (observatory-placement/1) puts on the other
// machine. One is silent here: it reads as off with the machine named, and its page offers no Start. One answers here
// anyway: it reads as a second copy, and its page offers Stop, never Restart.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const LABEL_OFF = 'ai.passioncode.fabric-dashboards.test.elsewhere-off';
const LABEL_DUP = 'ai.passioncode.fabric-dashboards.test.elsewhere-dup';

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

test('SCN-089: placed on the other machine reads as off there, never down; a copy running here anyway reads as a second copy', { timeout: 180_000 }, async () => {
  const base = tmp('fd-e2e-elsewhere-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const offPort = await freePort();
  fs.writeFileSync(path.join(services, 'elsewhere-off.default.json'), JSON.stringify({
    protocol: 'fabric-service/0.1', id: 'elsewhere-off', instance: 'default', name: 'Elsewhere Off', origin: `http://127.0.0.1:${offPort}`,
    auth: { tokenFile: path.join(base, 'elsewhere-off.token') }, lifecycle: { manager: 'launchd', label: LABEL_OFF, plist: path.join(base, `${LABEL_OFF}.plist`) },
    paths: { data: path.join(base, 'elsewhere-off'), logs: [] }, installedAt: '2026-10-28T00:00:00Z', installedBy: 'test',
  }));
  const port = await freePort();
  const data = path.join(base, 'sample');
  fs.mkdirSync(data);
  const sample = serve(port, data);
  // The placement record, as Observatory writes it: owner only.
  const xdg = path.join(base, 'xdg');
  fs.mkdirSync(path.join(xdg, 'project-observatory'), { recursive: true });
  const record = path.join(xdg, 'project-observatory', 'placement.json');
  fs.writeFileSync(record, JSON.stringify({ schema: 'observatory-placement/1', machine: 'studio-1', updatedAt: '2026-10-28T12:00:00Z', elsewhere: [
    { label: LABEL_OFF, serviceId: 'elsewhere-off.default', placedOn: 'studio-2', since: '2026-10-28T11:00:00Z', by: 'test' },
    { serviceId: 'sample.default', placedOn: 'studio-2', since: '2026-10-28T11:00:00Z', by: 'test' },
  ] }), { mode: 0o600 });
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, data, services);
    const file = path.join(services, 'sample.default.json');
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...d, lifecycle: { manager: 'launchd', label: LABEL_DUP, plist: path.join(base, `${LABEL_DUP}.plist`) } }));
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), XDG_DATA_HOME: xdg, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();

    // Silent here: off, with the machine named; no Start (it would be a second copy), and never "Not answering".
    await page.locator('.nav-item', { hasText: 'Elsewhere Off' }).first().waitFor({ timeout: 30_000 });
    await page.locator('.nav-item', { hasText: 'Elsewhere Off' }).first().click();
    await page.getByText('Placed on the other machine, studio-2: it runs there, so here it stays off.').first().waitFor({ timeout: 30_000 });
    if (await page.getByRole('button', { name: 'Show details' }).count()) await page.getByRole('button', { name: 'Show details' }).first().click();
    assert.equal(await page.getByRole('button', { name: 'Start', exact: true }).count(), 0, 'no Start for an agent placed on the other machine');
    await page.waitForTimeout(20_000); // past the 15 s grace that turns silence into down
    assert.equal(await page.getByText('Not answering').count(), 0);
    await page.getByText('Placed on the other machine, studio-2').first().waitFor();

    // Answering here although placed there: a second copy; Stop, never Restart.
    await page.locator('.nav-item', { hasText: 'Sample Service' }).first().click();
    await page.getByText('Placed on studio-2, yet a copy runs here too. Stop it here to keep one.').first().waitFor({ timeout: 30_000 });
    if (await page.getByRole('button', { name: 'Show details' }).count()) await page.getByRole('button', { name: 'Show details' }).first().click();
    await page.getByRole('button', { name: 'Stop', exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Restart', exact: true }).count(), 0, 'Restart would keep the copy here');
  } finally {
    await closeApp(app);
    await stopProcess(sample);
  }
});
