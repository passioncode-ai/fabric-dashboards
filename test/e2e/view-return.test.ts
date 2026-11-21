// FD-364 (the operator, 2026-11-21: «когда в дашборд возвращаюсь … он там висит, как будто бы там не может загрузиться.
// Меняю агента одного на второго и он загружается»): the page on screen when the window comes back, on the built app
// against the live sample service. test/dashboard-refresh.test.ts holds the same rules on fakes.
import assert from 'node:assert/strict';
import { spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import electronBinary from 'electron';
import { _electron as electron, type ElectronApplication } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering, waitFor } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');

async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
}

/** What the page of an origin says within 2 s, or '' when none is loaded or it does not answer. */
const pageText = (app: ElectronApplication, origin: string) => app.evaluate(async ({ webContents }, o) => {
  const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith(o));
  if (!wc) return '';
  return String(await Promise.race([wc.executeJavaScript('document.body ? document.body.innerText : ""'), new Promise((r) => setTimeout(() => r(''), 2000))]));
}, origin);
const setWindow = (app: ElectronApplication, shown: boolean) => app.evaluate(({ BrowserWindow }, s) => { const w = BrowserWindow.getAllWindows()[0]!; if (s) w.show(); else w.hide(); }, shown);
const signIns = (app: ElectronApplication) => app.evaluate(() => (globalThis as { signIns?: number }).signIns ?? 0);

test('FD-364: when the window comes back, a page signed out or not answering opens again by itself, and a released page opens where it was', { timeout: 300_000, skip: process.platform === 'win32' && 'the sample is started as a POSIX child' }, async () => {
  const base = tmp('fd-e2e-return-');
  const services = path.join(base, 'services');
  const port = await freePort();
  const proc: ChildProcess = serve(port, path.join(base, 'alpha'), ['--id', 'alpha', '--name', 'Alpha Service']);
  const env = { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8', FD_TEST_VIEW_RELEASE_MS: '600000' };
  const origin = `http://127.0.0.1:${port}/`;
  let app: ElectronApplication | null = null;
  const open = async (extra: Record<string, string> = {}) => {
    app = await electron.launch({ args: [ROOT], env: { ...env, ...extra } });
    const page = await app.firstWindow();
    await page.locator('.nav-item', { hasText: 'Alpha Service' }).first().waitFor({ timeout: 30_000 });
    const r = spawnSync(electronBinary as unknown as string, [ROOT, 'fabric-dashboards://service/alpha.default'], { env: { ...env, ...extra }, encoding: 'utf8', timeout: 30_000 });
    assert.equal(r.status, 0, r.stderr?.slice(0, 300));
    await waitFor('the dashboard signed in', async () => (await pageText(app!, origin)).includes('Alpha Service'), 30_000);
    await app.evaluate(({ session }) => {
      const g = globalThis as { signIns?: number };
      g.signIns = 0;
      session.fromPartition('persist:svc-alpha.default').webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (d, done) => {
        if (new URL(d.url).pathname === '/fabric/v1/login') g.signIns = (g.signIns ?? 0) + 1;
        done({});
      });
    });
    return page;
  };
  try {
    await waitAnswering(port);
    register(port, path.join(base, 'alpha'), services, ['--id', 'alpha', '--name', 'Alpha Service']);
    let page = await open();

    // 1. A page that is well: the window goes and comes back, nothing signs in again.
    await setWindow(app!, false);
    await page.waitForTimeout(20_000); // a hide the window events miss is found by the 15 s sync (FD-64)
    await setWindow(app!, true);
    await page.waitForTimeout(20_000);
    assert.equal(await signIns(app!), 0, 'a page that is well is not reloaded');
    assert.ok((await pageText(app!, origin)).includes('Alpha Service'));

    // 2. Signed out while the window was away (the session cookie is gone): signed in again by itself on return.
    await setWindow(app!, false);
    await page.waitForTimeout(20_000);
    await app!.evaluate(({ session }) => session.fromPartition('persist:svc-alpha.default').clearStorageData({ storages: ['cookies'] }));
    await setWindow(app!, true);
    await waitFor('the page signed in again on return', async () => (await signIns(app!)) >= 1, 60_000);
    await waitFor('the page is back', async () => (await pageText(app!, origin)).includes('Alpha Service'), 30_000);
    await waitFor('the toolbar is back, no error', async () => page.evaluate(() => Boolean(document.querySelector('.dash-toolbar')) && !document.querySelector('.dash-overlay')), 30_000);

    // 3. A page that stopped answering while the window was away: ended and opened again by itself on return.
    await setWindow(app!, false);
    await page.waitForTimeout(20_000);
    await app!.evaluate(({ webContents }, o) => { void webContents.getAllWebContents().find((w) => w.getURL().startsWith(o))!.executeJavaScript('for(;;){}').catch(() => undefined); }, origin);
    await page.waitForTimeout(1000);
    assert.equal(await pageText(app!, origin), '', 'the page does not answer');
    await setWindow(app!, true);
    await waitFor('the page answers again on return', async () => (await pageText(app!, origin)).includes('Alpha Service'), 90_000);
    await waitFor('the toolbar is back, no error', async () => page.evaluate(() => Boolean(document.querySelector('.dash-toolbar')) && !document.querySelector('.dash-overlay')), 30_000);
    const logs = await app!.evaluate(({ app: a }) => a.getPath('logs'));
    const log = fs.readFileSync(path.join(logs, 'main.log'), 'utf8');
    assert.match(log, /dashboard: alpha\.default was signed out on return, opened again \(FD-364\)/);
    assert.match(log, /dashboard: alpha\.default did not answer within 8 s on return, opened again \(FD-364\)/);
    await closeApp(app);

    // 4. Released while hidden (every view after the second grace): on return its host opens it again, signed in.
    page = await open({ FD_TEST_VIEW_RELEASE_MS: '3000' });
    await page.waitForTimeout(16_000); // on a screen that sends no window events the first show is found by the 15 s sync
    await setWindow(app!, false);
    await waitFor('the view released', async () => (await app!.evaluate(({ webContents }, o) => webContents.getAllWebContents().filter((w) => w.getURL().startsWith(o)).length, origin)) === 0, 60_000);
    await setWindow(app!, true);
    await waitFor('the page opens again on return', async () => (await pageText(app!, origin)).includes('Alpha Service'), 60_000);
    await waitFor('the toolbar is back, no error', async () => page.evaluate(() => Boolean(document.querySelector('.dash-toolbar')) && !document.querySelector('.dash-overlay')), 30_000);
    assert.match(fs.readFileSync(path.join(logs, 'main.log'), 'utf8'), /dashboard: alpha\.default released while hidden, opened again on return \(FD-364\)/);
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});
