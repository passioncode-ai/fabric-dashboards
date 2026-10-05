// End to end: the packaged-shape app (out/) against a live sample service.
// Covers SCN-001, SCN-005, SCN-014, SCN-015, SCN-017, SCN-026…SCN-029 on a real Electron.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import electronBinary from 'electron';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.env.FD_SCREENSHOTS;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

/** Close the app; a native dialog left open (a failed run) must not hang the suite. */
async function closeApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  const closed = await Promise.race([app.close().then(() => true, () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 10_000))]);
  if (!closed) app.process().kill('SIGKILL');
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
    const logs = await app.evaluate(({ app: a }) => a.getPath('logs'));
    assert.ok(logs.startsWith(path.join(base, 'app')), `a test run logs inside its own data, not the operator's (${logs})`);
    assert.ok(fs.readFileSync(path.join(logs, 'main.log'), 'utf8').includes(services), 'the start line names the test services dir');

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

    // ADR-0014, SCN-039/040: the toolbar shows the page's address and copies it, and the app link.
    // The copy reaches the system clipboard: keep the operator's and put it back.
    const keptClipboard = await app.evaluate(({ clipboard }) => clipboard.readText());
    const address = page.locator('.dash-toolbar .address');
    await address.waitFor({ timeout: 15_000 });
    for (let i = 0; i < 50 && (await address.inputValue()) !== `${origin}/`; i += 1) await new Promise((r) => setTimeout(r, 200));
    assert.equal(await address.inputValue(), `${origin}/`, 'the address is the page, never the one-time login URL');
    await page.getByRole('button', { name: 'Copy address' }).click();
    await page.getByRole('button', { name: 'Copied' }).waitFor();
    assert.equal(await app.evaluate(({ clipboard }) => clipboard.readText()), `${origin}/`);
    await page.getByRole('button', { name: 'Copy app link' }).click();
    const copiedLink = await app.evaluate(({ clipboard }) => clipboard.readText());
    assert.match(copiedLink, /^fabric-dashboards:\/\/service\/sample\.default\?path=%2F$/);
    assert.equal(await page.getByRole('button', { name: 'Back' }).isDisabled(), true, 'nothing to go back to yet');
    await page.getByRole('button', { name: 'Reload page' }).click();
    for (let i = 0; i < 50 && (await address.inputValue()) !== `${origin}/`; i += 1) await new Promise((r) => setTimeout(r, 200));
    assert.equal(await address.inputValue(), `${origin}/`, 'reload keeps the page');
    await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), keptClipboard);

    // A session that ended while the page was open (the service answers 401): the app signs in
    // again by itself, on the same page, instead of leaving the service's 401 text on screen.
    await app.evaluate(async ({ session }) => { await session.fromPartition('persist:svc-sample.default').clearStorageData({ storages: ['cookies'] }); });
    await page.getByRole('button', { name: 'Reload page' }).click();
    let signedIn = '';
    for (let i = 0; i < 60; i += 1) {
      const [v] = await embedded();
      if (v && !v.loading) {
        signedIn = await app.evaluate(async ({ webContents }, id) => webContents.fromId(id)!.executeJavaScript('document.body.innerText'), v.id);
        if (/Sample Service started/.test(signedIn)) break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.match(signedIn, /Sample Service started/, `signed in again after the session ended; page: ${JSON.stringify((await embedded())[0])} ${signedIn.slice(0, 80)}`);
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
    await closeApp(app);
    await stopProcess(proc);
  }
});

