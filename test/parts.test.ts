import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ActivityStore } from '../src/core/activity';
import { atomicWrite } from '../src/core/fsutil';
import { allKeys, dictionary, duration, langFor, t } from '../src/core/i18n';
import { listListeners, parseLsof, unattributed } from '../src/core/listeners';
import { inQuietHours, shouldNotify } from '../src/core/notify';
import { merge, SettingsStore } from '../src/core/settings';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/types';
import { clampRect, dashboardPathOf, loadErrorText, navigation, partitionFor, resolveLink, routeLink } from '../src/electron/policy';
import { tmp } from './helpers';

test('navigation stays on the service origin; web links leave only through the browser', () => {
  const o = 'http://127.0.0.1:47195';
  assert.equal(navigation(o, 'http://127.0.0.1:47195/dashboard#/x'), 'allow');
  assert.equal(navigation(o, 'http://127.0.0.1:8796/'), 'external');
  assert.equal(navigation(o, 'https://appstoreconnect.apple.com/'), 'external');
  assert.equal(navigation(o, 'file:///etc/passwd'), 'deny');
  assert.equal(navigation(o, 'javascript:alert(1)'), 'deny');
  assert.equal(navigation(o, 'not a url'), 'deny');
  assert.equal(partitionFor('maker.preview'), 'persist:svc-maker.preview');
  assert.equal(resolveLink(o, '/dashboard#/approvals/7', '/dashboard'), 'http://127.0.0.1:47195/dashboard#/approvals/7');
  assert.equal(resolveLink(o, '//evil.example/x', '/dashboard'), 'http://127.0.0.1:47195/dashboard', 'a protocol-relative link never leaves the origin');
  assert.equal(resolveLink(o, 'https://evil.example', '/'), 'http://127.0.0.1:47195/');
  assert.deepEqual(clampRect({ x: -3, y: 10.6, width: NaN, height: 200 }), { x: 0, y: 11, width: 0, height: 200 });
});

const withN = (patch: Partial<Settings['notifications']>): Settings => ({ ...DEFAULT_SETTINGS, notifications: { ...DEFAULT_SETTINGS.notifications, ...patch } });

test('notification policy: switch, pause, quiet hours across midnight, per service, level floor', () => {
  const noon = new Date(2026, 8, 28, 12, 0);
  const night = new Date(2026, 8, 28, 23, 30);
  const early = new Date(2026, 8, 29, 7, 59);
  assert.equal(shouldNotify(DEFAULT_SETTINGS, { kind: 'down', serviceKey: 'a.default' }, noon), true);
  assert.equal(shouldNotify(withN({ enabled: false }), { kind: 'down', serviceKey: 'a.default' }, noon), false);
  assert.equal(shouldNotify(withN({ pausedUntil: new Date(noon.getTime() + 60_000).toISOString() }), { kind: 'down', serviceKey: 'a.default' }, noon), false);
  const quiet = withN({ quietHours: { enabled: true, from: '22:00', to: '08:00' } });
  assert.equal(inQuietHours(quiet, night), true);
  assert.equal(inQuietHours(quiet, early), true);
  assert.equal(inQuietHours(quiet, noon), false);
  assert.equal(shouldNotify(quiet, { kind: 'down', serviceKey: 'a.default' }, night), false);
  const per = withN({ perService: { 'a.default': { enabled: false, minLevel: 'notice' }, 'b.default': { enabled: true, minLevel: 'error' } } });
  assert.equal(shouldNotify(per, { kind: 'down', serviceKey: 'a.default' }, noon), false);
  assert.equal(shouldNotify(per, { kind: 'event', serviceKey: 'b.default', level: 'warning' }, noon), false);
  assert.equal(shouldNotify(per, { kind: 'event', serviceKey: 'b.default', level: 'error' }, noon), true);
  assert.equal(shouldNotify(DEFAULT_SETTINGS, { kind: 'event', serviceKey: 'c.default', level: 'info' }, noon), false, 'info never notifies by default');
});

