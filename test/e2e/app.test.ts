// End to end: the packaged-shape app (out/) against a live sample service.
// Covers SCN-001, SCN-005, SCN-014, SCN-015 and SCN-017 on a real Electron.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test('discovers a live service, opens its dashboard signed in, keeps one view, shows activity', async () => {
  const base = tmp('fd-e2e-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'svc');
  const port = await freePort();
  const proc = serve(port, data, ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, data, services);
    app = await electron.launch({
      args: [ROOT],
      env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' },
    });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: /Sample Service — Ready/ }).waitFor({ timeout: 20_000 });
    await shot(page, '01-overview');

    await page.getByRole('button', { name: /Sample Service — Ready/ }).click();
    await page.getByRole('heading', { name: 'Sample Service' }).waitFor();
    const origin = `http://127.0.0.1:${port}`;
    const embedded = async () => app!.evaluate(({ webContents }, o) =>
      webContents.getAllWebContents().filter((wc) => wc.getURL().startsWith(o)).map((wc) => ({ id: wc.id, url: wc.getURL(), loading: wc.isLoading() })), origin);
    let views = await embedded();
    for (let i = 0; i < 50 && (!views.length || views.some((v) => v.loading) || !views[0]!.url.endsWith('/')); i += 1) {
      await new Promise((r) => setTimeout(r, 200));
      views = await embedded();
    }
    assert.equal(views.length, 1, JSON.stringify(views));
    assert.equal(views[0]!.url, `${origin}/`, 'the login code was redeemed and the dashboard is open');
    const text = await app.evaluate(async ({ webContents }, id) => webContents.fromId(id)!.executeJavaScript('document.body.innerText'), views[0]!.id);
    assert.match(text, /Sample Service started/, 'the page is the signed-in dashboard, not the 401 text');
    const token = fs.readFileSync(path.join(data, 'service.token'), 'utf8').trim();
    const urls = await app.evaluate(({ webContents }) => webContents.getAllWebContents().map((wc) => wc.getURL()));
    assert.ok(urls.every((u) => !u.includes(token)), 'no URL carries the service token');
    await shot(page, '02-service-view');

    await page.getByRole('button', { name: 'Overview' }).click();
    await page.getByRole('button', { name: /Sample Service/ }).first().click();
    await page.getByRole('heading', { name: 'Sample Service' }).waitFor();
    await new Promise((r) => setTimeout(r, 500));
    const again = await embedded();
    assert.deepEqual(again.map((v) => v.id), [views[0]!.id], 'the same view is shown again; no second copy (SCN-015)');

    await page.getByRole('button', { name: 'Activity' }).first().click();
    await page.getByText('Sample Service started on build 0000000.').waitFor({ timeout: 20_000 });
    await shot(page, '03-activity');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByText('Unattributed listeners').waitFor();
    await shot(page, '04-settings');
  } finally {
    await app?.close();
    await stopProcess(proc);
  }
});
