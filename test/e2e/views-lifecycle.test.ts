// FD-338 (the operator, 2026-11-18: «подъемы, перезагрузки»): what an embedded dashboard does when its agent restarts,
// when the window stays hidden, and when the app itself starts again (as after an update), on the built app against
// the live sample service. FD-74 holds the rules; test/dashboard-refresh.test.ts holds them on fakes.
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

/** The dashboards loaded now, by origin. */
const loaded = (app: ElectronApplication) => app.evaluate(({ webContents }) => webContents.getAllWebContents().map((wc) => wc.getURL()).filter((u) => u.startsWith('http://127.0.0.1:')));
/** What the page of an origin says, or '' when none is loaded. */
const pageText = (app: ElectronApplication, origin: string) => app.evaluate(async ({ webContents }, o) => {
  const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith(o));
  return wc ? String(await wc.executeJavaScript('document.body ? document.body.innerText : ""')) : '';
}, origin);

/** Counts each sign-in link a dashboard follows (`/fabric/v1/login?code=…`) in its partition, from now on. */
async function countSignIns(app: ElectronApplication, key: string): Promise<void> {
  await app.evaluate(({ session }, k) => {
    const g = globalThis as { signIns?: Record<string, number> };
    g.signIns ??= {};
    g.signIns[k] = 0;
    session.fromPartition(`persist:svc-${k}`).webRequest.onBeforeRequest({ urls: ['http://127.0.0.1/*'] }, (d, done) => {
      if (new URL(d.url).pathname === '/fabric/v1/login') g.signIns![k] = (g.signIns![k] ?? 0) + 1;
      done({});
    });
  }, key);
}
const signIns = (app: ElectronApplication, key: string) => app.evaluate((_m, k) => (globalThis as { signIns?: Record<string, number> }).signIns?.[k] ?? 0, key);

test('FD-338: a dashboard reloads signed in after its agent restarts; a hidden window keeps two views warm; a new run of the app opens it signed in', { timeout: 180_000, skip: process.platform === 'win32' && 'the sample is started as a POSIX child' }, async () => {
  const base = tmp('fd-e2e-views-');
  const services = path.join(base, 'services');
  const userData = path.join(base, 'app');
  const names = ['alpha', 'beta', 'gamma'];
  const ports = await Promise.all(names.map(() => freePort()));
  const procs: ChildProcess[] = names.map((n, i) => serve(ports[i]!, path.join(base, n), ['--id', n, '--name', `${n[0]!.toUpperCase()}${n.slice(1)} Service`]));
  const env = { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: userData, LANG: 'en_US.UTF-8', FD_TEST_VIEW_RELEASE_MS: '4000' };
  const forward = (link: string) => {
    const r = spawnSync(electronBinary as unknown as string, [ROOT, link], { env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(r.status, 0, r.stderr?.slice(0, 300));
  };
  let app: ElectronApplication | null = null;
  try {
    for (const [i, n] of names.entries()) { await waitAnswering(ports[i]!); register(ports[i]!, path.join(base, n), services, ['--id', n, '--name', `${n[0]!.toUpperCase()}${n.slice(1)} Service`]); }
    const origin = (i: number) => `http://127.0.0.1:${ports[i]}/`;
    app = await electron.launch({ args: [ROOT], env });
    const page = await app.firstWindow();
    await page.locator('.nav-item', { hasText: 'Alpha Service' }).first().waitFor({ timeout: 20_000 });
    await countSignIns(app, 'alpha.default');

    // Each dashboard opened once: three views, each signed in.
    for (const [i, n] of names.entries()) {
      forward(`fabric-dashboards://service/${n}.default`);
      await waitFor(`${n}'s dashboard signed in`, async () => (await pageText(app!, origin(i))).includes(`${n[0]!.toUpperCase()}${n.slice(1)} Service`));
    }
    forward('fabric-dashboards://service/alpha.default');
    await waitFor('alpha back on screen', async () => (await pageText(app!, origin(0))).includes('Alpha Service'));
    const before = await signIns(app, 'alpha.default');

    // 1. The agent restarts (a new process, its sessions gone): the page on screen signs in again and reloads.
    await stopProcess(procs[0]!);
    procs[0] = serve(ports[0]!, path.join(base, 'alpha'), ['--id', 'alpha', '--name', 'Alpha Service']);
    await waitAnswering(ports[0]!);
    await waitFor('the page signed in again after the restart', async () => (await signIns(app!, 'alpha.default')) > before, 30_000);
    await waitFor('the page reloaded where it was', async () => (await pageText(app!, origin(0))).includes('Alpha Service'), 30_000);
    assert.ok(!(await pageText(app, origin(0))).includes('Open this dashboard from Fabric Dashboards'), 'never left on the 401 page');

    // 2. Hidden past the grace: the two dashboards shown last stay, the third is released.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.hide());
    await waitFor('one view released, two kept warm', async () => (await loaded(app!)).length === 2, 20_000);
    assert.deepEqual((await loaded(app)).sort(), [origin(0), origin(2)].sort(), 'alpha (on screen) and gamma (shown before it) stay; beta goes');
    await waitFor('every view released after the second grace', async () => (await loaded(app!)).length === 0, 30_000);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.show());
    await waitFor('the page on screen opens again on showing', async () => (await pageText(app!, origin(0))).includes('Alpha Service'), 30_000);

    // 3. A new run of the app (an update restarts it): the dashboard opens signed in.
    await closeApp(app);
    app = await electron.launch({ args: [ROOT], env });
    const again = await app.firstWindow();
    await again.locator('.nav-item', { hasText: 'Alpha Service' }).first().waitFor({ timeout: 20_000 });
    forward('fabric-dashboards://service/alpha.default');
    await waitFor('the dashboard opened signed in after the app started again', async () => (await pageText(app!, origin(0))).includes('Alpha Service'), 30_000);
    const logs = await app.evaluate(({ app: a }) => a.getPath('logs'));
    assert.match(fs.readFileSync(path.join(logs, 'main.log'), 'utf8'), /released 1 dashboard view\(s\) after [\d.]+ min hidden; kept 2/, 'the release is logged with what it kept');
  } finally {
    await closeApp(app);
    for (const p of procs) await stopProcess(p);
  }
});