test('activity store: merges, never repeats, survives a restart with its cursor, counts unread', () => {
  const dir = tmp('fd-act-');
  const a = new ActivityStore(dir);
  const ev = (id: string, at: string, level: 'info' | 'notice' = 'notice') => ({ id, at, kind: 'job.done', level, text: `Job ${id} finished.` });
  assert.equal(a.addServiceEvents('store.default', 'Store Agent', [ev('1', '2026-09-28T10:00:00Z'), ev('2', '2026-09-28T10:01:00Z')], '2').length, 2);
  assert.equal(a.addServiceEvents('store.default', 'Store Agent', [ev('2', '2026-09-28T10:01:00Z')], '2').length, 0);
  a.addServiceEvents('maker.default', 'Maker', [ev('9', '2026-09-28T10:00:30Z', 'info')], '9');
  a.addAppEvent('store.default', 'Store Agent', 'service.down', 'error', 'Store Agent stopped answering.');
  assert.deepEqual(a.list().map((i) => i.id).slice(0, 4).sort(), ['1', '2', '9', 'app-1'].sort());
  assert.equal(a.list({ serviceKey: 'maker.default' }).length, 1);
  assert.equal(a.list({ minLevel: 'error' }).length, 1);
  assert.equal(a.unread(), 3, 'info rows are not unread');
  a.markSeen();
  assert.equal(a.unread(), 0);
  a.flush(); // what quitting does: the debounced cursor and counter reach disk
  const b = new ActivityStore(dir);
  assert.equal(b.cursor('store.default'), '2');
  assert.equal(b.list().length, 4);
  assert.equal(b.latest('store.default')?.id, '2');
  fs.appendFileSync(path.join(dir, 'activity.jsonl'), '{"torn');
  assert.equal(new ActivityStore(dir).list().length, 4, 'a torn last line is skipped');
});

test('activity store: a poll that brings nothing new writes nothing', () => {
  const dir = tmp('fd-act-quiet-');
  const a = new ActivityStore(dir);
  const ev = { id: '1', at: '2026-09-28T10:00:00Z', kind: 'job.done', level: 'notice' as const, text: 'Job 1 finished.' };
  a.addServiceEvents('store.default', 'Store Agent', [ev], '1');
  const file = path.join(dir, 'activity.jsonl');
  const before = fs.statSync(file).ino;
  assert.equal(a.addServiceEvents('store.default', 'Store Agent', [], '1').length, 0);
  assert.equal(a.addServiceEvents('store.default', 'Store Agent', [ev], '1').length, 0, 'a repeated page');
  assert.equal(fs.statSync(file).ino, before, 'the ~1 MB feed is not rewritten every 15 s per service');
  const size = fs.statSync(file).size;
  a.addServiceEvents('store.default', 'Store Agent', [], '2');
  assert.equal(fs.statSync(file).size, size, 'a moved cursor writes no row');
  a.flush();
  assert.equal(new ActivityStore(dir).cursor('store.default'), '2', 'a moved cursor is kept');
});

test('atomicWrite leaves no temporary file behind when the write fails', () => {
  const dir = tmp('fd-atomic-');
  const file = path.join(dir, 'x.json');
  fs.mkdirSync(file); // rename onto a directory fails
  assert.throws(() => atomicWrite(file, 'data'));
  assert.deepEqual(fs.readdirSync(dir), ['x.json']);
});

test('every interface string exists in English and Russian, and placeholders match', () => {
  const en = dictionary('en');
  const ru = dictionary('ru');
  for (const key of allKeys()) {
    assert.ok(ru[key], `ru is missing ${key}`);
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    assert.equal(ph(ru[key]), ph(en[key]), `placeholders differ for ${key}`);
  }
  assert.equal(langFor('ru-RU'), 'ru');
  assert.equal(langFor('en-GB'), 'en');
  assert.equal(t('en', 'reason.duplicate', { answering: 1, launchd: 2 }), 'Two copies: pid 1 answers, launchd runs pid 2.');
  assert.equal(duration('en', 90_000), '2 min');
  assert.equal(duration('ru', 30_000), '30 с');
  for (const banned of ['seamless', 'revolutionary', 'fully autonomous']) {
    assert.ok(!Object.values(en).some((s) => s.toLowerCase().includes(banned)), `brand-banned word: ${banned}`);
  }
});

test('settings persist atomically and heal a damaged file', () => {
  const dir = tmp('fd-set-');
  const s = new SettingsStore(dir);
  assert.equal(s.get().launchAtLogin, false, 'off until the person chooses (LC-07)');
  s.update({ theme: 'light', notifications: { ...s.get().notifications, quietHours: { enabled: true, from: '23:00', to: '07:00' } } });
  assert.equal(new SettingsStore(dir).get().theme, 'light');
  assert.equal(new SettingsStore(dir).get().notifications.quietHours.from, '23:00');
  assert.equal(fs.statSync(path.join(dir, 'settings.json')).mode & 0o777, 0o600);
  // A damaged file is restored from the last good copy, not reset to the defaults (ADR-0015).
  fs.writeFileSync(path.join(dir, 'settings.json'), '{broken');
  const healed = new SettingsStore(dir);
  assert.equal(healed.get().theme, 'light');
  assert.match(healed.recovered!, /not valid JSON; restored from settings.json.bak/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).theme, 'light', 'written back');
  assert.equal(fs.readdirSync(dir).filter((n) => n.startsWith('settings.json.unreadable-')).length, 1, 'the damaged file is kept to look at');
  assert.equal(new SettingsStore(dir).recovered, null, 'read as it is the next time');
  // A missing settings.json with its copy present is restored too.
  fs.rmSync(path.join(dir, 'settings.json'));
  assert.equal(new SettingsStore(dir).get().notifications.quietHours.from, '23:00');
  // Both damaged: the defaults, said out loud.
  fs.writeFileSync(path.join(dir, 'settings.json'), '[]');
  fs.writeFileSync(path.join(dir, 'settings.json.bak'), '{');
  const lost = new SettingsStore(dir);
  assert.deepEqual(lost.get(), DEFAULT_SETTINGS);
  assert.match(lost.recovered!, /no readable copy; defaults in use/);
  assert.equal(merge({ theme: 'neon' as never }).theme, 'dark');
});

