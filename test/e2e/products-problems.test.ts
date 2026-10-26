// End to end, FD-02: products and problem scenarios walked on a real Electron — SCN-033/SCN-034 (two instances
// read as one agent, with a switch), SCN-042 (many problems stay compact), SCN-016 (a dashboard that cannot sign
// in says why), SCN-018 (an unreadable feed says so) and SCN-038 (spend that cannot be read).
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

test('SCN-033, SCN-034: two instances of one agent read as one, and the switch opens each', { timeout: 120_000 }, async () => {
  const base = tmp('fd-e2e-prod-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const [pa, pb] = [await freePort(), await freePort()];
  const da = path.join(base, 'a'); const db = path.join(base, 'b');
  fs.mkdirSync(da); fs.mkdirSync(db);
  const a = serve(pa, da);
  const b = serve(pb, db, ['--instance', 'preview']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(pa); await waitAnswering(pb);
    register(pa, da, services); register(pb, db, services, ['--instance', 'preview']);
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /Sample Service: Ready/ }).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const entries = (await page.locator('.nav-item').allInnerTexts()).filter((t) => t.includes('Sample Service'));
    assert.equal(entries.length, 1, `one sidebar entry for the product: ${JSON.stringify(entries)}`);
    await page.getByText('also:').first().waitFor();
    await page.locator('.nav-item', { hasText: 'Sample Service' }).first().click();
    const sw = page.getByRole('navigation', { name: 'Connections of Sample Service' });
    await sw.waitFor({ timeout: 15_000 });
    await sw.getByText('preview').first().click();
    for (let i = 0; i < 40; i += 1) {
      const views = await app.evaluate(({ webContents }) => webContents.getAllWebContents().map((w) => w.getURL()));
      if (views.some((u) => u.includes(`127.0.0.1:${pb}`))) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const views = await app.evaluate(({ webContents }) => webContents.getAllWebContents().map((w) => w.getURL()));
    assert.ok(views.some((u) => u.includes(`127.0.0.1:${pb}`)), `the preview instance's own page opened: ${JSON.stringify(views)}`);
  } finally {
    await closeApp(app); await stopProcess(a); await stopProcess(b);
  }
});

test('SCN-042, SCN-016, SCN-018, SCN-038: four problems stay compact; a bad token file says why on the page, in Activity and in Spend', { timeout: 180_000, skip: process.platform === 'win32' && 'POSIX token-file mode' }, async () => {
  const base = tmp('fd-e2e-prob-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'data');
  fs.mkdirSync(services); fs.mkdirSync(data);
  const port = await freePort();
  const proc = serve(port, data);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, data, services);
    for (const n of ['one', 'two', 'three', 'four']) {
      fs.writeFileSync(path.join(services, `silent-${n}.default.json`), JSON.stringify({
        protocol: 'fabric-service/0.1', id: `silent-${n}`, instance: 'default', name: `Silent ${n}`, origin: `http://127.0.0.1:${await freePort()}`,
        auth: { tokenFile: path.join(base, 'none.token') }, lifecycle: { manager: 'none' }, paths: { data: path.join(base, n), logs: [] },
        installedAt: '2026-10-13T00:00:00Z', installedBy: 'test',
      }));
    }
    // SCN-016/018/038: the sample's token file becomes readable by others, so it is refused (the app never reads it).
    const tokenFile = path.join(data, 'service.token');
    for (let i = 0; i < 40 && !fs.existsSync(tokenFile); i += 1) await new Promise((r) => setTimeout(r, 100));
    fs.chmodSync(tokenFile, 0o644);
    app = await electron.launch({ args: [ROOT], env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' } });
    const page = await app.firstWindow();

    // SCN-042 with FD-86: four agents silent for the same reason are one line naming all four; the count stays 4 and
    // nothing folds (folding by lines: test/attention.test.ts). Each name opens its agent.
    const attention = page.locator('section.attention');
    await attention.getByText(/^4 agents:/).waitFor({ timeout: 60_000 });
    assert.equal(await attention.locator('.count').innerText(), '4');
    for (const n of ['one', 'two', 'three', 'four']) await attention.getByRole('button', { name: `Silent ${n}`, exact: true }).waitFor();
    assert.equal(await attention.getByRole('button', { name: /^Show all/ }).count(), 0, 'one line: no "Show all"');
    await attention.getByRole('button', { name: 'Silent two', exact: true }).click();
    await page.getByRole('heading', { level: 1, name: 'Silent two' }).waitFor();

    // SCN-018: Activity names the unreadable feed and why.
    await page.getByRole('button', { name: 'Activity' }).first().click();
    await page.getByText(/Sample Service's activity is unavailable: .*readable by others/).first().waitFor({ timeout: 30_000 });

    // SCN-038: Spend lists it under Could not read.
    await page.getByRole('button', { name: 'Spend' }).first().click();
    await page.getByText('Could not read').first().waitFor({ timeout: 30_000 });
    await page.getByText(/readable by others/).first().waitFor();

    // SCN-016: its page cannot sign in, and says why.
    await page.locator('.nav-item', { hasText: 'Sample Service' }).first().click();
    await page.getByText(/Cannot sign in to Sample Service: .*readable by others/).first().waitFor({ timeout: 30_000 });
  } finally {
    await closeApp(app); await stopProcess(proc);
  }
});
