// FD-158 (the contract's draft norm on loopback owners): on a Mac with several macOS users, an agent's port answered by
// another user's process is `foreign-user`: never this agent's state, document or events, and said once.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { setLoopbackOwnerCheck, type Descriptor, type RunResult, type WellKnown } from '@passioncode-ai/fabric-service-host';
import { ActivityStore } from '../src/core/activity';
import { Launchd } from '../src/core/launchd';
import { Monitor, type Notice } from '../src/core/monitor';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { tmp } from './helpers';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const DESCRIPTOR = fixture('positive_service-descriptor.json') as Descriptor;
const READY: WellKnown = { ...(fixture('positive_service-well-known.json') as WellKnown), status: 'ready', degraded: [] };
const KEY = `${DESCRIPTOR.id}.${DESCRIPTOR.instance}`;

test("FD-158: another macOS user's copy answering on the agent's port reads foreign-user, its document hidden, said once", async (t) => {
  const base = tmp('fd-foreign-user-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  const runner = async (): Promise<RunResult> => ({ code: 0, stdout: '', stderr: '' });
  const clock = { ms: Date.parse('2026-11-06T00:00:00Z') };
  let ours = true;
  setLoopbackOwnerCheck(async () => ours);
  t.after(() => setLoopbackOwnerCheck(null));
  const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS,
    lang: () => 'en', now: () => clock.ms, launchd: new Launchd(runner, 501), wellKnown: async () => ({ kind: 'answer', doc: READY, ms: 3 }) });
  const notices: Notice[] = [];
  monitor.on('notify', (n: Notice) => notices.push(n));
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'ready', 'its own copy reads as itself');
  ours = false; // it stopped, and another user's copy took the port
  clock.ms += 30_000;
  await monitor.tick();
  clock.ms += 30_000;
  await monitor.tick();
  const snap = monitor.snapshot(KEY)!;
  assert.equal(snap.state, 'foreign-user');
  assert.equal(snap.reasons[0]?.code, 'reason.foreign.user');
  assert.equal(snap.wellKnown, null, "the other user's document is never shown as this agent's");
  assert.deepEqual(notices.map((n) => n.title), [`Another user's program on ${DESCRIPTOR.name}'s port`], 'said once');
  ours = true;
  clock.ms += 30_000;
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'ready', 'its own copy back on the port reads as itself again');
});

test('FD-201: an owner unknown for one read is not another user: the agent stays itself and nothing is said; unknown for 15 s reads foreign-user', async (t) => {
  const base = tmp('fd-201-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  const runner = async (): Promise<RunResult> => ({ code: 0, stdout: '', stderr: '' });
  const clock = { ms: Date.parse('2026-11-11T00:00:00Z') };
  let owner: boolean | 'unknown' = true;
  setLoopbackOwnerCheck(async () => owner);
  t.after(() => setLoopbackOwnerCheck(null));
  const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS,
    lang: () => 'en', now: () => clock.ms, launchd: new Launchd(runner, 501), wellKnown: async () => ({ kind: 'answer', doc: READY, ms: 3 }) });
  const notices: Notice[] = [];
  monitor.on('notify', (n: Notice) => notices.push(n));
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'ready');
  // A restart of its launchd job: the pid netstat named has exited by the time ps is asked, so the owner reads unknown once.
  owner = 'unknown';
  clock.ms += 30_000;
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'ready', 'one unknown read is not a verdict');
  owner = true;
  clock.ms += 6_000;
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'ready');
  assert.deepEqual(notices, [], 'nothing is said about a read that was told the next time');
  // Still unknown after the confirmation time: now it is said, in the words that it cannot be told.
  owner = 'unknown';
  clock.ms += 30_000;
  await monitor.tick();
  clock.ms += 16_000;
  await monitor.tick();
  const snap = monitor.snapshot(KEY)!;
  assert.equal(snap.state, 'foreign-user');
  assert.equal(snap.reasons[0]?.code, 'reason.foreign.unknown');
});