test('updates install by themselves unless the person turned it off; a file from an earlier version keeps it on', () => {
  assert.equal(DEFAULT_SETTINGS.autoUpdate, true);
  assert.equal(merge({}).autoUpdate, true, 'absent in a 0.5.2 file: on');
  assert.equal(merge({ autoUpdate: false }).autoUpdate, false);
  assert.equal(merge({ autoUpdate: 'no' as never }).autoUpdate, true);
  assert.equal(merge({}).moveToApplicationsAsked, false);
});

test('ADR-0016: a link inside a dashboard to another agent comes back to the app; other web links leave', () => {
  const own = 'http://127.0.0.1:47195';
  const others = [own, 'http://127.0.0.1:8796', 'https://growth.example.com'];
  assert.deepEqual(routeLink(own, 'http://127.0.0.1:47195/dashboard#/x', others), { kind: 'allow' });
  assert.deepEqual(routeLink(own, 'fabric-dashboards://service/growth.default?path=%2Fdashboard%2F', others), { kind: 'app', link: 'fabric-dashboards://service/growth.default?path=%2Fdashboard%2F' });
  assert.deepEqual(routeLink(own, 'http://127.0.0.1:8796/x?y=1', others), { kind: 'app', link: 'fabric-dashboards://open?url=http%3A%2F%2F127.0.0.1%3A8796%2Fx%3Fy%3D1' });
  assert.deepEqual(routeLink(own, 'https://growth.example.com/dashboard/?view=drafts', others), { kind: 'app', link: 'fabric-dashboards://open?url=https%3A%2F%2Fgrowth.example.com%2Fdashboard%2F%3Fview%3Ddrafts' });
  assert.deepEqual(routeLink(own, 'https://growth.example.com.evil.test/', others), { kind: 'external' }, 'a look-alike host is not a registered origin');
  assert.deepEqual(routeLink(own, 'http://127.0.0.1:9999/', others), { kind: 'external' }, 'a local port no descriptor names');
  assert.deepEqual(routeLink(own, 'https://docs.example.org/', others), { kind: 'external' });
  assert.deepEqual(routeLink(own, 'mailto:a@example.org', others), { kind: 'external' });
  assert.deepEqual(routeLink(own, 'file:///etc/passwd', others), { kind: 'deny' });
  assert.deepEqual(routeLink(own, 'javascript:alert(1)', others), { kind: 'deny' });
  assert.deepEqual(routeLink(own, 'not a url', others), { kind: 'deny' });
});

test('S-4: no link, event path or declared dashboard path loads another host', () => {
  const o = 'http://127.0.0.1:47195';
  assert.equal(resolveLink(o, '/\\evil.example/x', '/dash'), 'http://127.0.0.1:47195/dash', 'a backslash path falls back to the dashboard');
  assert.equal(resolveLink(o, '//evil.example/x', '/dash'), 'http://127.0.0.1:47195/dash');
  assert.equal(resolveLink(o, undefined, '//evil.example/'), 'http://127.0.0.1:47195/', 'a hostile dashboard path becomes the root');
  assert.equal(resolveLink(o, undefined, '/\\evil.example/'), 'http://127.0.0.1:47195/');
  assert.equal(resolveLink(o, '/a?b=1#c', '/'), 'http://127.0.0.1:47195/a?b=1#c');
  assert.equal(dashboardPathOf('@evil.example/'), '/');
  assert.equal(dashboardPathOf('.evil.example/'), '/');
  assert.equal(dashboardPathOf(undefined), '/');
  assert.equal(dashboardPathOf('/dashboard/'), '/dashboard/');
});

test('S-3: a failed load says what failed, never the URL — a sign-in URL is the login code', () => {
  const e = Object.assign(new Error("ERR_CONNECTION_REFUSED (-102) loading 'http://127.0.0.1:47195/fabric/v1/login?code=abcdefghijklmnop1234'"), { code: 'ERR_CONNECTION_REFUSED', errno: -102 });
  assert.equal(loadErrorText(e), 'ERR_CONNECTION_REFUSED');
  const bare = new Error("ERR_FAILED (-2) loading 'http://127.0.0.1:47195/fabric/v1/login?code=abcdefghijklmnop1234'");
  assert.equal(loadErrorText(bare), 'ERR_FAILED (-2)');
  assert.doesNotMatch(loadErrorText(new Error('see https://x.example/fabric/v1/login?code=abc')), /code=/);
});

