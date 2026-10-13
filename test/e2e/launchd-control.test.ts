// End to end, FD-02: control scenarios walked on a real Electron against the real launchd — SCN-010 (start a
// stopped service), SCN-007 (restart: a new pid) and SCN-008 (a restart that does not bring it back). One fixed
// test label, as the integration test uses: launchd keeps an enable/disable override per label forever, so a
// label per run would leave one behind per run. Cleaned up the same way.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, register, SAMPLE, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const LABEL = 'ai.passioncode.fabric-dashboards.test.sample';

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

const plistFor = (args: string[], log: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${LABEL}</string>
<key>ProgramArguments</key><array>${args.map((a) => `<string>${a}</string>`).join('')}</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${log}</string><key>StandardErrorPath</key><string>${log}</string>
</dict></plist>`;

test('SCN-010, SCN-007, SCN-008: Start, Restart with a new pid, and a restart that does not come back', { timeout: 240_000, skip: process.platform !== 'darwin' || Boolean(process.env.FD_SKIP_LAUNCHD) }, async () => {
  const base = tmp('fd-e2e-launchd-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'svc');
  fs.mkdirSync(services);
  const port = await freePort();
  const plist = path.join(base, `${LABEL}.plist`);
  const log = path.join(base, 'svc.log');
  // launchd runs a copy of the sample, so SCN-008 can take the program away without touching the fixture.
  const copy = path.join(base, 'sample-service');
  fs.cpSync(path.dirname(SAMPLE), copy, { recursive: true });
  fs.writeFileSync(plist, plistFor(['/usr/bin/python3', path.join(copy, path.basename(SAMPLE)), 'serve', '--port', String(port), '--data-dir', data], log));
  register(port, data, services, ['--label', LABEL, '--plist', plist]);
  const uid = os.userInfo().uid;
  spawnSync('launchctl', ['bootout', `gui/${uid}/${LABEL}`]); // a leftover from an earlier run would answer already
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.locator('.nav-item', { hasText: 'Sample Service' }).first().waitFor({ timeout: 20_000 });
    await page.locator('.nav-item', { hasText: 'Sample Service' }).first().click();
    const details = page.getByRole('button', { name: 'Show details' });
    if (await details.count()) await details.first().click();

    // SCN-010: a stopped service — Start loads it and it answers.
    await page.getByRole('button', { name: 'Start', exact: true }).first().waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Start', exact: true }).first().click();
    await page.getByText('Sample Service started by you.').first().waitFor({ timeout: 45_000 });

    // SCN-007: Restart — a new pid answers.
    await page.getByRole('button', { name: 'Restart', exact: true }).first().click();
    const restarted = page.getByText(/Sample Service restarted \(pid \d+\)\./).first();
    await restarted.waitFor({ timeout: 45_000 });
    const pid = Number(/pid (\d+)/.exec(await restarted.innerText())?.[1]);
    assert.ok(pid > 0, 'the new pid is named');

    // SCN-008: the program is gone, so every copy launchd starts exits at once — Restart says it did not come
    // back within 40 s.
    fs.rmSync(copy, { recursive: true, force: true });
    await page.getByRole('button', { name: 'Restart', exact: true }).first().click();
    await page.getByText('Sample Service did not come back within 40 s.').first().waitFor({ timeout: 70_000 });
  } finally {
    await closeApp(app);
    spawnSync('launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
    spawnSync('launchctl', ['enable', `gui/${uid}/${LABEL}`]); // leave no disabled entry behind
  }
});

test('SCN-011: a copy started outside launchd keeps the port — Two copies, and Restart names the stray pid', { timeout: 240_000, skip: process.platform !== 'darwin' || Boolean(process.env.FD_SKIP_LAUNCHD) }, async () => {
  const base = tmp('fd-e2e-dup-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'svc');
  fs.mkdirSync(services);
  const port = await freePort();
  const plist = path.join(base, `${LABEL}.plist`);
  const log = path.join(base, 'svc.log');
  fs.writeFileSync(plist, plistFor(['/usr/bin/python3', SAMPLE, 'serve', '--port', String(port), '--data-dir', data], log));
  register(port, data, services, ['--label', LABEL, '--plist', plist]);
  const uid = os.userInfo().uid;
  spawnSync('launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
  // The stray copy: the same service on the same data, started by hand — it holds the lock and the port.
  const stray = serve(port, data);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.locator('.nav-item', { hasText: 'Sample Service' }).first().click({ timeout: 20_000 });
    // launchd starts its own copy, which waits on the lock the stray one holds (DEC-0057): two copies.
    spawnSync('launchctl', ['enable', `gui/${uid}/${LABEL}`]);
    spawnSync('launchctl', ['bootstrap', `gui/${uid}`, plist]);
    await page.getByText(new RegExp(`Two copies: pid ${stray.pid} answers, launchd runs pid \\d+\\.`)).first().waitFor({ timeout: 60_000 });
    const details = page.getByRole('button', { name: 'Show details' });
    if (await details.count()) await details.first().click();
    await page.getByRole('button', { name: 'Restart', exact: true }).first().click();
    await page.getByText(`Sample Service did not take over: pid ${stray.pid}, outside launchd, still holds port ${port}. Stop that process, then restart.`).first().waitFor({ timeout: 70_000 });
    assert.ok(stray.pid);
  } finally {
    await closeApp(app);
    await stopProcess(stray);
    spawnSync('launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
    spawnSync('launchctl', ['enable', `gui/${uid}/${LABEL}`]);
  }
});
