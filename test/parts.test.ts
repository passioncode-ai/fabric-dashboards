import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ActivityStore } from '../src/core/activity';
import { atomicWrite } from '../src/core/fsutil';
import { allKeys, dictionary, duration, langFor, t } from '../src/core/i18n';
import { parseLsof, unattributed } from '../src/core/listeners';
import { inQuietHours, shouldNotify } from '../src/core/notify';
import { merge, SettingsStore } from '../src/core/settings';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/types';
import { clampRect, navigation, partitionFor, resolveLink, routeLink } from '../src/electron/policy';
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
