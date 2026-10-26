// End to end, FD-02: discovery scenarios walked on a real Electron — SCN-002 (no service yet), SCN-003 (a
// service installed and removed while the app runs) and SCN-004 (an invalid descriptor, U-16's settle).
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

const activityText = (appDir: string) => { try { return fs.readFileSync(path.join(appDir, 'activity.jsonl'), 'utf8'); } catch { return ''; } };

test('SCN-002, SCN-003, SCN-004: an empty folder explains itself; installs, removals and a broken descriptor show up while the app runs', async () => {
  const base = tmp('fd-e2e-disc-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'data');
  const appDir = path.join(base, 'app');
  fs.mkdirSync(services); fs.mkdirSync(data);
  let app: ElectronApplication | null = null;
  const port = await freePort();
  const proc = serve(port, data, ['--name', 'Sample Service']);
  try {
    await waitAnswering(port);
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: appDir, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();

    // SCN-002: no service yet — the empty state says what makes one appear, and where.
    await page.getByText('No agents yet').first().waitFor({ timeout: 20_000 });
    await page.getByText('A service appears here when its installer writes a descriptor').first().waitFor();
    await page.getByRole('button', { name: 'Show folder' }).first().waitFor();

    // SCN-003: an installer writes a descriptor — the service appears within seconds, and Activity says so.
    register(port, data, services);
    await page.getByRole('button', { name: /Sample Service: Ready/ }).first().waitFor({ timeout: 20_000 });
    for (let i = 0; i < 40 && !/was installed/.test(activityText(appDir)); i += 1) await new Promise((r) => setTimeout(r, 250));
    assert.match(activityText(appDir), /was installed/, 'Activity gains "<Service> was installed"');

    // SCN-004: a broken descriptor is shown as Invalid with its first problem, once it stays broken (U-16).
    fs.writeFileSync(path.join(services, 'broken.default.json'), JSON.stringify({ protocol: 'fabric-service/0.1', id: 'broken', instance: 'default', name: 'Broken', origin: 'http://192.168.1.5:80', auth: { tokenFile: '~/t' }, lifecycle: { manager: 'none' }, paths: { data: '~/b', logs: [] }, installedAt: '2026-10-13T00:00:00Z', installedBy: 'test' }));
    await page.getByText('origin must be http://127.0.0.1:<port>').first().waitFor({ timeout: 20_000 });
    await page.getByText('Invalid').first().waitFor();

    // SCN-003: the uninstaller removes the descriptor — the service leaves the list, and Activity says so.
    const sample = fs.readdirSync(services).find((n) => n !== 'broken.default.json')!;
    fs.rmSync(path.join(services, sample));
    for (let i = 0; i < 80; i += 1) {
      if (await page.getByRole('button', { name: /Sample Service: Ready/ }).count() === 0) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.equal(await page.getByRole('button', { name: /Sample Service: Ready/ }).count(), 0, 'the removed service left the list');
    for (let i = 0; i < 40 && !/was removed/.test(activityText(appDir)); i += 1) await new Promise((r) => setTimeout(r, 250));
    assert.match(activityText(appDir), /was removed/, 'Activity gains "<Service> was removed"');
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
