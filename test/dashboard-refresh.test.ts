// SCN-039: execute the production ServiceViews with a recording Electron boundary.
// No Electron process, native window, real token or installed profile is opened.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ServiceSnapshot } from '../src/core/types';
import { setWindowsAclReader } from '@passioncode-ai/fabric-service-host';
import { windowsAclReader } from './win-acl';

let Views: typeof import('../src/electron/views').ServiceViews;
let completed: (details: object) => void = () => undefined;
let responseStatus = 200;
let loadFailure = false;
/** FD-74: a status per URL, when a test needs the page and the login to answer differently. */
let statusFor: ((url: string) => number) | null = null;
let cacheCleared = 0;
const created: FakeView[] = [];
class FakeContents extends EventEmitter {
  url = ''; calls: string[] = []; reloads = 0; destroyed = false;
  navigationHistory = { canGoBack: () => true, canGoForward: () => true, goBack: () => undefined, goForward: () => undefined };
  setWindowOpenHandler() {}
  isLoading() { return false; }
  isDestroyed() { return this.destroyed; }
  getURL() { return this.url; }
  reload() { this.reloads += 1; }
  close() { this.destroyed = true; }
  async loadURL(url: string) {
    this.calls.push(url);
    if (loadFailure) throw new Error(`ERR_CONNECTION_REFUSED (-102) loading '${url}'`);
    this.url = url.includes('/fabric/v1/login?') ? `${new URL(url).origin}/dashboard` : url;
    const status = statusFor ? statusFor(url) : responseStatus;
    this.emit('did-navigate', {}, this.url, status);
    completed({ resourceType: 'mainFrame', statusCode: status, url: this.url });
    this.emit('did-finish-load');
    this.emit('did-stop-loading');
  }
}
class FakeView {
  webContents = new FakeContents();
  constructor() { created.push(this); }
  setBackgroundColor() {}
  setBounds() {}
}
const electron = {
  BrowserWindow: class {}, WebContentsView: FakeView,
  dialog: { showMessageBox: async () => ({ response: 1 }) }, shell: {},
  session: { fromPartition: () => ({
    setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, clearCache: async () => { cacheCleared += 1; },
    webRequest: { onCompleted: (_filter: unknown, callback: typeof completed) => { completed = callback; } },
  }) },
};
const require = createRequire(import.meta.url);
const electronModule = require.resolve('electron');
const originalElectronModule = require.cache[electronModule];
require.cache[electronModule] = { exports: electron } as any;
before(async () => { Views = (await import('../src/electron/views')).ServiceViews; });
after(() => {
  if (originalElectronModule) require.cache[electronModule] = originalElectronModule;
  else delete require.cache[electronModule];
});

let tokenDir: string | null = null;
function sharedToken(): string {
  if (!tokenDir) {
    tokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-refresh-'));
    fs.writeFileSync(path.join(tokenDir, 'token'), 'fixture-token-for-dashboard-refresh-tests', { mode: 0o600 });
  }
  return path.join(tokenDir, 'token');
}
after(() => { if (tokenDir) fs.rmSync(tokenDir, { recursive: true, force: true }); });

