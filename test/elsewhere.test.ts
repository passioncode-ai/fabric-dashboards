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

function rig(answer: WellKnownResult, placement: { get: () => Placement | null; error: string | null }) {
  const base = tmp('fd-elsewhere-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  const calls: string[] = [];
  const runner = async (_command: string, args: string[]): Promise<RunResult> => {
    calls.push(args.join(' '));
    if (args[0] === 'print') return { code: 0, stdout: `pid = ${READY.process.pid}\n`, stderr: '' }; // loaded here, as a restored copy would be
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