test('listeners on every interface that no descriptor claims are unattributed', () => {
  const out = `COMMAND   PID  USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
Python  41001 alice    4u  IPv6 0x1      0t0  TCP *:47166 (LISTEN)
Python  41002 alice    3u  IPv4 0x2      0t0  TCP 127.0.0.1:47110 (LISTEN)
ControlCe 679 alice    9u  IPv4 0x3      0t0  TCP *:7000 (LISTEN)
ControlCe 679 alice   10u  IPv6 0x4      0t0  TCP *:7000 (LISTEN)`;
  const all = parseLsof(out);
  assert.equal(all.length, 3);
  assert.deepEqual(unattributed(all, new Set([47110])).map((l) => [l.command, l.port]), [['ControlCe', 7000], ['Python', 47166]]);
  assert.deepEqual(unattributed(all, new Set([47166, 7000])), []);
});

test('R-1/R-2: a full disk never throws out of the activity or settings store; rows reach the file once a write succeeds', () => {
  const dir = tmp('fd-fulldisk-');
  const errors: string[] = [];
  const store = new ActivityStore(dir, { onWriteError: (m) => errors.push(m) });
  store.addAppEvent('a.default', 'A', 'service.down', 'error', 'A is not answering');
  const file = path.join(dir, 'activity.jsonl');
  fs.chmodSync(file, 0o400); // the next append fails, as on ENOSPC
  assert.doesNotThrow(() => store.addAppEvent('a.default', 'A', 'service.back', 'notice', 'A is back'));
  assert.equal(errors.length, 1);
  assert.match(errors[0]!, /could not append/);
  assert.equal(store.list({ serviceKey: 'a.default' }).length, 2, 'the row is kept in memory');
  fs.chmodSync(file, 0o600);
  store.addAppEvent('a.default', 'A', 'service.down', 'error', 'A is not answering');
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
  assert.equal(lines.length, 3, 'the next write that succeeds rewrites the file with every row');
  assert.ok(lines.every((l) => JSON.parse(l)));

  const sdir = tmp('fd-fulldisk-set-');
  const serrors: string[] = [];
  const settings = new SettingsStore(sdir, (m) => serrors.push(m));
  fs.chmodSync(sdir, 0o500);
  try {
    assert.doesNotThrow(() => settings.update({ theme: 'light' }));
    assert.equal(settings.get().theme, 'light', 'kept in memory');
    assert.match(serrors[0]!, /not saved/);
  } finally {
    fs.chmodSync(sdir, 0o700);
  }
});

test('R-16: lsof that finds nothing (exit 1, no output) means no listeners, not a failure', async () => {
  assert.deepEqual(await listListeners(async () => ({ code: 1, stdout: '', stderr: '' })), []);
  await assert.rejects(listListeners(async () => ({ code: 1, stdout: '', stderr: 'lsof: permission denied' })), /permission denied/);
  await assert.rejects(listListeners(async () => ({ code: 2, stdout: '', stderr: '' })), /exit 2/);
});

// ── ADR-0017: layout and consoles are remembered, and a bad value never breaks the window ──

test('ADR-0017: layout and per-service consoles merge with defaults and clamp what they cannot hold', () => {
  const d = merge({});
  assert.deepEqual(d.layout, { sidebar: 'expanded', header: 'compact', console: { open: false, width: 440 } });
  assert.deepEqual(d.consoles, {});
  const s = merge({
    layout: { sidebar: 'collapsed', header: 'full', console: { open: true, width: 99999 } },
    consoles: { 'a.default': { runtime: 'codex', folder: '/tmp/a' }, 'b.default': { runtime: 7, folder: 'relative/path' }, 'bad key': { runtime: 'claude', folder: null } },
  } as never);
  assert.deepEqual(s.layout, { sidebar: 'collapsed', header: 'full', console: { open: true, width: 1600 } });
  assert.deepEqual(s.consoles, { 'a.default': { runtime: 'codex', folder: '/tmp/a' }, 'b.default': { runtime: null, folder: null } });
  assert.equal(merge({ layout: { console: { width: 10 } } } as never).layout.console.width, 320);
});