// SCN-026 and SCN-028: a link handed over at launch opens that page, and the MCP server built
// into out/ reads the same live service, hands out the same link and never returns the token.
test('a deep link at launch opens the service page signed in; the MCP server sees the same service', async () => {
  const base = tmp('fd-e2e-link-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'svc');
  const port = await freePort();
  const proc = serve(port, data, ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  try {
    await waitAnswering(port);
    register(port, data, services);
    const token = fs.readFileSync(path.join(data, 'service.token'), 'utf8').trim();

    const mcp = spawnSync(process.execPath, [path.join(ROOT, 'out/main/mcp/server.js')], {
      input: [
        '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}',
        '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_services","arguments":{}}}',
        `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"link","arguments":{"url":"http://127.0.0.1:${port}/?from=agent"}}}`,
        '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"activity","arguments":{"service":"sample.default"}}}',
        '',
      ].join('\n'),
      encoding: 'utf8', timeout: 20_000, env: { ...process.env, FABRIC_SERVICES_DIR: services },
    });
    assert.ok(!mcp.stdout.includes(token), 'no MCP answer carries the service token');
    const replies = new Map(mcp.stdout.trim().split('\n').map((l) => JSON.parse(l) as { id: number; result: { structuredContent?: Record<string, unknown> } }).map((r) => [r.id, r.result]));
    const listed = (replies.get(2)!.structuredContent as { services: { key: string; state: string }[] }).services;
    assert.deepEqual(listed.map((s) => [s.key, s.state]), [['sample.default', 'ready']]);
    const link = replies.get(3)!.structuredContent as { open_link: string };
    assert.equal(link.open_link, 'fabric-dashboards://service/sample.default?path=%2F%3Ffrom%3Dagent');
    assert.ok((replies.get(4)!.structuredContent as { events: { text: string }[] }).events.some((e) => /Sample Service started/.test(e.text)));

    app = await electron.launch({
      args: [ROOT, link.open_link],
      env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' },
    });
    const page = await app.firstWindow();
    // The service view itself (its tabs), not the overview card that shares the heading.
    await page.getByRole('tab', { name: 'Dashboard', selected: true }).waitFor({ timeout: 20_000 });
    const origin = `http://127.0.0.1:${port}`;
    let url = '';
    for (let i = 0; i < 75 && url !== `${origin}/?from=agent`; i += 1) {
      await new Promise((r) => setTimeout(r, 200));
      url = await app.evaluate(({ webContents }, o) => webContents.getAllWebContents().map((wc) => wc.getURL()).find((u) => u.startsWith(o)) ?? '', origin);
    }
    assert.equal(url, `${origin}/?from=agent`, 'the embedded view is at the linked path, signed in');
    const before = await app.evaluate(({ webContents }, o) => webContents.getAllWebContents()
      .filter((wc) => wc.getURL().startsWith(o)).map((wc) => wc.id), origin);
    assert.equal(before.length, 1);
    // Burst through the real application event handler, as Launch Services does. This
    // does not claim ten OS-dispatched processes: second-instance forwarding is below.
    await app.evaluate(({ app: a, shell }, deep) => {
      const state = globalThis as typeof globalThis & { externalOpens?: number };
      state.externalOpens = 0;
      shell.openExternal = async () => { state.externalOpens!++; };
      for (let i = 0; i < 10; i++) a.emit('open-url', { preventDefault() {} }, deep);
    }, link.open_link);
    await page.getByRole('tab', { name: 'Dashboard', selected: true }).waitFor();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const after = await app.evaluate(({ webContents }, o) => ({
      ids: webContents.getAllWebContents().filter((wc) => wc.getURL().startsWith(o)).map((wc) => wc.id),
      external: (globalThis as typeof globalThis & { externalOpens: number }).externalOpens,
    }), origin);
    assert.deepEqual(after.ids, before, 'ten links reuse the same embedded service view');
    assert.equal(after.external, 0, 'no external browser open');
    await shot(page, '05-deep-link');
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});

// SCN-029 (Fabric's SCN-101, plan row AR-2.5): `fabric-dashboards://service/<id>.<instance>` — the
// form Fabric's "Open dashboard" opens — at launch and while the app runs (a second process
// forwards the link and exits). A stopped service still opens, on its Start control; a service
// that is not installed, and a page off the service's origin, are refused with the reason.
test('service/<id>.<instance> links open the service, a stopped one on its Start control; foreign targets are refused', { timeout: 180_000 }, async () => {
  const base = tmp('fd-e2e-service-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'svc');
  const port = await freePort();
  const restingPort = await freePort();
  const proc = serve(port, data, ['--name', 'Sample Service']);
  let app: ElectronApplication | null = null;
  const env = { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' };
  // A second process with the same profile finds the running app, hands it the link and quits.
  const forward = (link: string) => {
    const r = spawnSync(electronBinary as unknown as string, [ROOT, link], { env, encoding: 'utf8', timeout: 30_000 });
    assert.equal(r.status, 0, `the forwarding process exits cleanly (${r.stderr?.slice(0, 300)})`);
  };
  try {
    await waitAnswering(port);
    register(port, data, services);
    // Installed, launchd-managed, never loaded: launchd answers «not found», so it is Off. No
    // launchctl verb runs — the label and the plist do not exist.
    register(restingPort, path.join(base, 'resting'), services, ['--id', 'resting', '--name', 'Resting Service',
      '--label', 'ai.passioncode.fabric-dashboards.test.absent', '--plist', path.join(base, 'absent.plist')]);

    app = await electron.launch({ args: [ROOT, 'fabric-dashboards://service/sample.default'], env });
    const page = await app.firstWindow();
    await page.getByRole('tab', { name: 'Dashboard', selected: true }).waitFor({ timeout: 20_000 });
    await page.getByRole('heading', { level: 1, name: 'Sample Service' }).waitFor();
    const origin = `http://127.0.0.1:${port}`;
    let url = '';
    for (let i = 0; i < 75 && url !== `${origin}/`; i += 1) {
      await new Promise((r) => setTimeout(r, 200));
      url = await app.evaluate(({ webContents }, o) => webContents.getAllWebContents().map((wc) => wc.getURL()).find((u) => u.startsWith(o)) ?? '', origin);
    }
    assert.equal(url, `${origin}/`, 'the plan form opens the service\'s dashboard, signed in');
    await shot(page, '06-service-link');

    // Refusals are shown in a native dialog; capture it instead of leaving one on the screen.
    await app.evaluate(({ dialog }) => {
      const seen: unknown[] = [];
      (globalThis as { refused?: unknown[] }).refused = seen;
      dialog.showMessageBox = (async (...args: unknown[]) => { seen.push(args.at(-1)); return { response: 0, checkboxChecked: false }; }) as typeof dialog.showMessageBox;
    });

    forward('fabric-dashboards://service/resting.default');
    await page.getByRole('heading', { level: 1, name: 'Resting Service' }).waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Start', exact: true }).waitFor({ timeout: 20_000 });
    assert.ok(await page.getByText('Off', { exact: true }).first().isVisible(), 'the stopped service is shown Off');
    await shot(page, '07-service-link-stopped');

    const refusals = async (n: number) => {
      for (let i = 0; i < 100; i += 1) {
        const seen = await app!.evaluate(() => ((globalThis as { refused?: { detail?: string }[] }).refused ?? []).map((o) => o.detail ?? ''));
        if (seen.length >= n) return seen;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`fewer than ${n} refusals shown`);
    };
    forward('fabric-dashboards://service/nobody.default');
    forward(`fabric-dashboards://service/sample.default?path=${encodeURIComponent('//evil.example/x')}`);
    forward('fabric-dashboards://service/Sample.default');
    const shown = await refusals(3);
    assert.match(shown[0]!, /no installed service "nobody\.default"\. Nothing was opened\./);
    assert.match(shown[1]!, /path must be a path on the service/);
    assert.match(shown[2]!, /not a service key/);
    const urls = await app.evaluate(({ webContents }) => webContents.getAllWebContents().map((wc) => wc.getURL()));
    assert.ok(urls.every((u) => !u.includes('evil.example')), 'a refused link opens nothing');
    await page.getByRole('heading', { level: 1, name: 'Resting Service' }).waitFor();
    const logs = await app.evaluate(({ app: a }) => a.getPath('logs'));
    const logged = fs.readFileSync(path.join(logs, 'main.log'), 'utf8');
    assert.match(logged, /deep link refused: no installed service "nobody\.default"/);
    assert.ok(!logged.includes('evil.example'), 'the log names the reason, never the link');
  } finally {
    await closeApp(app);
    await stopProcess(proc);
  }
});

// SCN-015: switching between two dashboards that are both loaded shows the chosen one. Before
// the fix the old host's hide arrived after the new host's show and left the tab blank.
// SCN-033/034 (ADR-0012): the two are instances of one id, so they are one product — Alpha is its
// primary (no `default`, first by key), and Beta is reached through the instance switch.
test('switching between two loaded dashboards keeps the chosen dashboard on screen', async () => {
  const base = tmp('fd-e2e-switch-');
  const services = path.join(base, 'services');
  const ports = [await freePort(), await freePort()];
  const names = ['Alpha Service', 'Beta Service'];
  const procs = ports.map((p, i) => serve(p, path.join(base, `svc-${i}`), ['--name', names[i]!, '--instance', i ? 'beta' : 'alpha']));
  let app: ElectronApplication | null = null;
  try {
    for (const [i, p] of ports.entries()) {
      await waitAnswering(p);
      register(p, path.join(base, `svc-${i}`), services, ['--name', names[i]!, '--instance', i ? 'beta' : 'alpha']);
    }
    app = await electron.launch({
      args: [ROOT],
      env: { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' },
    });
    const page = await app.firstWindow();
    const onScreen = async () => app!.evaluate(({ BrowserWindow, webContents }) => {
      const children = BrowserWindow.getAllWindows()[0]!.contentView.children as unknown as { webContents?: { id: number }; getBounds(): { width: number; height: number } }[];
      return children.filter((c) => c.webContents && c.getBounds().width > 0 && c.getBounds().height > 0)
        .map((c) => webContents.fromId(c.webContents!.id)?.getURL() ?? '');
    });
    const open = async (i: number) => {
      if (i === 0) await page.getByRole('button', { name: new RegExp(`^${names[i]}`) }).first().click();
      else await page.getByRole('navigation', { name: /Connections of Alpha Service/ }).getByRole('button', { name: /^beta · this Mac/ }).click();
      await page.getByRole('heading', { level: 1, name: names[i]! }).waitFor();
      const origin = `http://127.0.0.1:${ports[i]}`;
      for (let n = 0; n < 75; n += 1) {
        const urls = await onScreen();
        if (urls.length === 1 && urls[0]!.startsWith(origin) && !urls[0]!.includes('login')) return urls;
        await new Promise((r) => setTimeout(r, 200));
      }
      return onScreen();
    };
    await page.getByRole('button', { name: /Alpha Service — Ready/ }).waitFor({ timeout: 20_000 });
    assert.equal(await page.getByRole('button', { name: /Beta Service — / }).count(), 0, 'one card for the product, not one per instance');
    await page.locator('.card-members').getByText('beta').waitFor({ timeout: 20_000 });
    assert.equal((await open(0))[0], `http://127.0.0.1:${ports[0]}/`, 'Alpha opens');
    assert.equal((await open(1))[0], `http://127.0.0.1:${ports[1]}/`, 'Beta opens');
    await new Promise((r) => setTimeout(r, 500)); // let every late hide arrive
    assert.deepEqual(await open(0), [`http://127.0.0.1:${ports[0]}/`], 'back to Alpha: its loaded page is on screen, not a blank tab');
    await new Promise((r) => setTimeout(r, 500));
    assert.deepEqual(await onScreen(), [`http://127.0.0.1:${ports[0]}/`], 'and it stays there');
    await shot(page, '10-switch-back');

    // The same through service links, as an agent hands them over (a second process forwards it).
    const env = { ...process.env, FABRIC_SERVICES_DIR: services, FABRIC_DASHBOARDS_USER_DATA: path.join(base, 'app'), LANG: 'en_US.UTF-8' };
    const forward = (link: string) => {
      const r = spawnSync(electronBinary as unknown as string, [ROOT, link], { env, encoding: 'utf8', timeout: 30_000 });
      assert.equal(r.status, 0, r.stderr?.slice(0, 300));
    };
    const settle = async (i: number) => {
      await page.getByRole('heading', { level: 1, name: names[i]! }).waitFor();
      const origin = `http://127.0.0.1:${ports[i]}/`;
      for (let n = 0; n < 50; n += 1) {
        const urls = await onScreen();
        if (urls.length === 1 && urls[0] === origin) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((r) => setTimeout(r, 700));
      return onScreen();
    };
    forward('fabric-dashboards://service/sample.beta');
    assert.deepEqual(await settle(1), [`http://127.0.0.1:${ports[1]}/`], 'a link to Beta shows Beta');
    forward('fabric-dashboards://service/sample.alpha');
    assert.deepEqual(await settle(0), [`http://127.0.0.1:${ports[0]}/`], 'a link back to Alpha shows Alpha, not a blank tab');
    // Attached is not enough: Chromium must treat the page as visible, or it does not paint it.
    const visibility = async () => app!.evaluate(async ({ BrowserWindow, webContents }) => {
      const w = BrowserWindow.getAllWindows()[0]!;
      const child = (w.contentView.children as unknown as { webContents?: { id: number } }[]).find((c) => c.webContents)!;
      return webContents.fromId(child.webContents!.id)!.executeJavaScript('document.visibilityState');
    });
    assert.equal(await visibility(), 'visible', 'the page shown again is visible to Chromium, so it paints');
  } finally {
    await closeApp(app);
    for (const p of procs) await stopProcess(p);
  }
});
