// One slow probe is not an outage (ADR-0008). A scripted clock and scripted probe answers drive
// the monitor tick by tick, so each test states exactly which probes failed and when.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import type { Descriptor, RunResult, WellKnown, WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { ActivityStore } from '../src/core/activity';
import { Launchd } from '../src/core/launchd';
import { DOWN_AFTER_MISSES, Monitor, type Notice } from '../src/core/monitor';
import { DOWN_NOTIFY_AFTER_MS } from '../src/core/notify';
import { PROBE_TIMEOUT_MS } from '../src/core/probe';
import { DEFAULT_SETTINGS, type ServiceSnapshot } from '../src/core/types';
import { liveDeps } from '../src/mcp/tools';
import { freePort, tmp } from './helpers';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const DESCRIPTOR = fixture('positive_service-descriptor.json') as Descriptor;
const READY: WellKnown = { ...(fixture('positive_service-well-known.json') as WellKnown), status: 'ready', degraded: [] };
const KEY = 'example-agent.default';
const T0 = Date.parse('2026-10-01T12:00:00Z');
const ANSWER: WellKnownResult = { kind: 'answer', doc: READY, ms: 3 };
const MISS: WellKnownResult = { kind: 'no-answer', detail: `no answer within ${PROBE_TIMEOUT_MS} ms` };