test('ADR-0017: an update of one console or one layout field keeps the others', () => {
  const dir = tmp('fd-settings-layout-');
  const store = new SettingsStore(dir);
  store.update({ consoles: { 'a.default': { runtime: 'claude', folder: '/tmp/a' } } });
  store.update({ consoles: { 'b.default': { runtime: 'codex', folder: null } } });
  store.update({ layout: { sidebar: 'collapsed' } } as never);
  store.update({ layout: { console: { open: true } } } as never);
  const v = store.get();
  assert.deepEqual(Object.keys(v.consoles).sort(), ['a.default', 'b.default']);
  assert.deepEqual(v.layout, { sidebar: 'collapsed', header: 'compact', console: { open: true, width: 440 } });
});

test('ADR-0017 REQ-02: the compact bar carries the first problem — a state that is not ready, else a failed action still news', async () => {
  const { problemOf, NEWS_MS } = await import('../src/core/focus');
  const now = Date.parse('2026-10-06T12:00:00Z');
  const base = { state: 'ready' as const, reasons: [], lastAction: null, busy: null };
  assert.equal(problemOf(base, now), null);
  assert.deepEqual(problemOf({ ...base, state: 'down', reasons: [{ code: 'reason.down', params: { since: 'x' } }, { code: 'reason.other' }] }, now), { code: 'reason.down', params: { since: 'x' } });
  assert.deepEqual(problemOf({ ...base, state: 'degraded', reasons: [] }, now), { code: 'state.degraded' }, 'a problem state with no reason still shows');
  const failed = { action: 'restart', ok: false, reason: { code: 'result.notBack' }, at: new Date(now - 60_000).toISOString() };
  assert.deepEqual(problemOf({ ...base, lastAction: failed }, now), { code: 'result.notBack' });
  assert.equal(problemOf({ ...base, lastAction: { ...failed, at: new Date(now - NEWS_MS - 1).toISOString() } }, now), null, 'old news is gone');
  assert.equal(problemOf({ ...base, state: 'down', reasons: [{ code: 'reason.down' }], busy: 'restarting' as never }, now), null, 'a running action shows its progress instead');
  assert.equal(problemOf({ ...base, state: 'starting', reasons: [{ code: 'reason.waiting' }] }, now), null, 'starting is not a problem');
});

test('LC-16: the switch stops automatic checks; a check the person asks for always runs; busy states never stack', async () => {
  const { mayCheck } = await import('../src/core/version');
  assert.equal(mayCheck({ manual: false, enabled: true, state: 'idle' }), true);
  assert.equal(mayCheck({ manual: false, enabled: false, state: 'idle' }), false, 'off: nothing automatic');
  assert.equal(mayCheck({ manual: true, enabled: false, state: 'idle' }), true, 'Check for Updates works with it off');
  assert.equal(mayCheck({ manual: false, enabled: true, state: 'error' }), true, 'a failed check is retried');
  for (const state of ['checking', 'downloading', 'ready', 'unsupported', 'misplaced']) assert.equal(mayCheck({ manual: true, enabled: true, state }), false, state);
  assert.equal(mayCheck({ manual: false, enabled: true, state: 'held' }), false, 'a held release is not downloaded again by the timer');
  assert.equal(mayCheck({ manual: true, enabled: true, state: 'held' }), true, 'the person may look for a newer one');
});

test('LC-16: a downloaded update installs only if it is the announced, newer version signed by the organization', async () => {
  const { stagedRefusal, stagedBundlePath, RELEASE_TEAM, FIRST_CHECK_MS, CHECK_EVERY_MS } = await import('../src/core/version');
  assert.equal(FIRST_CHECK_MS, 90_000);
  assert.equal(CHECK_EVERY_MS, 6 * 3_600_000);
  const ok = { feedVersion: '0.6.1', stagedVersion: '0.6.1', team: RELEASE_TEAM, current: '0.6.0' };
  assert.equal(stagedRefusal(ok), null);
  assert.match(stagedRefusal({ ...ok, stagedVersion: '0.6.2' })!, /announced 0\.6\.1 but the download is 0\.6\.2/);
  assert.match(stagedRefusal({ ...ok, feedVersion: '0.5.9', stagedVersion: '0.5.9' })!, /not newer than 0\.6\.0/, 'an older bundle is refused');
  assert.match(stagedRefusal({ ...ok, team: 'ABCDE12345' })!, /signed by ABCDE12345/);
  assert.match(stagedRefusal({ ...ok, team: null })!, /signed by no team/);
  assert.match(stagedRefusal({ ...ok, stagedVersion: null })!, /carries no version/);
  assert.equal(stagedBundlePath({ updateBundleURL: 'file:///Users/x/Library/Caches/ai.passioncode.fabric-dashboards.ShipIt/update.Ab1/Fabric%20Dashboards.app/' }), '/Users/x/Library/Caches/ai.passioncode.fabric-dashboards.ShipIt/update.Ab1/Fabric Dashboards.app');
  assert.equal(stagedBundlePath({ updateBundleURL: 'https://evil.example/x.app' }), null);
  assert.equal(stagedBundlePath({}), null);
});

