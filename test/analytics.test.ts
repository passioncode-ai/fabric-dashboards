// FD-136 (SCN-091, docs/ANALYTICS.md): anonymous usage and error data, on by default, this product's own switch. A
// fake server stands behind `fetch`; the clock and the timers are the test's.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { cleanProps, createAnalytics, environmentFor, readBundle, readOrCreateInstallation, type AnalyticsDeps } from '../src/core/analytics';
import { merge } from '../src/core/settings';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { tmp } from './helpers';

const BUNDLE = { appKey: 'A-SH-1234567890', host: 'https://analytics.example.test', debug: false };

function rig(o: Partial<AnalyticsDeps> & { status?: number[] } = {}) {
  const dir = tmp('fd-analytics-');
  const sent: { url: string; body: Record<string, unknown>[]; headers: Record<string, string> }[] = [];
  const statuses = [...(o.status ?? [])];
  let enabled = true;
  let clock = Date.parse('2026-11-04T10:00:00Z');
  const timers: (() => void)[] = [];
  const a = createAnalytics({
    bundle: BUNDLE, appVersion: '0.8.19', packaged: true, osName: 'macOS', osVersion: '26.0', locale: 'en-US', engineVersion: '44.0.0',
    installationFile: path.join(dir, 'PassionCode', 'installation.json'), stateFile: path.join(dir, 'app', 'analytics-state.json'),
    enabled: () => enabled, now: () => new Date(clock), setTimer: (fn) => { timers.push(fn); return timers.length; }, clearTimer: () => { timers.length = 0; },
    fetch: async (url, init) => { sent.push({ url, body: JSON.parse(init.body), headers: init.headers }); return { status: statuses.shift() ?? 200 }; },
    ...o,
  });
  const run = async () => { while (timers.length) { timers.shift()!(); await new Promise((r) => setImmediate(r)); } await a.flush(); };
  return { a, dir, sent, run, setEnabled: (v: boolean) => { enabled = v; }, tick: (ms: number) => { clock += ms; } };
}
const events = (sent: { body: Record<string, unknown>[] }[]) => sent.flatMap((s) => s.body);
const names = (sent: { body: Record<string, unknown>[] }[]) => events(sent).map((e) => e.eventName);

test('FD-136: a build without an App Key sends nothing and makes no shared file', async () => {
  const r = rig({ bundle: null });
  r.a.started('ordinary', { agents_local: 3 });
  await r.run();
  assert.equal(r.a.availability(), 'unavailable-no-key');
  assert.equal(r.sent.length, 0);
  assert.equal(fs.existsSync(path.join(r.dir, 'PassionCode', 'installation.json')), false);
});

test('FD-136: on by default, the first start counts the install once, the start, with the shared id and the environment', async () => {
  const r = rig();
  r.a.started('login', { agents_local: 3, agents_online: 2 });
  await r.run();
  assert.deepEqual(names(r.sent), ['app_installed', 'app_started']);
  const [installed, started] = events(r.sent) as { props: Record<string, unknown>; systemProps: Record<string, unknown> }[];
  const id = JSON.parse(fs.readFileSync(path.join(r.dir, 'PassionCode', 'installation.json'), 'utf8')).id;
  assert.equal(installed!.props.first_passioncode_app, true);
  assert.deepEqual(started!.props, { launch: 'login', agents_local: 3, agents_online: 2, install_id: id, iid: id, environment: 'production' });
  assert.equal(started!.systemProps.isDebug, false);
  assert.equal(started!.systemProps.sdkVersion, 'fabric-dashboards-analytics@1');
  assert.equal(r.sent[0]!.url, 'https://analytics.example.test/api/v0/events');
  assert.equal(r.sent[0]!.headers['App-Key'], BUNDLE.appKey);
  r.a.started('ordinary');
  await r.run();
  assert.deepEqual(names(r.sent).slice(2), ['app_started'], 'the install is counted once');
});

test('FD-136: a new version is counted as an update from the one that ran before', async () => {
  const r = rig();
  r.a.started('ordinary');
  await r.run();
  const next = rig({ installationFile: path.join(r.dir, 'PassionCode', 'installation.json'), stateFile: path.join(r.dir, 'app', 'analytics-state.json'), appVersion: '0.8.20' });
  next.a.started('ordinary');
  await next.run();
  assert.deepEqual(names(next.sent), ['app_updated', 'app_started']);
  assert.equal((events(next.sent)[0] as { props: Record<string, unknown> }).props.from, '0.8.19');
});

test('FD-136: off is off: nothing is queued or sent, and what waits is dropped', async () => {
  const r = rig({ status: [503] });
  r.a.started('ordinary');
  await r.a.flush();
  assert.ok(r.a.pending() > 0, 'kept after a 503');
  r.setEnabled(false);
  r.a.switched(false);
  assert.equal(r.a.pending(), 0);
  r.a.started('ordinary');
  r.a.error('main', 'TypeError');
  await r.run();
  assert.equal(r.sent.length, 1, 'only the refused send went out');
  assert.equal(r.a.availability(), 'off');
});