async function fixture(t: any, login = true) {
  created.length = 0; responseStatus = 200; loadFailure = false; statusFor = null; cacheCleared = 0;
  let logins = 0, refuse = false, release: (() => void) | undefined;
  let hold = false;
  const finish = () => { const reply = release; release = undefined; reply?.(); };
  const server = http.createServer((req, res) => {
    assert.equal(req.url, '/fabric/v1/login-code');
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.authorization, 'Bearer fixture-token-for-dashboard-refresh-tests');
    logins += 1;
    const reply = () => {
      res.writeHead(refuse ? 403 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: '/fabric/v1/login?code=abcdefghijklmnop12345678' }));
    };
    if (hold) release = reply; else reply();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  // One token file for the whole file: on Windows its ACL is read by a cold PowerShell once and then cached by path
  // and stat (service-host freshAcl), as for a real service; a file per fixture took over 120 s on windows-11-arm.
  const token = sharedToken();
  t.after(async () => { finish(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  let snap = { key: 'fixture.default', state: 'ready', descriptor: { origin, auth: { tokenFile: token } },
    wellKnown: { surfaces: { dashboard: { path: '/dashboard', ...(login ? { login: true } : {}) } } },
  } as unknown as ServiceSnapshot;
  const events: any[] = [];
  const view = new Views({ contentView: { addChildView() {}, removeChildView() {} } } as any, () => 'en', (event) => events.push(event), undefined, undefined, () => snap);
  assert.deepEqual(await view.show(snap, { x: 0, y: 0, width: 400, height: 300 }, '/answers?tab=open#thread', 'owner'), { ok: true });
  const wc = created[0]!.webContents;
  const base = logins;
  async function settled() {
    for (let i = 0; i < 100 && (view as any).refreshes.size; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal((view as any).refreshes.size, 0, 'refresh finishes');
  }
  async function waiting() {
    for (let i = 0; i < 100 && !release; i++) await new Promise((r) => setTimeout(r, 10));
    assert.ok(release, 'fixture received one login request');
  }
  return { view, wc, events, origin, base, get snap() { return snap; }, get logins() { return logins; }, settled, waiting,
    hold: () => { hold = true; }, release: finish, takeRelease: () => { const reply = release!; release = undefined; return reply; }, refuse: () => { refuse = true; },
    state: (state: string) => { snap = { ...snap, state } as ServiceSnapshot; },
    changedToken: () => { snap = { ...snap, descriptor: { ...snap.descriptor!, auth: { tokenFile: `${token}-changed` } } }; },
    foreign: () => { snap = { ...snap, descriptor: { ...snap.descriptor!, origin: 'https://different.invalid' } }; },
    pid: (pid: number) => { snap = { ...snap, wellKnown: { ...snap.wellKnown!, process: { pid, startedAt: '2026-10-19T00:00:00Z' } } } as ServiceSnapshot; },
  };
}

test('explicit refresh uses one existing SSO flow and returns to the same page', async (t) => {
  setWindowsAclReader(windowsAclReader()); // FD-94: the token read the installed app makes
  t.after(() => setWindowsAclReader(null));
  const f = await fixture(t);
  f.view.navigate('fixture.default', 'refresh');
  await f.settled();
  assert.equal(f.logins - f.base, 1);
  assert.equal(f.wc.reloads, 0);
  assert.equal(f.wc.url, `${f.origin}/answers?tab=open#thread`);
  assert.equal(created.length, 1, 'the original native view is reused');
  assert.equal(f.events.some((event) => event.kind === 'error'), false);
});

test('overlapping explicit refresh clicks share one pending sign-in', async (t) => {
  const f = await fixture(t); f.hold();
  f.view.navigate('fixture.default', 'refresh');
  f.view.navigate('fixture.default', 'refresh');
  await f.waiting();
  assert.equal(f.view.page('fixture.default')?.loading, true);
  f.release(); await f.settled();
  assert.equal(f.view.page('fixture.default')?.loading, false);
  assert.equal(f.logins - f.base, 1);
});

test('switching away while the code is requested never loads the obsolete attempt', async (t) => {
  const f = await fixture(t); f.hold(); const before = f.wc.calls.length;
  f.view.navigate('fixture.default', 'refresh'); await f.waiting();
  f.view.hide('owner'); f.release(); await f.settled();
  assert.equal(f.wc.calls.length, before);
  assert.equal(f.events.some((event) => event.kind === 'error'), false);
});

for (const status of [401, 404, 500]) test(`HTTP ${status} after explicit SSO is one visible failure without a retry loop`, async (t) => {
  const f = await fixture(t); responseStatus = status;
  f.view.navigate('fixture.default', 'refresh'); await f.settled();
  assert.equal(f.logins - f.base, 1);
  assert.match(f.events.find((event) => event.kind === 'error')?.error, new RegExp(`HTTP ${status}`));
  assert.equal(f.events.some((event) => JSON.stringify(event).includes('abcdefghijklmnop12345678')), false);
});

test('a refused login is visible and never navigates the page', async (t) => {
  const f = await fixture(t); f.refuse(); const before = f.wc.calls.length;
  f.view.navigate('fixture.default', 'refresh'); await f.settled();
  assert.equal(f.logins - f.base, 1);
  assert.equal(f.wc.calls.length, before);
  assert.match(f.events.find((event) => event.kind === 'error')?.error, /403/);
});

test('network failure is visible without putting a login URL in the event', async (t) => {
  const f = await fixture(t); loadFailure = true;
  f.view.navigate('fixture.default', 'refresh'); await f.settled();
  assert.match(f.events.find((event) => event.kind === 'error')?.error, /ERR_CONNECTION_REFUSED/);
  assert.equal(f.events.some((event) => JSON.stringify(event).includes('code=')), false);
});

for (const mode of ['down', 'foreign']) test(`${mode} service gets no sign-in request on refresh`, async (t) => {
  const f = await fixture(t); if (mode === 'down') f.state('down'); else f.foreign();
  f.view.navigate('fixture.default', 'refresh'); await f.settled();
  assert.equal(f.logins, f.base);
  assert.equal(f.events.at(-1)?.kind, 'error');
});

test('non-login dashboard preserves ordinary browser refresh', async (t) => {
  const f = await fixture(t, false);
  f.view.navigate('fixture.default', 'refresh'); await f.settled();
  assert.equal(f.logins, 0); assert.equal(f.wc.reloads, 1);
});

test('an unsafe current URL falls back to the declared dashboard', async (t) => {
  const f = await fixture(t); f.wc.url = 'https://foreign.invalid/private';
  f.view.navigate('fixture.default', 'refresh'); await f.settled();
  assert.equal(f.wc.url, `${f.origin}/dashboard`);
});

test('anonymous 404 alone does not request any login', async (t) => {
  const f = await fixture(t);
  completed({ resourceType: 'mainFrame', statusCode: 404, url: `${f.origin}/answers` });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(f.logins, f.base);
});

for (const change of ['token', 'origin', 'down', 'drop']) test(`pending refresh stops when ${change} changes`, async (t) => {
  const f = await fixture(t); f.hold(); const before = f.wc.calls.length;
  f.view.navigate('fixture.default', 'refresh'); await f.waiting();
  if (change === 'token') f.changedToken();
  if (change === 'origin') f.foreign();
  if (change === 'down') f.state('down');
  if (change === 'drop') f.view.drop('fixture.default');
  f.release(); await f.settled();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(f.wc.calls.length, before);
  assert.equal(f.events.some((event) => event.kind === 'error'), false);
});

for (const status of [401, 404]) test(`explicit fresh reopen reports HTTP ${status} and can be retried successfully`, async (t) => {
  const f = await fixture(t); responseStatus = status;
  const reopen = () => f.view.show(f.snap, { x: 0, y: 0, width: 400, height: 300 }, undefined, 'owner', true);
  assert.equal((await reopen()).ok, false);
  assert.equal(f.logins - f.base, 1);
  responseStatus = 200;
  assert.deepEqual(await reopen(), { ok: true });
  assert.equal(f.logins - f.base, 2);
});

test('existing automatic 401 recovery still signs in once and preserves the page', async (t) => {
  const f = await fixture(t); const before = f.wc.calls.length;
  completed({ resourceType: 'mainFrame', statusCode: 401, url: `${f.origin}/answers` });
  for (let i = 0; i < 100 && f.wc.calls.length < before + 2; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(f.logins - f.base, 1);
  assert.equal(f.wc.url, `${f.origin}/answers`);
  completed({ resourceType: 'mainFrame', statusCode: 401, url: `${f.origin}/answers` });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(f.logins - f.base, 1, 'existing one-minute automatic retry bound remains');
});

test('a late automatic 401 login cannot overwrite a newer explicit refresh', async (t) => {
  const f = await fixture(t); f.hold();
  completed({ resourceType: 'mainFrame', statusCode: 401, url: `${f.origin}/old-page` });
  await f.waiting(); const finishOld = f.takeRelease();
  f.view.navigate('fixture.default', 'refresh'); await f.waiting();
  f.release(); await f.settled(); const before = f.wc.calls.length;
  finishOld(); await new Promise((r) => setTimeout(r, 30));
  assert.equal(f.wc.calls.length, before);
  assert.equal(f.wc.url, `${f.origin}/answers?tab=open#thread`);
});

test('fresh reopen after a dropped view cannot start a second login on HTTP 401', async (t) => {
  const f = await fixture(t); f.view.drop('fixture.default'); responseStatus = 401;
  const result = await f.view.show(f.snap, { x: 0, y: 0, width: 400, height: 300 }, '/answers', 'owner', true);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(result.ok, false);
  assert.equal(f.logins - f.base, 1);
});

for (const change of ['origin', 'token', 'down']) test(`fresh reopen stops before navigation when ${change} changes`, async (t) => {
  const f = await fixture(t); f.hold(); const before = f.wc.calls.length;
  const reopening = f.view.show(f.snap, { x: 0, y: 0, width: 400, height: 300 }, '/answers', 'owner', true);
  await f.waiting();
  if (change === 'origin') f.foreign();
  if (change === 'token') f.changedToken();
  if (change === 'down') f.state('down');
  f.release();
  assert.equal((await reopening).ok, false);
  assert.equal(f.wc.calls.length, before);
});

test('ordinary reopen after failed fresh HTTP load signs in instead of attaching an error page', async (t) => {
  const f = await fixture(t); responseStatus = 404;
  const rect = { x: 0, y: 0, width: 400, height: 300 };
  assert.equal((await f.view.show(f.snap, rect, '/answers', 'owner', true)).ok, false);
  responseStatus = 200;
  assert.deepEqual(await f.view.show(f.snap, rect, undefined, 'new-owner'), { ok: true });
  assert.equal(f.logins - f.base, 2);
});

// FD-74: a view made again opens at once while the same service process signed it in recently.
const RECT = { x: 0, y: 0, width: 400, height: 300 };
async function signedInWithPid(t: any) {
  const f = await fixture(t); f.pid(4242);
  f.view.drop('fixture.default');
  assert.deepEqual(await f.view.show(f.snap, RECT, '/answers', 'owner'), { ok: true });
  assert.equal(f.logins - f.base, 1, 'the first open with a known process signs in');
  f.view.drop('fixture.default');
  return f;
}

test('FD-74: a view made again opens the page without a new login code', async (t) => {
  const f = await signedInWithPid(t);
  assert.deepEqual(await f.view.show(f.snap, RECT, '/answers', 'owner'), { ok: true });
  assert.equal(f.logins - f.base, 1, 'no second login code');
  const wc = created.at(-1)!.webContents;
  assert.deepEqual(wc.calls, [`${f.origin}/answers`], 'one navigation, straight to the page');
});

test('FD-74: a refused direct open signs in once and ends on the same page', async (t) => {
  const f = await signedInWithPid(t);
  statusFor = (url) => (url.includes('/fabric/v1/login?') ? 200 : created.at(-1)!.webContents.calls.length === 1 ? 401 : 200);
  assert.deepEqual(await f.view.show(f.snap, RECT, '/answers', 'owner'), { ok: true });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(f.logins - f.base, 2, 'exactly one login code after the 401');
  assert.equal(created.at(-1)!.webContents.url, `${f.origin}/answers`);
});

test('FD-74: a 401 from the page\'s own request after a direct open signs it in', async (t) => {
  const f = await signedInWithPid(t);
  assert.deepEqual(await f.view.show(f.snap, RECT, '/answers', 'owner'), { ok: true });
  completed({ resourceType: 'xhr', statusCode: 401, url: `${f.origin}/api/items` });
  for (let i = 0; i < 100 && f.logins - f.base < 2; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(f.logins - f.base, 2);
  completed({ resourceType: 'xhr', statusCode: 401, url: `${f.origin}/api/items` });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(f.logins - f.base, 2, 'a later XHR 401 after a signed-in load starts nothing');
});

test('FD-74: a new service process means a new login code', async (t) => {
  const f = await signedInWithPid(t); f.pid(4243);
  assert.deepEqual(await f.view.show(f.snap, RECT, '/answers', 'owner'), { ok: true });
  assert.equal(f.logins - f.base, 2);
});

test('FD-74: a restart reloads the page on screen, signed in again, where it was', async (t) => {
  const f = await fixture(t);
  f.view.serviceRestarted('fixture.default');
  assert.equal(f.events.filter((e) => e.kind === 'restarted').length, 1);
  await f.settled();
  assert.equal(f.logins - f.base, 1);
  assert.equal(f.wc.url, `${f.origin}/answers?tab=open#thread`);
});

test('FD-74: a page off screen when its service restarted reloads where it was next time', async (t) => {
  const f = await fixture(t); f.view.hide('owner');
  f.view.serviceRestarted('fixture.default');
  assert.equal(f.logins - f.base, 0, 'nothing loads while it is off screen');
  assert.deepEqual(await f.view.show(f.snap, RECT, undefined, 'owner'), { ok: true });
  assert.equal(f.logins - f.base, 1);
  assert.equal(f.wc.url, `${f.origin}/answers?tab=open#thread`);
  assert.equal(created.length, 1, 'the same view, loaded again');
});

test('FD-74: a hidden window keeps the two pages shown last and closes the rest', async (t) => {
  const f = await fixture(t);
  const other = (key: string) => ({ ...f.snap, key } as ServiceSnapshot);
  for (const key of ['beta.default', 'gamma.default', 'delta.default']) {
    const r = await f.view.show(other(key), RECT, undefined, 'owner'); assert.equal(r.ok, true, JSON.stringify(r));
    await new Promise((r) => setTimeout(r, 2));
  }
  assert.equal(f.view.releaseCold(2), 2);
  assert.deepEqual(f.view.keys().sort(), ['delta.default', 'gamma.default']);
  f.view.releaseAll();
  assert.deepEqual(f.view.keys(), []);
});

test('FD-74: a reload ignoring the cache empties the service\'s cache, then signs in again', async (t) => {
  const f = await fixture(t);
  await f.view.reload('fixture.default', true);
  await f.settled();
  assert.equal(cacheCleared, 1);
  assert.equal(f.logins - f.base, 1);
  await f.view.reload('fixture.default', false);
  await f.settled();
  assert.equal(cacheCleared, 1, 'a plain reload keeps the cache');
  assert.equal(f.view.shownKey(), 'fixture.default');
});