test('LC-16: the release SHA256SUMS of 0.6.0 verifies against the pinned organization key; a change to it does not', async () => {
  const v = await import('../src/core/release-verify');
  const dir = path.join(__dirname, 'fixtures/release-0.6.0');
  const sums = fs.readFileSync(path.join(dir, 'SHA256SUMS'));
  const asc = fs.readFileSync(path.join(dir, 'SHA256SUMS.asc'), 'utf8');
  assert.deepEqual(await v.sumsSignedByRelease(sums, asc), { ok: true });
  const tampered = Buffer.from(sums.toString('utf8').replace('d562c397', 'e562c397'));
  assert.equal((await v.sumsSignedByRelease(tampered, asc)).ok, false, 'a changed sum fails the signature');
  const parsed = v.parseSums(sums.toString('utf8'));
  assert.equal(parsed.get(v.zipName('0.6.0')), 'd562c397168f715ae8e55ceb0d06037c38a935c3fb95a247ce335d8ac9c23b45');
  const feed = JSON.parse(fs.readFileSync(path.join(dir, 'update-feed.json'), 'utf8'));
  assert.equal(v.feedNamesOwnRelease(feed, '0.6.0'), true);
  assert.equal(v.feedNamesOwnRelease(feed, '0.6.1'), false, 'a feed naming another release\'s files is refused');
  assert.equal(v.feedNamesOwnRelease({ releases: [{ version: '0.6.0', updateTo: { version: '0.6.0', url: 'https://evil.example/x.zip' } }] }, '0.6.0'), false);
});