test('FD-136: 429 and 5xx keep the batch for a later try; 400 and 404 drop it', async () => {
  const kept = rig({ status: [429, 200] });
  kept.a.started('ordinary');
  await kept.a.flush();
  assert.ok(kept.a.pending() > 0);
  await kept.run();
  assert.equal(kept.a.pending(), 0);
  const dropped = rig({ status: [404] });
  dropped.a.started('ordinary');
  await dropped.a.flush();
  assert.equal(dropped.a.pending(), 0);
});

test('FD-136: a crash is counted once per launch for where and code; anything that could name something is dropped', async () => {
  const r = rig();
  r.a.error('main', 'ENOENT');
  r.a.error('main', 'ENOENT');
  r.a.error('renderer', 'crashed');
  r.a.error('main', 'a sentence with spaces and a / slash');
  await r.run();
  const errors = events(r.sent).filter((e) => e.eventName === 'app_error').map((e) => (e as { props: Record<string, unknown> }).props);
  assert.deepEqual(errors.map((p) => [p.where, p.code]), [['main', 'ENOENT'], ['renderer', 'crashed'], ['main', 'unknown']]);
  assert.deepEqual(cleanProps({ name: 'Agent of experiments', path: 'some/dir/file', count: 3, ok: true, launch: 'ordinary', Bad: 1 }), { count: 3, ok: true, launch: 'ordinary' });
});

test('FD-136: one app_active a UTC day', async () => {
  const r = rig();
  r.a.activeTick({ agents_local: 1 });
  r.a.activeTick({ agents_local: 1 });
  await r.run();
  r.tick(24 * 3600_000);
  r.a.activeTick({ agents_local: 1 });
  await r.run();
  assert.deepEqual(names(r.sent), ['app_active', 'app_active']);
});

test('FD-136: a shared file that cannot be read is never repaired; events go without an id', async () => {
  const r = rig();
  fs.mkdirSync(path.join(r.dir, 'PassionCode'), { recursive: true });
  fs.writeFileSync(path.join(r.dir, 'PassionCode', 'installation.json'), 'not json');
  r.a.started('ordinary');
  await r.run();
  assert.equal(fs.readFileSync(path.join(r.dir, 'PassionCode', 'installation.json'), 'utf8'), 'not json');
  assert.ok(events(r.sent).every((e) => !('iid' in (e as { props: object }).props)));
  assert.equal(readOrCreateInstallation(path.join(r.dir, 'PassionCode', 'installation.json'), () => new Date()), null);
});

test('FD-136: another app\'s shared switch no longer turns this product off (B-200)', async () => {
  const r = rig();
  fs.mkdirSync(path.join(r.dir, 'PassionCode'), { recursive: true });
  fs.writeFileSync(path.join(r.dir, 'PassionCode', 'installation.json'), JSON.stringify({ version: 1, id: '4f2c1a9e-7b3d-4c5e-9a1b-2c3d4e5f6a7b', analytics: false, created_at: 1 }));
  r.a.started('ordinary');
  await r.run();
  assert.deepEqual(names(r.sent), ['app_installed', 'app_started']);
  assert.equal((events(r.sent)[0] as { props: Record<string, unknown> }).props.first_passioncode_app, false);
});

test('FD-136: the bundle, the environment rule and the settings default', () => {
  assert.deepEqual(readBundle(JSON.stringify(BUNDLE)), BUNDLE);
  assert.equal(readBundle(JSON.stringify({ ...BUNDLE, host: 'http://analytics.example.test' })), null);
  assert.equal(readBundle(JSON.stringify({ ...BUNDLE, appKey: 'secret' })), null);
  assert.equal(readBundle('nope'), null);
  assert.equal(environmentFor('0.8.19', true, false), 'production');
  assert.equal(environmentFor('0.8.19-rc.1', true, false), 'sandbox');
  assert.equal(environmentFor('0.8.19', false, false), 'sandbox');
  assert.equal(environmentFor('0.8.19', true, true), 'sandbox');
  assert.equal(DEFAULT_SETTINGS.analytics, true);
  assert.equal(merge({}).analytics, true, 'an earlier settings file turns it on (the operator: on for installs already out)');
  assert.equal(merge({ analytics: false } as never).analytics, false);
  assert.equal(merge({}).analyticsNoticeSeen, false);
});

test('FD-141: an action that did not succeed is counted once per launch for its action and code, never its message', async () => {
  const r = rig();
  r.a.failed('start', 'result.placedElsewhere');
  r.a.failed('start', 'result.placedElsewhere');
  r.a.failed('update', 'exit_1');
  r.a.failed('console', 'admission_disk');
  r.a.failed('self_update', 'the server said: no such release at https://example.test/x');
  await r.run();
  const failed = events(r.sent).filter((e) => e.eventName === 'action_failed').map((e) => (e as { props: Record<string, unknown> }).props);
  assert.deepEqual(failed.map((p) => [p.action, p.code]), [['start', 'result.placedElsewhere'], ['update', 'exit_1'], ['console', 'admission_disk'], ['self_update', 'unknown']]);
  r.setEnabled(false);
  r.a.failed('rename', 'no-gh');
  await r.run();
  assert.equal(events(r.sent).filter((e) => e.eventName === 'action_failed').length, 4, 'off sends nothing');
});

