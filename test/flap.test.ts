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
  const monitor = new Monitor({ platform: 'darwin',
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
    const monitor = new Monitor({ platform: 'darwin', servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => at });
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
  const monitor = new Monitor({ platform: 'darwin',
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

// ── release audit R-8, R-18 ───────────────────────────────────────────────────────────────

test('R-8: a new pid between two probes is a restart even when the state stays ready', async () => {
  const job = { loaded: true, pid: READY.process.pid };
  const r = rig(job);
  const restarted: string[] = [];
  r.monitor.on('restarted', (k: string) => restarted.push(k));
  await r.probeAt(0, ANSWER);
  assert.deepEqual(restarted, []);
  job.pid = 5151; // launchd restarted it between two probes
  const again: WellKnownResult = { kind: 'answer', doc: { ...READY, process: { ...READY.process, pid: 5151 } }, ms: 3 };
  const snap = await r.probeAt(30, again);
  assert.equal(snap.state, 'ready');
  assert.deepEqual(restarted, [KEY], 'ready → ready with a new pid tells the page to offer Reload');
});

test('R-8: one action at a time — a second command while one runs is refused, not run twice', async () => {
  const r = rig({ loaded: true }, { commands: { doctor: ['/bin/sleep', '0.3'] } });
  await r.probeAt(0, ANSWER);
  const first = r.monitor.command(KEY, 'doctor');
  const second = await r.monitor.command(KEY, 'doctor');
  assert.equal(second.code, null);
  assert.match(second.refused ?? '', /busy/);
  assert.equal((await first).code, 0);
});

test('R-18: a launchd service not yet probed reads starting, never Off with Start', async () => {
  const base = tmp('fd-unprobed-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  fs.writeFileSync(path.join(services, `${KEY}.json`), JSON.stringify(DESCRIPTOR));
  let release: (r: WellKnownResult) => void = () => undefined;
  const monitor = new Monitor({ platform: 'darwin',
    servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => T0,
    launchd: new Launchd(async () => ({ code: 0, stdout: `pid = ${READY.process.pid}\n`, stderr: '' }), 501),
    wellKnown: () => new Promise<WellKnownResult>((resolve) => { release = resolve; }),
  });
  const ticking = monitor.tick(true);
  await new Promise((r) => setTimeout(r, 20)); // the scan is done, the first probe is in flight
  const before = monitor.snapshot(KEY)!;
  assert.equal(before.state, 'starting', 'not "Off — the launchd job is not loaded"');
  assert.deepEqual(before.reasons.map((x) => x.code), ['reason.waiting']);
  release(ANSWER);
  await ticking;
  assert.equal(monitor.snapshot(KEY)!.state, 'ready');
});

test('P-4: a command that cannot start says so, not "exit code —"; an undeclared one is refused', async () => {
  const r = rig({ loaded: true }, { commands: { doctor: ['/nonexistent/doctor-binary'] } });
  await r.probeAt(0, ANSWER);
  const out = await r.monitor.command(KEY, 'doctor');
  assert.equal(out.code, null);
  assert.equal(out.timedOut, false);
  assert.equal(r.monitor.snapshot(KEY)!.lastAction!.reason.code, 'result.commandFailed');
  const none = await r.monitor.command(KEY, 'update');
  assert.match(none.refused ?? '', /declares no Update command/);
});

// ── third review pass T-2, T-5 ────────────────────────────────────────────────────────────

test('T-2: an online origin answering without the protocol gets no token until it asks for one again', async () => {
  const base = tmp('fd-remote-np-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const tokenFile = path.join(base, 'svc.token');
  fs.writeFileSync(tokenFile, 'tok-0123456789abcdef', { mode: 0o600 });
  const remote = { ...(fixture('positive_service-descriptor-remote.json') as Descriptor), auth: { tokenFile } };
  fs.writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify(remote));
  const clock = { ms: T0 };
  const sent: boolean[] = [];
  const queue: WellKnownResult[] = [
    { kind: 'not-protocol', detail: 'HTTP 404 on /.well-known/fabric-service' },
    { kind: 'not-protocol', detail: 'HTTP 404 on /.well-known/fabric-service' },
    { kind: 'refused', detail: 'HTTP 401 on /.well-known/fabric-service' },
    { kind: 'answer', doc: READY, ms: 5 },
  ];
  const monitor = new Monitor({ platform: 'darwin',
    servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => clock.ms,
    wellKnown: async (_origin, options) => { sent.push(Boolean(options?.headers)); return queue.shift()!; },
  });
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'foreign');
  clock.ms = T0 + 61_000;
  await monitor.tick();
  assert.equal(monitor.snapshot(KEY)!.state, 'foreign');
  assert.deepEqual(sent, [true, false], 'the second probe went without the token');
  clock.ms = T0 + 122_000;
  await monitor.tick();
  assert.deepEqual(sent, [true, false, false, true], 'a 401 asks for the token again: the same probe repeats with it');
  assert.equal(monitor.snapshot(KEY)!.state, 'ready');
});

test('T-5: an online service answering from another replica is not a restart', async () => {
  const base = tmp('fd-remote-pid-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const tokenFile = path.join(base, 'svc.token');
  fs.writeFileSync(tokenFile, 'tok-0123456789abcdef', { mode: 0o600 });
  const remote = { ...(fixture('positive_service-descriptor-remote.json') as Descriptor), auth: { tokenFile } };
  fs.writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify(remote));
  const clock = { ms: T0 };
  let pid = 100;
  const monitor = new Monitor({ platform: 'darwin',
    servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => clock.ms,
    wellKnown: async () => ({ kind: 'answer', doc: { ...READY, process: { ...READY.process, pid: pid++ } }, ms: 5 }),
  });
  const restarted: string[] = [];
  monitor.on('restarted', (k: string) => restarted.push(k));
  for (const s of [0, 61, 122, 183]) { clock.ms = T0 + s * 1000; await monitor.tick(); }
  assert.deepEqual(restarted, []);
});
