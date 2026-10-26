// End to end, FD-02: health scenarios walked on a real Electron — SCN-012 (another program on the port),
// SCN-013 (two services claim one port), SCN-035 (one connection fails while the agent is fine) and SCN-025
// (logs, and doctor run from the page).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

const descriptor = (base: string, id: string, port: number, extra: Record<string, unknown> = {}) => JSON.stringify({
  protocol: 'fabric-service/0.1', id, instance: 'default', name: id.replace(/-/g, ' '), origin: `http://127.0.0.1:${port}`,
  auth: { tokenFile: path.join(base, `${id}.token`) }, lifecycle: { manager: 'none' }, paths: { data: path.join(base, id), logs: [] },
  installedAt: '2026-10-13T00:00:00Z', installedBy: 'test', ...extra,
});

test('SCN-012, SCN-013, SCN-035, SCN-025: wrong program, a port claimed twice, one failing connection, logs and doctor', { timeout: 180_000 }, async () => {
  const base = tmp('fd-e2e-health-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  // SCN-012: a plain web server, no fabric-service protocol, on the port a descriptor names.
  const plain = http.createServer((_q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<p>not a service</p>'); });
  const plainPort = await freePort();
  await new Promise<void>((r) => plain.listen(plainPort, '127.0.0.1', r));
  fs.writeFileSync(path.join(services, 'wrong-program.default.json'), descriptor(base, 'wrong-program', plainPort));
  // SCN-013: two descriptors claim one port.
  const shared = await freePort();
  fs.writeFileSync(path.join(services, 'claims-a.default.json'), descriptor(base, 'claims-a', shared));
  fs.writeFileSync(path.join(services, 'claims-b.default.json'), descriptor(base, 'claims-b', shared));
  // SCN-035 + SCN-025: the sample as two instances; the default declares a log file and a doctor command.
  const [pa, pb] = [await freePort(), await freePort()];
  const da = path.join(base, 'a'); const db = path.join(base, 'b');
  fs.mkdirSync(da); fs.mkdirSync(db);
  const log = path.join(base, 'sample.log');
  fs.writeFileSync(log, 'first line\nthe sample is fine\n');
  const a = serve(pa, da);
  let b = serve(pb, db, ['--instance', 'preview']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(pa); await waitAnswering(pb);
    register(pa, da, services); register(pb, db, services, ['--instance', 'preview']);
    const file = path.join(services, 'sample.default.json');
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...d, paths: { ...d.paths, logs: [log] }, commands: { doctor: ['/bin/echo', 'doctor says all good'] } }));
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();

    // SCN-012
    await page.getByRole('button', { name: /wrong program: Wrong program on port/ }).first().waitFor({ timeout: 30_000 });
    await page.getByText(new RegExp(`Port ${plainPort} answers without fabric-service/0.1`)).first().waitFor();
    // SCN-013
    await page.getByRole('button', { name: /claims a: Port conflict/ }).first().waitFor({ timeout: 30_000 });
    await page.getByText(new RegExp(`Port ${shared} is also claimed by`)).first().waitFor();

    // SCN-035: the preview instance stops answering — the agent stays ready, with a mark on its entry.
    await page.getByRole('button', { name: /Sample Service: Ready/ }).first().waitFor({ timeout: 30_000 });
    await stopProcess(b);
    await page.locator('[title="A connection of this agent needs attention"], [aria-label*="A connection of this agent needs attention"]').first().waitFor({ timeout: 60_000 });
    assert.ok(await page.getByRole('button', { name: /Sample Service: Ready/ }).count() > 0, 'the agent itself still reads Ready');
    b = serve(pb, db, ['--instance', 'preview']);

    // SCN-025: Logs shows the declared file; Doctor runs the declared command and shows its exit and output.
    await page.locator('.nav-item', { hasText: 'Sample Service' }).first().click();
    await page.getByRole('tab', { name: 'Logs' }).click();
    await page.getByText('the sample is fine').first().waitFor({ timeout: 15_000 });
    if (await page.getByRole('button', { name: 'Show details' }).count()) await page.getByRole('button', { name: 'Show details' }).first().click();
    await page.getByRole('button', { name: 'Doctor', exact: true }).first().click();
    await page.getByText('Doctor finished with exit code 0.').first().waitFor({ timeout: 30_000 });
    await page.getByText('doctor says all good').first().waitFor();
  } finally {
    await closeApp(app); await stopProcess(a); await stopProcess(b);
    plain.close();
  }
});