function rig(job: { loaded: boolean; disabled?: boolean; pid?: number } = { loaded: true }, descriptor: Partial<Descriptor> = {}) {
  const base = tmp('fd-flap-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const d = { ...DESCRIPTOR, ...descriptor };
  fs.writeFileSync(path.join(services, `${d.id}.${d.instance}.json`), JSON.stringify(d));
  const runner = async (_command: string, args: string[]): Promise<RunResult> => {
    if (args[0] === 'print-disabled') return { code: 0, stdout: job.disabled ? `"${DESCRIPTOR.lifecycle.label}" => disabled\n` : '', stderr: '' };
    if (args[0] === 'print') return job.loaded ? { code: 0, stdout: `pid = ${job.pid ?? READY.process.pid}\n`, stderr: '' } : { code: 113, stdout: '', stderr: 'Could not find service' };
    return { code: 0, stdout: '', stderr: '' };
  };
  const clock = { ms: T0 };
  const queue: WellKnownResult[] = [];
  const activity = new ActivityStore(path.join(base, 'app'));
  const monitor = new Monitor({
    servicesDir: services, activity, settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => clock.ms,
    launchd: new Launchd(runner, 501),
    wellKnown: async () => {
      const next = queue.shift();
      assert.ok(next, 'a probe ran that the test did not script');
      return next;
    },
  });
  const notices: Notice[] = [];
  monitor.on('notify', (n: Notice) => notices.push(n));
  const states: ServiceSnapshot['state'][] = [];
  /** At `seconds` after T0 the monitor probes once and gets `result`. */
  async function probeAt(seconds: number, result: WellKnownResult): Promise<ServiceSnapshot> {
    clock.ms = T0 + seconds * 1000;
    queue.push(result);
    await monitor.tick();
    assert.equal(queue.length, 0, `the probe at ${seconds} s was due and ran`);
    const snap = monitor.snapshot(KEY)!;
    states.push(snap.state);
    return snap;
  }
  /** At `seconds` the monitor ticks with nothing due; no probe may run. */
  async function idleAt(seconds: number): Promise<void> {
    clock.ms = T0 + seconds * 1000;
    await monitor.tick();
  }
  const kinds = () => activity.list({ serviceKey: KEY }).map((e) => e.kind);
  return { monitor, notices, states, probeAt, idleAt, kinds };
}

test('one slow probe is not an outage: the state stays as it was and nothing is said', async () => {
  const r = rig();
  r.monitor.setVisible(false); // background: 30 s between probes, where one miss used to count double
  assert.equal((await r.probeAt(0, ANSWER)).state, 'ready');
  const missed = await r.probeAt(30, MISS);
  assert.equal(missed.state, 'ready', 'one failed probe keeps the last answer');
  assert.equal(missed.wellKnown?.service.version, '0.2.0');
  // A miss is re-checked at the visible cadence (5 s), not after the background 30 s.
  await r.idleAt(34);
  assert.equal((await r.probeAt(35, ANSWER)).state, 'ready');
  await r.probeAt(65, MISS);
  assert.equal((await r.probeAt(70, MISS)).state, 'ready', `${DOWN_AFTER_MISSES - 1} misses are still not a verdict`);
  assert.equal((await r.probeAt(75, ANSWER)).state, 'ready');
  assert.deepEqual([...new Set(r.states)], ['ready']);
  assert.deepEqual(r.notices, []);
  assert.equal(r.kinds().includes('service.down'), false);
});

test('a flap inside the notification window sends no notification, neither down nor back', async () => {
  const r = rig();
  r.monitor.setVisible(false);
  await r.probeAt(0, ANSWER);
  await r.probeAt(30, MISS);
  await r.probeAt(35, MISS);
  const third = await r.probeAt(40, MISS);
  assert.equal(third.state, 'starting', `${DOWN_AFTER_MISSES} misses inside 15 s of silence wait`);
  const down = await r.probeAt(70, MISS);
  assert.equal(down.state, 'down', 'confirmed: three misses in a row and 40 s of silence');
  assert.equal(down.reasons[0]?.params?.since, new Date(T0 + 30_000).toISOString(), 'the outage counts from the first miss');
  assert.equal(r.notices.length, 0, `no notification before ${DOWN_NOTIFY_AFTER_MS / 1000} s`);
  // Back-off puts the next probe at 110 s; it answers, so no failed probe ever confirmed 60 s.
  await r.idleAt(100);
  assert.equal((await r.probeAt(110, ANSWER)).state, 'ready');
  assert.deepEqual(r.notices, [], 'a back notice only follows a down notice that was sent');
  assert.deepEqual(r.kinds().filter((k) => k === 'service.down' || k === 'service.back').sort(), ['service.back', 'service.down'], 'Activity still records the flap, once each');
});

test('a sustained outage notifies once, and its end once', async () => {
  const r = rig();
  r.monitor.setVisible(false);
  await r.probeAt(0, ANSWER);
  for (const s of [30, 35, 40, 70]) await r.probeAt(s, MISS);
  assert.equal(r.monitor.snapshot(KEY)?.state, 'down');
  assert.equal(r.notices.length, 0, '40 s of silence is not yet worth a notification');
  // A tick without a probe never decides: 65 s have passed, but no probe has failed past 60 s.
  await r.idleAt(95);
  assert.equal(r.notices.length, 0);
  await r.probeAt(110, MISS);
  assert.deepEqual(r.notices.map((n) => n.title), ['Example Agent is not answering']);
  await r.probeAt(170, MISS);
  assert.equal(r.notices.length, 1, 'never twice for one outage');
  await r.probeAt(230, ANSWER);
  assert.deepEqual(r.notices.map((n) => n.title), ['Example Agent is not answering', 'Example Agent is back']);
});

test('a job the operator turned off is Off on the first miss; a stale answer never hides it', async () => {
  const job = { loaded: true, disabled: false };
  const r = rig(job);
  r.monitor.setVisible(true); // the window is open: a probe every 5 s
  await r.probeAt(0, ANSWER);
  job.loaded = false;
  job.disabled = true;
  assert.equal((await r.probeAt(5, MISS)).state, 'stopped');
});

test('a service launchd restarted under a new pid is not shown with the old answer', async () => {
  const job = { loaded: true, pid: READY.process.pid };
  const r = rig(job);
  r.monitor.setVisible(true); // the window is open: a probe every 5 s
  assert.equal((await r.probeAt(0, ANSWER)).state, 'ready');
  // launchd now runs another process and it does not answer yet. Replaying the last answer would
  // name the old pid and read as two copies; the miss shows as waiting instead.
  job.pid = 99_999;
  assert.equal((await r.probeAt(5, MISS)).state, 'starting');
  assert.deepEqual(r.notices, []);
});

test(`a probe that takes longer than 2 s still answers: the probe waits ${PROBE_TIMEOUT_MS / 1000} s, in the window and over MCP`, async () => {
  assert.ok(PROBE_TIMEOUT_MS >= 5000);
  const port = await freePort();
  const server = http.createServer((_req, res) => {
    setTimeout(() => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ...READY, service: { ...READY.service, id: 'runner', instance: 'dev' } })); }, 2500);
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${port}`;
    const viaMcp = await liveDeps().wellKnown(origin);
    assert.equal(viaMcp.kind, 'answer');
    const base = tmp('fd-slow-');
    const services = path.join(base, 'services');
    fs.mkdirSync(services);
    fs.writeFileSync(path.join(services, 'runner.dev.json'), JSON.stringify({ ...fixture('positive_service-descriptor-unmanaged.json'), origin }));
    // A frozen clock makes the first tick's probe due at once; the probe itself is the real one.
    const at = Date.now();
    const monitor = new Monitor({ servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => at });
    await monitor.tick();
    assert.equal(monitor.snapshot('runner.dev')?.state, 'ready');
  } finally {
    server.close();
  }
});

// ── release audit S-5, S-2 ────────────────────────────────────────────────────────────────

test('S-5: another program\'s document is never shown as this service\'s own — no version, tiles or update offer', async () => {
  const r = rig();
  const squatter: WellKnownResult = { kind: 'answer', doc: { ...READY, service: { ...READY.service, id: 'squatter' }, update: { available: '9.9.9' } } as WellKnown, ms: 2 };
  const snap = await r.probeAt(0, squatter);
  assert.equal(snap.state, 'foreign');
  assert.equal(snap.wellKnown, null, 'the squatter\'s version, tiles, tools and summary stay out of the snapshot');
  assert.ok(!snap.reasons.some((x) => x.code === 'reason.update'), 'no "Update to 9.9.9" on another program\'s claim');
});

test('S-2: an online origin that answered as another service gets no token again until the descriptor changes', async () => {
  const base = tmp('fd-remote-foreign-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const tokenFile = path.join(base, 'svc.token');
  fs.writeFileSync(tokenFile, 'tok-0123456789abcdef', { mode: 0o600 });
  const remote = { ...(fixture('positive_service-descriptor-remote.json') as Descriptor), auth: { tokenFile } };
  const file = path.join(services, 'example-agent.default.json');
  fs.writeFileSync(file, JSON.stringify(remote));
  const clock = { ms: T0 };
  const probes: (Record<string, string> | undefined)[] = [];
  let answer: WellKnownResult = { kind: 'answer', doc: { ...READY, service: { ...READY.service, id: 'other' } } as WellKnown, ms: 5 };
  const monitor = new Monitor({
    servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => clock.ms,
    wellKnown: async (_origin, options) => { probes.push(options?.headers as Record<string, string> | undefined); return answer; },
  });
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'foreign');
  assert.equal(probes.length, 1);
  for (const s of [61, 122, 183]) { clock.ms = T0 + s * 1000; await monitor.tick(); }
  assert.equal(probes.length, 1, 'no further probe carries the token to the foreign origin');
  assert.equal(monitor.snapshot(KEY)!.state, 'foreign', 'and the verdict stays');
  // The operator fixes the descriptor (here: a new token file path) — the service is probed again.
  const tokenFile2 = path.join(base, 'svc2.token');
  fs.writeFileSync(tokenFile2, 'tok-fedcba9876543210', { mode: 0o600 });
  fs.writeFileSync(file, JSON.stringify({ ...remote, auth: { tokenFile: tokenFile2 } }));
  answer = { kind: 'answer', doc: READY, ms: 5 };
  clock.ms = T0 + 300_000;
  await monitor.tick(true);
  assert.equal(probes.length, 2, 'a changed descriptor is probed again');
  assert.equal(monitor.snapshot(KEY)!.state, 'ready');
});