test('LC-16: a signature by another key is refused, even a valid one', async () => {
  const v = await import('../src/core/release-verify');
  const openpgp = await import('openpgp');
  const { privateKey, publicKey } = await openpgp.generateKey({ type: 'ecc', curve: 'curve25519', userIDs: [{ name: 'Not the org' }], format: 'armored' });
  const sums = Buffer.from('00'.repeat(32) + '  Fabric-Dashboards-9.9.9-mac.zip\n');
  const signature = await openpgp.sign({ message: await openpgp.createMessage({ binary: sums }), signingKeys: await openpgp.readPrivateKey({ armoredKey: privateKey }), detached: true });
  const r = await v.sumsSignedByRelease(sums, signature as string);
  assert.equal(r.ok, false, 'not the pinned key');
  const r2 = await v.sumsSignedByRelease(sums, signature as string, publicKey);
  assert.equal(r2.ok, false);
  assert.match((r2 as { why: string }).why, /not the organization's/);
});

test('LC-16: the switch is the auto-update file — absent is on, only off is off; an earlier off is carried over once', async () => {
  const { autoUpdateOn, AUTO_UPDATE_FILE } = await import('../src/core/autoupdate');
  const { ALWAYS_KEPT, KEPT_FILES } = await import('../src/core/uninstall');
  const dir = tmp('fd-autoupdate-');
  assert.equal(autoUpdateOn(dir), true, 'absent = on');
  fs.writeFileSync(path.join(dir, AUTO_UPDATE_FILE), 'OFF\n');
  assert.equal(autoUpdateOn(dir), false, 'only the word off turns it off');
  fs.writeFileSync(path.join(dir, AUTO_UPDATE_FILE), 'maybe');
  assert.equal(autoUpdateOn(dir), true, 'anything else is on');
  // The settings view reads and writes the file, not settings.json.
  const store = new SettingsStore(dir);
  store.update({ autoUpdate: false });
  assert.equal(fs.readFileSync(path.join(dir, AUTO_UPDATE_FILE), 'utf8').trim(), 'off');
  assert.equal(new SettingsStore(dir).get().autoUpdate, false);
  store.update({ autoUpdate: true });
  assert.equal(new SettingsStore(dir).get().autoUpdate, true);
  // A copy that switched updates off before the file existed keeps that choice.
  const old = tmp('fd-autoupdate-old-');
  fs.writeFileSync(path.join(old, 'settings.json'), JSON.stringify({ autoUpdate: false }));
  assert.equal(new SettingsStore(old).get().autoUpdate, false);
  assert.equal(fs.readFileSync(path.join(old, AUTO_UPDATE_FILE), 'utf8').trim(), 'off');
  // An uninstall never writes it: kept with the settings, and kept even when the person deletes them.
  assert.ok((KEPT_FILES as readonly string[]).includes(AUTO_UPDATE_FILE));
  assert.deepEqual([...ALWAYS_KEPT], [AUTO_UPDATE_FILE]);
});

// #region l10n — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
test('L10N-01: the system language decides; the switch overrides; unknown values follow the system', async () => {
  const { chooseLang } = await import('../src/core/i18n');
  assert.equal(chooseLang('system', 'ru-RU'), 'ru');
  assert.equal(chooseLang('system', 'ru'), 'ru');
  assert.equal(chooseLang('system', 'en-US'), 'en');
  assert.equal(chooseLang('system', ''), 'en');
  assert.equal(chooseLang('system', undefined), 'en');
  assert.equal(chooseLang('en', 'ru-RU'), 'en', 'English chosen on a Russian Mac');
  assert.equal(chooseLang('ru', 'en-US'), 'ru', 'Русский chosen on an English Mac');
  assert.equal(chooseLang('de', 'ru-RU'), 'ru', 'an unknown stored value follows the system');
  
  assert.equal(merge({ language: 'de' } as never).language, 'system');
  assert.equal(merge({ language: 'ru' } as never).language, 'ru');
});

test('L10N-05: Russian follows the organization glossary (Терминал, Завершить, the update labels)', async () => {
  const { t } = await import('../src/core/i18n');
  assert.equal(t('ru', 'settings.autoUpdate'), 'Устанавливать обновления автоматически');
  assert.equal(t('en', 'settings.autoUpdate'), 'Install updates automatically');
  assert.equal(t('ru', 'update.restart'), 'Перезапустить для обновления');
  assert.equal(t('ru', 'tray.quit'), 'Завершить');
  assert.match(t('ru', 'console.openTerminal'), /Терминале/);
  const { dictionary } = await import('../src/core/i18n');
  const ru = Object.entries(dictionary('ru'));
  assert.deepEqual(ru.filter(([, v]) => /\bTerminal\b|\bKeychain\b|System Settings/.test(v)).map(([k]) => k), [], 'macOS names in Russian');
  assert.deepEqual(ru.filter(([, v]) => /логин|залогин|учётн(ая|ой) запис/i.test(v)).map(([k]) => k), [], 'аккаунт, войти — not логин or учётная запись');
});

test('FD-19: machine reasons read in Russian where they are known, and stay as written where not', async () => {
  const { machineRu } = await import('../src/core/machine-ru');
  assert.equal(machineRu('connect ECONNREFUSED 127.0.0.1:8787'), 'соединение отклонено (127.0.0.1:8787)');
  // FD-37
  assert.equal(machineRu('the token file C:\\x\\t is outside your user profile, so Windows does not keep it private to you'), 'файл токена C:\\x\\t лежит вне вашего профиля, поэтому Windows не защищает его от других');
  assert.equal(machineRu('Opening a terminal window is not available on this system yet.'), 'Открыть окно терминала в этой системе пока нельзя.');
  assert.equal(machineRu('the token file ~/t grants access to S-1-1-0, but only you, SYSTEM and Administrators may hold it'), 'файл токена ~/t даёт доступ S-1-1-0, а доступ допустим только у вас, SYSTEM и администраторов');
  assert.equal(machineRu('missing origin; protocol must be fabric-service/0.1, not x'), 'нет поля origin; protocol должен быть fabric-service/0.1, а не x');
  assert.equal(machineRu('the token file ~/t is readable by others; set mode 0600'), 'файл токена ~/t доступен другим; поставьте права 0600', 'one sentence with a "; " inside');
  assert.equal(machineRu('the usage report is malformed: days is not a list of at most 31'), 'отчёт о расходах некорректен: days — не список не длиннее 31');
  assert.equal(machineRu('something nobody wrote down'), 'something nobody wrote down');
  const { t } = await import('../src/core/i18n');
  assert.equal(t('ru', 'update.error', { error: 'socket hang up' }).includes('соединение оборвалось'), true, 'a machine parameter is translated by t()');
  assert.equal(t('en', 'update.error', { error: 'socket hang up' }).includes('socket hang up'), true);
});
// #endregion l10n

test('LC-16 (fabric-inbox 95af4f7): the version and the needs-a-person mark come from the release\'s signed feed', async () => {
  const { signedFeed, parseSums } = await import('../src/core/release-verify');
  const dir = path.join(__dirname, 'fixtures/release-0.6.0');
  const feed = fs.readFileSync(path.join(dir, 'update-feed.json'));
  const sums = parseSums(fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8'));
  assert.deepEqual(signedFeed(feed, sums, '0.6.0'), { ok: true, needsPerson: null }, 'the real v0.6.0 feed matches its signed SHA256SUMS');
  const held = Buffer.from(JSON.stringify({ ...JSON.parse(feed.toString('utf8')), needsPerson: 'https://example.com/steps' }));
  const r = signedFeed(held, sums, '0.6.0');
  assert.equal(r.ok, false, 'a needsPerson mark added after signing is refused');
  assert.match(!r.ok ? r.why : '', /has sha256 .* SHA256SUMS says/);
  assert.match((signedFeed(feed, sums, '0.6.1') as { why: string }).why, /announces 0\.6\.0/, 'a feed for another version is refused');
  assert.match((signedFeed(feed, new Map(), '0.6.0') as { why: string }).why, /names no update-feed\.json/);
  const withSteps = Buffer.from(JSON.stringify({ ...JSON.parse(feed.toString('utf8')), needsPerson: 'https://example.com/steps' }));
  const signedSteps = new Map(sums); signedSteps.set('update-feed.json', (await import('../src/core/release-verify')).sha256(withSteps));
  assert.deepEqual(signedFeed(withSteps, signedSteps, '0.6.0'), { ok: true, needsPerson: 'https://example.com/steps' });
  const httpSteps = Buffer.from(JSON.stringify({ ...JSON.parse(feed.toString('utf8')), needsPerson: 'javascript:alert(1)' }));
  const signedHttp = new Map(sums); signedHttp.set('update-feed.json', (await import('../src/core/release-verify')).sha256(httpSteps));
  assert.deepEqual(signedFeed(httpSteps, signedHttp, '0.6.0'), { ok: true, needsPerson: null }, 'only an https address counts as steps');
});

test('LC-16 (FD-29): the feed Squirrel reads names the verified zip on this disk — nothing is fetched twice', async () => {
  const { localFeed } = await import('../src/core/release-verify');
  const zip = 'file:///Users/x/Library/Caches/ai.passioncode.fabric-dashboards/verified-update/Fabric-Dashboards-0.6.5-mac.zip';
  const feed = JSON.parse(localFeed('0.6.5', zip, { notes: 'the notes', pub_date: '2026-10-07T00:00:00.000Z' })) as {
    currentRelease?: unknown;
    releases?: { version?: unknown; updateTo?: { version?: unknown; name?: unknown; notes?: unknown; pub_date?: unknown; url?: unknown } }[];
  };
  assert.equal(feed.currentRelease, '0.6.5');
  assert.equal(feed.releases?.length, 1);
  const to = feed.releases![0]!.updateTo!;
  assert.equal(to.version, '0.6.5');
  assert.equal(to.name, '0.6.5');
  assert.equal(to.url, zip, 'Squirrel stages the verified file, not a network copy');
  assert.ok(to.url.startsWith('file://'));
  assert.equal(to.notes, 'the notes', 'the signed feed\'s notes carry over for Squirrel\'s "what\'s new"');
  assert.equal(to.pub_date, '2026-10-07T00:00:00.000Z');
  const bare = JSON.parse(localFeed('0.6.5', zip)) as { releases?: { updateTo?: { notes?: unknown; pub_date?: unknown } }[] };
  assert.equal(bare.releases![0]!.updateTo!.notes, '');
  assert.ok(!Number.isNaN(Date.parse(bare.releases![0]!.updateTo!.pub_date as string)), 'pub_date always parses');
  assert.throws(() => localFeed('0.6.5', 'https://github.com/passioncode-ai/fabric-dashboards/releases/download/v0.6.5/Fabric-Dashboards-0.6.5-mac.zip'), /on this disk/, 'a remote address never goes into the local feed');
});

test('FD-31: a launch steps aside only while ShipIt installs a newer build', async () => {
  const { stepAsideForInstall, launchdJobRunning } = await import('../src/core/version');
  assert.equal(stepAsideForInstall({ stagedVersion: '0.6.2', running: '0.5.6', shipItRunning: true }), true, 'the 2026-10-07 case');
  assert.equal(stepAsideForInstall({ stagedVersion: '0.6.2', running: '0.5.6', shipItRunning: false }), false, 'a failed install leaves no ShipIt: start normally');
  assert.equal(stepAsideForInstall({ stagedVersion: '0.6.2', running: '0.6.2', shipItRunning: true }), false, 'Squirrel relaunching the new build starts normally');
  assert.equal(stepAsideForInstall({ stagedVersion: '0.6.1', running: '0.6.2', shipItRunning: true }), false, 'an older staged build never holds a launch');
  assert.equal(stepAsideForInstall({ stagedVersion: null, running: '0.6.2', shipItRunning: true }), false);
  assert.equal(launchdJobRunning('{\n\t"LimitLoadToSessionType" = "Aqua";\n\t"Label" = "ai.passioncode.fabric-dashboards.ShipIt";\n\t"PID" = 94300;\n};'), true);
  assert.equal(launchdJobRunning('{\n\t"Label" = "ai.passioncode.fabric-dashboards.ShipIt";\n\t"LastExitStatus" = 0;\n};'), false, 'loaded, not running');
  assert.equal(launchdJobRunning(''), false, 'no such job');
  const { t } = await import('../src/core/i18n');
  assert.match(t('ru', 'update.installing.body'), /откроется само/);
});
