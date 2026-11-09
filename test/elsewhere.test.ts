// FD-132: an agent this machine's placement record puts on the other machine. Silent here it is off, never down
// and never announced; answering here it is a second copy; Start is refused before launchctl runs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Descriptor, Placement, RunResult, WellKnown, WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { ActivityStore } from '../src/core/activity';
import { Launchd } from '../src/core/launchd';
import { Monitor, type Notice } from '../src/core/monitor';
import { DOWN_NOTIFY_AFTER_MS } from '../src/core/notify';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { tmp } from './helpers';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const DESCRIPTOR = fixture('positive_service-descriptor.json') as Descriptor;
const READY: WellKnown = { ...(fixture('positive_service-well-known.json') as WellKnown), status: 'ready', degraded: [] };
const KEY = `${DESCRIPTOR.id}.${DESCRIPTOR.instance}`;
const T0 = Date.parse('2026-10-28T12:00:00Z');
const MISS: WellKnownResult = { kind: 'no-answer', detail: 'connect ECONNREFUSED' };
const PLACED: Placement = { machine: 'studio-1', updatedAt: null, elsewhere: [{ label: DESCRIPTOR.lifecycle.label!, placedOn: 'studio-2' }] };

function rig(answer: WellKnownResult, placement: { get: () => Placement | null; error: string | null }, print?: RunResult) {
  const base = tmp('fd-elsewhere-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  const calls: string[] = [];
  const runner = async (_command: string, args: string[]): Promise<RunResult> => {
    calls.push(args.join(' '));
    if (args[0] === 'print') return print ?? { code: 0, stdout: `pid = ${READY.process.pid}\n`, stderr: '' }; // loaded here, as a restored copy would be
    return { code: 0, stdout: '', stderr: '' };
  };
  const clock = { ms: T0 };
  const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS,
    lang: () => 'en', now: () => clock.ms, launchd: new Launchd(runner, 501), wellKnown: async () => answer, placement });
  const notices: Notice[] = [];
  monitor.on('notify', (n: Notice) => notices.push(n));
  return { monitor, notices, clock, calls };
}

test('FD-132: placed on the other machine and silent here: off here with the machine named, never down, nothing said', async () => {
  const r = rig(MISS, { get: () => PLACED, error: null });
  for (let s = 0; s <= (DOWN_NOTIFY_AFTER_MS / 1000) + 120; s += 30) {
    r.clock.ms = T0 + s * 1000;
    await r.monitor.tick();
  }
  const snap = r.monitor.snapshot(KEY)!;
  assert.equal(snap.state, 'stopped');
  assert.deepEqual(snap.reasons, [{ code: 'reason.elsewhere', params: { machine: 'studio-2' } }]);
  assert.deepEqual(r.notices, [], 'no outage notice for an agent that runs on the other machine');
});

test('FD-132: placed elsewhere yet answering here: a second copy, named as such', async () => {
  const r = rig({ kind: 'answer', doc: READY, ms: 3 }, { get: () => PLACED, error: null });
  await r.monitor.tick();
  const snap = r.monitor.snapshot(KEY)!;
  assert.equal(snap.state, 'duplicate');
  assert.deepEqual(snap.reasons[0], { code: 'reason.duplicate.elsewhere', params: { machine: 'studio-2' } });
});

test('FD-132: Start is refused with the machine named, and launchctl never starts it here', async () => {
  const r = rig(MISS, { get: () => PLACED, error: null });
  await r.monitor.tick();
  const out = await r.monitor.control(KEY, 'start');
  assert.deepEqual(out, { ok: false, reason: { code: 'result.placedElsewhere', params: { name: DESCRIPTOR.name, machine: 'studio-2' } } });
  assert.ok(!r.calls.some((c) => c.startsWith('bootstrap') || c.startsWith('kickstart') || c.startsWith('enable')), r.calls.join('; '));
});

test('FD-132: a record that cannot be used is said once, and the agent reads as placed here', async () => {
  const placement = { get: () => null, error: 'others may write the placement file; set mode 0600' as string | null };
  const r = rig(MISS, placement);
  const said: (string | null)[] = [];
  r.monitor.on('placement-error', (e: string | null) => said.push(e));
  await r.monitor.tick();
  r.monitor.snapshot(KEY);
  r.monitor.snapshot(KEY);
  assert.deepEqual(said, ['others may write the placement file; set mode 0600']);
  assert.notEqual(r.monitor.snapshot(KEY)!.reasons[0]?.code, 'reason.elsewhere');
  placement.error = null;
  r.monitor.snapshot(KEY);
  assert.deepEqual(said, ['others may write the placement file; set mode 0600', null]);
});

test('FD-132: a machine Observatory could not name (placedOn unknown) is said as another machine, in both languages', async () => {
  const { t } = await import('../src/core/i18n');
  for (const lang of ['en', 'ru'] as const) {
    for (const key of ['reason.elsewhere', 'reason.duplicate.elsewhere', 'result.placedElsewhere']) {
      const named = t(lang, key, { name: 'Bot', machine: 'm-studio0001' });
      const unknown = t(lang, key, { name: 'Bot', machine: 'unknown' });
      assert.match(named, /m-studio0001/);
      assert.doesNotMatch(unknown, /unknown|\{machine\}/);
      assert.match(unknown, lang === 'en' ? /another machine/ : /другой машине/);
    }
  }
});

