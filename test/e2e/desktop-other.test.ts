// FD-37 (SCN-052): Fabric Dashboards on Windows and Linux, end to end against the real app on that system's own
// runner (validate.yml, job `e2e-other`). The window carries a File menu with Check for Updates and Quit (Ctrl+Q);
// the services in this computer's services folder are listed as on macOS; a local service's dashboard opens, with
// no Start, Stop or Restart, since launchd supervises it and this system has none (ADR-0019); closing the window
// leaves the app running in the tray. Skipped on macOS, where the rest of the suite walks the same screens.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering, waitFor } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

test('SCN-052: a File menu, the services listed, a dashboard without launchd controls, and the tray after close', { timeout: 180_000, skip: process.platform === 'darwin' && 'macOS has its own walk' }, async () => {
  const base = tmp('fd-e2e-other-');
  const services = path.join(base, 'services');
  const userData = path.join(base, 'app');
  for (const d of [services, userData]) fs.mkdirSync(d, { recursive: true });
  const port = await freePort();
  const proc = serve(port, path.join(base, 'data'), ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, path.join(base, 'data'), services);
    // A CI runner has no SUID sandbox helper; Linux runs Chromium without it here, as the AppImage does unprivileged.
    const args = process.platform === 'linux' ? [ROOT, '--no-sandbox'] : [ROOT];
    app = await electron.launch({ args, env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();

    // Step 1: a File menu holds Check for Updates and Quit with Ctrl+Q; the macOS app menu is not there.
    const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.items.map((m) => ({ label: m.label, role: m.role, items: m.submenu?.items.map((i) => ({ label: i.label, accelerator: i.accelerator ?? null, type: i.type })) ?? [] })));
    const file = menu.find((m) => m.label === 'File');
    assert.ok(file, `a File menu: ${JSON.stringify(menu.map((m) => m.label))}`);
    assert.deepEqual(file!.items.filter((i) => i.type !== 'separator').map((i) => i.label), ['Check for Updates…', 'Quit Fabric Dashboards']);
    assert.match(String(file!.items.find((i) => i.label === 'Quit Fabric Dashboards')!.accelerator), /^(Ctrl|CmdOrCtrl|CommandOrControl)\+Q$/);
    assert.equal(menu.some((m) => m.role === 'appmenu'), false, 'no macOS app menu');

    // The service in this computer's services folder is listed as on macOS.
    await page.getByRole('button', { name: /^Agents/ }).first().waitFor({ timeout: 30_000 });
    await page.getByText('Sample Service').first().waitFor({ timeout: 30_000 });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `52-${process.platform}-list.png`) });

    // Step 3: its dashboard opens, and the service is ready; no launchd control is offered on this system.
    await page.getByText('Sample Service').first().click();
    await page.getByRole('heading', { level: 1, name: 'Sample Service' }).waitFor({ timeout: 20_000 });
    await waitFor('the dashboard view', async () => (await app!.evaluate(({ BrowserWindow }) => (BrowserWindow.getAllWindows()[0]!.contentView as unknown as { children: unknown[] }).children.length)) >= 1, 90_000); // the token's ACL is read first (FD-94)
    for (const name of ['Start', 'Stop', 'Restart']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0, `no ${name} on ${process.platform}`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `52-${process.platform}-service.png`) });

    // Step 2: closing the window hides it; the app keeps running in the tray, and the window can come back.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
    await waitFor('the window hidden, not closed', async () => app!.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return Boolean(w && !w.isDestroyed() && !w.isVisible()); }));
    assert.equal(app.process().exitCode, null, 'the app still runs');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.show());
    await page.getByRole('heading', { level: 1, name: 'Sample Service' }).waitFor({ timeout: 20_000 });
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