test('FD-196: off here, the sentence says how its dashboard opens here, and names the forward the record gives', async () => {
  const { t } = await import('../src/core/i18n');
  const fwd = 'com.example.example-agent-tunnel';
  for (const lang of ['en', 'ru'] as const) {
    const plain = t(lang, 'reason.elsewhere', { machine: 'studio-2' });
    assert.match(plain, /studio-2/);
    assert.match(plain, lang === 'en' ? /port forward/ : /проброс порта/);
    const named = t(lang, 'reason.elsewhere', { machine: 'studio-2', forward: fwd });
    assert.match(named, /studio-2/);
    assert.ok(named.includes(fwd), named);
    assert.match(named, lang === 'en' ? /not running/ : /не идёт/);
    const unknown = t(lang, 'reason.elsewhere', { machine: 'unknown', forward: fwd });
    assert.ok(unknown.includes(fwd) && !/\bunknown\b|\{machine\}/.test(unknown), unknown);
    assert.match(unknown, lang === 'en' ? /another machine/ : /другой машине/);
  }
  const placed: Placement = { machine: 'studio-1', updatedAt: null, elsewhere: [{ label: DESCRIPTOR.lifecycle.label!, placedOn: 'studio-2', forward: fwd }] };
  const r = rig(MISS, { get: () => placed, error: null });
  await r.monitor.tick();
  assert.deepEqual(r.monitor.snapshot(KEY)!.reasons, [{ code: 'reason.elsewhere', params: { machine: 'studio-2', forward: fwd } }]);
});

test('FD-179: placed elsewhere, answering here, and its own job not loaded here: the placed copy reached through a forwarded port, never a duplicate', async () => {
  // The move leaves an SSH tunnel on the port (seen 2026-11-08): launchd has no job for the label, yet the port answers.
  const r = rig({ kind: 'answer', doc: READY, ms: 3 }, { get: () => PLACED, error: null }, { code: 113, stdout: '', stderr: 'Could not find service' });
  await r.monitor.tick();
  await r.monitor.tick();
  const snap = r.monitor.snapshot(KEY)!;
  assert.equal(snap.state, 'ready', 'the copy it reaches is ready');
  assert.deepEqual(snap.reasons, [{ code: 'reason.reached.elsewhere', params: { machine: 'studio-2' } }]);
});

test('FD-167: a system daemon of this space is read in the system domain, and Start, Stop and Restart are refused before launchctl changes anything', async () => {
  const base = tmp('fd-sysd-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  const calls: string[] = [];
  const runner = async (_command: string, args: string[]): Promise<RunResult> => {
    calls.push(args.join(' '));
    if (args[0] === 'print' && args[1] === `system/${DESCRIPTOR.lifecycle.label}`) return { code: 0, stdout: `pid = ${READY.process.pid}\n`, stderr: '' };
    if (args[0] === 'print') return { code: 113, stdout: '', stderr: 'Could not find service' };
    return { code: 0, stdout: '', stderr: '' };
  };
  const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS,
    lang: () => 'en', now: () => T0, launchd: new Launchd(runner, 501), wellKnown: async () => ({ kind: 'answer', doc: READY, ms: 3 }),
    placement: { get: () => null, error: null }, daemons: { isSystem: (label) => label === DESCRIPTOR.lifecycle.label } });
  await monitor.tick();
  const snap = monitor.snapshot(KEY)!;
  assert.equal(snap.state, 'ready', 'running as root\'s job for this space: not a duplicate, not stopped');
  assert.equal(snap.launchd.domain, 'system');
  assert.ok(calls.includes(`print system/${DESCRIPTOR.lifecycle.label}`));
  assert.ok(!calls.some((c) => c.startsWith('print gui/')), 'never read in gui');
  for (const action of ['start', 'stop', 'restart'] as const) {
    const r = await monitor.control(KEY, action);
    assert.equal(r.ok, false);
    assert.equal(r.reason?.code, 'result.systemDaemon');
  }
  assert.ok(!calls.some((c) => /^(bootstrap|bootout|enable|disable|kickstart)/.test(c)), 'launchctl changed nothing');
});

test('FD-180: a descriptor whose plist is in /Library/LaunchDaemons is read in system and never bootstrapped into gui, with no record', { skip: process.platform === 'win32' && 'a POSIX plist path, which a descriptor on Windows may not name (FD-37)' }, async () => {
  const base = tmp('fd-ld-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const d = { ...DESCRIPTOR, lifecycle: { ...DESCRIPTOR.lifecycle, plist: `/Library/LaunchDaemons/${DESCRIPTOR.lifecycle.label}.plist` } };
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(d));
  const calls: string[] = [];
  const runner = async (_command: string, args: string[]): Promise<RunResult> => {
    calls.push(args.join(' '));
    return args[0] === 'print' ? { code: 113, stdout: '', stderr: 'Could not find service' } : { code: 0, stdout: '', stderr: '' };
  };
  const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS,
    lang: () => 'en', now: () => T0, launchd: new Launchd(runner, 501), wellKnown: async () => MISS,
    placement: { get: () => null, error: null }, daemons: { isSystem: () => false } });
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.launchd.domain, 'system');
  assert.ok(calls.includes(`print system/${DESCRIPTOR.lifecycle.label}`));
  const r = await monitor.control(KEY, 'restart');
  assert.equal(r.reason?.code, 'result.systemDaemon');
  assert.ok(!calls.some((c) => c.startsWith('bootstrap') || c.includes('gui/')), 'nothing in gui, nothing bootstrapped');
});
