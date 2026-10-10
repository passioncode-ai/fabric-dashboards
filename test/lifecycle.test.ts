// The lifecycle contract (fabric-workspace knowledge/lifecycle.md, LC-07…LC-15) held by tests.
// Each test names the rule it proves; the audit finding it closes is in the PR and in AGENTS.md
// (## Lifecycle). Clocks are fake wherever a rate is counted: an hour is simulated, not waited.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Descriptor, RunResult, WellKnown, WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { ActivityStore } from '../src/core/activity';
import { commandEnv, killOwned, ownedCount, runOwned } from '../src/core/children';
import { commandRan, commandReason } from '../src/core/outcome';
import { appendLog, sweepTemps } from '../src/core/fsutil';
import { Launchd } from '../src/core/launchd';
import { applyLoginItem, loginItemAtStartup, type LoginItemOs } from '../src/core/loginitem';
import { Monitor, REMOVAL_GRACE_MS } from '../src/core/monitor';
import { merge } from '../src/core/settings';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { clearRestoreRecord, KEPT_FILES, MCP_SERVER_NAME, productDataPaths, purgeAfterExit, purgeData, readRestoreRecord, removeMcpRegistrations, repairMcpRegistrations, restoreMcpRegistrations, RESTORE_FILE, writeRestoreRecord } from '../src/core/uninstall';
import { NotifyLedger } from '../src/core/notify';
import { SettingsStore } from '../src/core/settings';
import { autoInstallNow, HiddenGrace, relaunchHidden, resumePath, stalePartitions, UPDATE_IDLE_MS } from '../src/electron/policy';
import { codeFile, StaleWatch } from '../src/mcp/stale';
import { tmp } from './helpers';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const DESCRIPTOR = fixture('positive_service-descriptor.json') as Descriptor;
const READY: WellKnown = { ...(fixture('positive_service-well-known.json') as WellKnown), status: 'ready', degraded: [] };
const T0 = Date.parse('2026-10-03T12:00:00Z');
const flush = async (n = 3) => { for (let i = 0; i < n; i += 1) await new Promise((r) => setImmediate(r)); };

// ── LC-08 — idle means idle ──────────────────────────────────────────────────────────────

interface Counts { spawns: number; disabled: number; probes: number; events: number; pushes: number }

/** Three launchd services and one online service, answering steadily, on the mocked clock. */
function idleRig() {
  const base = tmp('fd-idle-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const local = [1, 2, 3].map((n) => ({
    ...DESCRIPTOR, id: `idle-${n}`, origin: `http://127.0.0.1:${47200 + n}`,
    lifecycle: { manager: 'launchd' as const, label: `com.example.idle-${n}`, plist: `/tmp/never-${n}.plist` },
  }));
  const remote = {
    protocol: 'fabric-service/0.1', id: 'idle-online', instance: 'default', name: 'Online', placement: 'remote' as const,
    origin: 'https://agent.example.com', auth: { tokenFile: '/tmp/never-read.token' }, lifecycle: { manager: 'none' as const },
    installedAt: '2026-10-02T18:00:00Z', installedBy: 'test',
  };
  for (const d of [...local, remote]) fs.writeFileSync(path.join(services, `${d.id}.${d.instance}.json`), JSON.stringify(d));
  const pidOf = (id: string) => 1000 + id.length * 7 + Number(id.at(-1) ?? 0);
  const counts: Counts = { spawns: 0, disabled: 0, probes: 0, events: 0, pushes: 0 };
  const runner = async (_command: string, args: string[]): Promise<RunResult> => {
    counts.spawns += 1;
    if (args[0] === 'print-disabled') { counts.disabled += 1; return { code: 0, stdout: '', stderr: '' }; }
    const label = String(args[1]).split('/').pop()!;
    return { code: 0, stdout: `pid = ${pidOf(label.replace('com.example.', ''))}\n`, stderr: '' };
  };
  const byOrigin = new Map([...local, remote].map((d) => [d.origin, d]));
  const monitor = new Monitor({ platform: 'darwin',
    servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en',
    launchd: new Launchd(runner, 501),
    wellKnown: async (origin): Promise<WellKnownResult> => {
      counts.probes += 1;
      const d = byOrigin.get(origin)!;
      return { kind: 'answer', ms: 3, doc: { ...READY, service: { ...READY.service, id: d.id, instance: d.instance }, process: { ...READY.process, pid: pidOf(d.id) } } };
    },
    events: async () => { counts.events += 1; return { events: [], cursor: null }; },
    token: () => 'idle-token-never-returned-01',
  });
  monitor.on('change', () => { counts.pushes += 1; });
  const reset = () => { for (const k of Object.keys(counts) as (keyof Counts)[]) counts[k] = 0; };
  return { monitor, counts, reset, local: local.length, remote: 1 };
}

async function advance(t: test.TestContext, seconds: number): Promise<void> {
  for (let s = 0; s < seconds; s += 1) {
    t.mock.timers.tick(1000);
    await flush();
  }
}

test('LC-08: a launch with no window runs at background cadence; a quiet hour stays inside the idle budget', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { monitor, counts, reset, local, remote } = idleRig();
  monitor.start(); // a login launch: no window was ever shown, so nobody called setVisible
  try {
    await advance(t, 120); // first scan, first probes, baselines
    reset();
    await advance(t, 3600);
    // Budget for one hidden hour, per AGENTS.md ## Lifecycle: probes every 30 s per local service and
    // every 60 s per online one; launchd is read only every 5 min while every probe answers with the
    // same pid; events at the probe cadence; nothing pushed to the UI when nothing changed.
    assert.ok(counts.probes <= local * 120 + remote * 60 + local + remote, `probes/h ${counts.probes}`);
    assert.ok(counts.events <= local * 120 + remote * 60 + local + remote, `event polls/h ${counts.events}`);
    assert.ok(counts.spawns - counts.disabled <= local * 12 + local, `launchctl print/h ${counts.spawns - counts.disabled}`);
    assert.ok(counts.disabled <= 13, `launchctl print-disabled/h ${counts.disabled}`);
    assert.ok(counts.pushes <= 1, `status pushes/h with nothing changed: ${counts.pushes}`);
  } finally {
    monitor.stop();
  }
});

test('LC-08: a shown window probes at once and at the live cadence; hiding it returns to the background cadence', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { monitor, counts, reset, local } = idleRig();
  monitor.start();
  try {
    await advance(t, 120);
    reset();
    monitor.setVisible(true);
    // The tick it starts rescans the folder first — real file I/O, slower on Windows than three turns.
    for (let i = 0; i < 200 && counts.probes < local; i += 1) await flush(1);
    assert.ok(counts.probes >= local, 'the window shows current states, not the last background read');
    reset();
    await advance(t, 60);
    assert.ok(counts.probes >= local * 11, `live cadence while visible: ${counts.probes} probes/min`);
    monitor.setVisible(false);
    await advance(t, 5);
    reset();
    await advance(t, 60);
    assert.ok(counts.probes <= local * 2 + 1, `background cadence once hidden: ${counts.probes} probes/min`);
  } finally {
    monitor.stop();
  }
});

test('LC-08: a change is pushed once; an identical snapshot is not pushed again', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: T0 });
  const { monitor, counts, reset } = idleRig();
  monitor.start();
  try {
    await advance(t, 120);
    reset();
    monitor.setVisible(true);
    await advance(t, 30); // six live rounds of identical answers
    assert.equal(counts.pushes, 0, 'identical answers are not news to the tray, the Dock or the window');
  } finally {
    monitor.stop();
  }
});

test('LC-08: a hidden window releases embedded dashboards after the grace period, and showing it cancels', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let released = 0;
  const grace = new HiddenGrace(5 * 60_000, () => { released += 1; });
  grace.hidden();
  t.mock.timers.tick(5 * 60_000 - 1);
  assert.equal(released, 0);
  grace.shown();
  t.mock.timers.tick(10 * 60_000);
  assert.equal(released, 0, 'shown before the grace ended: nothing released');
  grace.hidden();
  grace.hidden(); // minimize then hide: one timer, not two
  t.mock.timers.tick(5 * 60_000);
  assert.equal(released, 1);
  t.mock.timers.tick(60 * 60_000);
  assert.equal(released, 1, 'released once per hide');
  grace.dispose();
});

test('LC-08: a released view comes back on the page it was on, never off its origin', () => {
  assert.equal(resumePath('http://127.0.0.1:47195/dashboard/job_1?tab=2#x', 'http://127.0.0.1:47195'), '/dashboard/job_1?tab=2#x');
  assert.equal(resumePath('http://127.0.0.1:47196/dashboard', 'http://127.0.0.1:47195'), undefined);
  assert.equal(resumePath('', 'http://127.0.0.1:47195'), undefined);
  assert.equal(resumePath('http://127.0.0.1:47195/fabric/v1/login?code=abcdefghijklmnop', 'http://127.0.0.1:47195'), undefined, 'R-9: a spent login code is never resumed');
  assert.equal(resumePath('about:blank', 'http://127.0.0.1:47195'), undefined);
});

// ── LC-12 — every file the product writes is bounded ─────────────────────────────────────

const ev = (id: string, minute: number) => ({ id, at: new Date(T0 + minute * 60_000).toISOString(), kind: 'job.done', level: 'notice' as const, text: `Job ${id} finished.` });

test('LC-12: the activity feed is appended, not rewritten, and compacts at twice its cap', () => {
  const dir = tmp('fd-act-append-');
  const a = new ActivityStore(dir, { keep: 10 });
  const file = path.join(dir, 'activity.jsonl');
  a.addServiceEvents('s.default', 'S', [ev('1', 1)], '1');
  const ino = fs.statSync(file).ino;
  for (let i = 2; i <= 20; i += 1) a.addServiceEvents('s.default', 'S', [ev(String(i), i)], String(i));
  assert.equal(fs.statSync(file).ino, ino, 'twenty batches appended to one file, no whole-file rewrite');
  assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 20);
  a.addServiceEvents('s.default', 'S', [ev('21', 21)], '21');
  assert.notEqual(fs.statSync(file).ino, ino, 'past 2 × keep the file is compacted');
  assert.equal(fs.readFileSync(file, 'utf8').trim().split('\n').length, 10, 'compaction keeps the newest `keep` rows');
  assert.equal(a.list().length, 10);
  a.flush();
  const b = new ActivityStore(dir, { keep: 10 });
  assert.deepEqual(b.list().map((i) => i.id), a.list().map((i) => i.id));
});

test('LC-12: state writes are debounced; a crash before the write repeats nothing and reuses no id', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 });
  const dir = tmp('fd-act-state-');
  const state = path.join(dir, 'activity-state.json');
  const a = new ActivityStore(dir, { stateDelayMs: 2000 });
  a.addServiceEvents('s.default', 'S', [ev('1', 1), ev('2', 2)], '2');
  a.addAppEvent('s.default', 'S', 'service.down', 'error', 'S stopped answering.');
  a.markSeen();
  assert.equal(fs.existsSync(state), false, 'nothing written yet: three changes share one debounced write');
  // A crash here: the rows are on disk, the cursor and the counter are not.
  const crashed = new ActivityStore(dir);
  assert.equal(crashed.addServiceEvents('s.default', 'S', [ev('1', 1), ev('2', 2)], '2').length, 0, 'a re-read page repeats nothing');
  assert.equal(crashed.addAppEvent('s.default', 'S', 'service.back', 'notice', 'S is back.').id, 'app-2', 'the counter resumes past ids on disk');
  t.mock.timers.tick(2000);
  assert.equal(JSON.parse(fs.readFileSync(state, 'utf8')).cursors['s.default'], '2', 'the debounced write lands');
});

test('LC-12: a torn last line is healed at start, so the next append stays readable', () => {
  const dir = tmp('fd-act-torn-');
  const a = new ActivityStore(dir);
  a.addServiceEvents('s.default', 'S', [ev('1', 1)], '1');
  a.flush();
  fs.appendFileSync(path.join(dir, 'activity.jsonl'), '{"id":"torn');
  const b = new ActivityStore(dir);
  b.addServiceEvents('s.default', 'S', [ev('2', 2)], '2');
  b.flush();
  assert.deepEqual(new ActivityStore(dir).list().map((i) => i.id).sort(), ['1', '2']);
});

test('LC-12: start-up sweeps temporary files of dead processes and keeps a live one', async () => {
  const dir = tmp('fd-sweep-');
  const dead = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  const deadPid = Number(dead.stdout);
  fs.writeFileSync(path.join(dir, `.activity.jsonl.${deadPid}.0a1b2c3d`), '');
  fs.writeFileSync(path.join(dir, `.settings.json.${deadPid}.deadbeef`), '');
  fs.writeFileSync(path.join(dir, `.activity.jsonl.${process.pid}.11223344`), '');
  fs.writeFileSync(path.join(dir, 'activity.jsonl'), '');
  fs.writeFileSync(path.join(dir, '.hidden-user-file'), '');
  const removed = sweepTemps(dir);
  assert.deepEqual(removed.sort(), [`.activity.jsonl.${deadPid}.0a1b2c3d`, `.settings.json.${deadPid}.deadbeef`].sort());
  assert.deepEqual(fs.readdirSync(dir).sort(), [`.activity.jsonl.${process.pid}.11223344`, '.hidden-user-file', 'activity.jsonl'].sort());
});

test('LC-12: the log is 0600 and rotates by size, keeping at most five files', () => {
  const dir = tmp('fd-log-');
  const file = path.join(dir, 'logs', 'main.log');
  for (let i = 0; i < 40; i += 1) appendLog(file, `line ${i} ${'x'.repeat(40)}`, 200, 5);
  const files = fs.readdirSync(path.dirname(file)).sort();
  assert.deepEqual(files, ['main.log', 'main.log.1', 'main.log.2', 'main.log.3', 'main.log.4']);
  for (const f of files) {
    assert.ok(fs.statSync(path.join(dir, 'logs', f)).size <= 200 + 60, `${f} stays near its cap`);
    if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, 'logs', f)).mode & 0o777, 0o600, `${f} is 0600`); // Windows: the profile's ACL, no POSIX mode
  }
  assert.match(fs.readFileSync(file, 'utf8'), /line 39/, 'the newest line is in the live file');
});

test('LC-12: partitions of services that are no longer installed are named for removal', () => {
  const names = ['svc-a1.default', 'svc-gone.default', 'svc-b2.preview', 'Cache', 'svc-'];
  assert.deepEqual(stalePartitions(names, ['a1.default', 'b2.preview']), ['svc-gone.default']);
  assert.deepEqual(stalePartitions(['svc-a1.default'], []), ['svc-a1.default']);
});

test('LC-12: a removed descriptor tells the app, so its view and its partition go with it', async () => {
  const base = tmp('fd-removed-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const file = path.join(services, 'example-agent.default.json');
  fs.writeFileSync(file, JSON.stringify({ ...DESCRIPTOR, lifecycle: { manager: 'none' } }));
  let clock = 1_000_000;
  const monitor = new Monitor({
    servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => clock,
    wellKnown: async () => ({ kind: 'no-answer', detail: 'closed' }),
  });
  const removed: string[] = [];
  monitor.on('removed', (key: string) => removed.push(key));
  await monitor.tick(true);
  fs.unlinkSync(file);
  await monitor.tick(true);
  assert.deepEqual(removed, [], 'one scan without the file is not a removal yet');
  clock += REMOVAL_GRACE_MS;
  await monitor.tick(true);
  assert.deepEqual(removed, ['example-agent.default']);
});

test('audit MEDIUM-5: a descriptor deleted and written again between scans is not a removal', async () => {
  const base = tmp('fd-rewrite-');
  const services = path.join(base, 'services');
  fs.mkdirSync(services);
  const file = path.join(services, 'example-agent.default.json');
  const body = JSON.stringify({ ...DESCRIPTOR, lifecycle: { manager: 'none' } });
  fs.writeFileSync(file, body);
  let clock = 1_000_000;
  const monitor = new Monitor({
    servicesDir: services, activity: new ActivityStore(path.join(base, 'app')), settings: () => DEFAULT_SETTINGS, lang: () => 'en', now: () => clock,
    wellKnown: async () => ({ kind: 'no-answer', detail: 'closed' }),
  });
  const removed: string[] = [];
  monitor.on('removed', (key: string) => removed.push(key));
  await monitor.tick(true);
  fs.unlinkSync(file); // a non-atomic rewrite: the watcher fires between unlink and write
  await monitor.tick(true);
  clock += 200;
  fs.writeFileSync(file, body);
  await monitor.tick(true);
  clock += REMOVAL_GRACE_MS * 2;
  await monitor.tick(true);
  assert.deepEqual(removed, [], 'the service, its console and its session stay');
  assert.equal(monitor.snapshots().length, 1);
});

// ── LC-10 — a per-session server leaves with its session and with its code ────────────────

const ROOT = path.resolve(__dirname, '..');

/** The MCP server bundled into a fake installed app, as the packaged launcher runs it. */
function fakeInstall(version: string) {
  const base = tmp('fd-mcp-app-');
  const contents = path.join(base, 'Fabric Dashboards.app/Contents');
  const asar = path.join(contents, 'Resources/app.asar');
  fs.mkdirSync(path.join(asar, 'out/main/mcp'), { recursive: true });
  const writePlist = (v: string) => {
    const next = path.join(contents, 'Info.plist.next');
    fs.writeFileSync(next, `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n  <dict>\n    <key>CFBundleShortVersionString</key>\n    <string>${v}</string>\n  </dict>\n</plist>\n`);
    fs.renameSync(next, path.join(contents, 'Info.plist')); // an update replaces the file: a new inode
    fs.writeFileSync(path.join(asar, 'package.json'), JSON.stringify({ name: 'fabric-dashboards', version: v }));
  };
  writePlist(version);
  const esbuild = require('esbuild') as typeof import('esbuild');
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'src/mcp/server.ts')], bundle: true, platform: 'node', format: 'cjs', target: 'node22',
    outfile: path.join(asar, 'out/main/mcp/server.js'), logLevel: 'silent',
  });
  return { base, contents, server: path.join(asar, 'out/main/mcp/server.js'), update: writePlist };
}

function speak(server: string, env: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, [server], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines: Record<string, unknown>[] = [];
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += String(chunk);
    let i: number;
    while ((i = buffer.indexOf('\n')) >= 0) { lines.push(JSON.parse(buffer.slice(0, i))); buffer = buffer.slice(i + 1); }
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null; at: number }>((resolve) => child.once('exit', (code, signal) => resolve({ code, signal, at: Date.now() })));
  const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`);
  const reply = async (id: number, timeoutMs = 15_000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = lines.find((l) => l.id === id);
      if (found) return found as { result?: { isError?: boolean; structuredContent?: Record<string, unknown>; serverInfo?: { version: string } } };
      if (Date.now() > deadline) throw new Error(`no reply ${id}`);
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  return { child, send, reply, exited };
}

test('LC-10: the stdio server exits within 1 s of stdin closing, and within 1 s of SIGTERM', async () => {
  const app = fakeInstall('1.0.0');
  const services = tmp('fd-mcp-svc-');
  // Windows delivers no SIGTERM (a kill is TerminateProcess): there the end of stdin is the way out.
  for (const how of (process.platform === 'win32' ? ['eof'] : ['eof', 'sigterm']) as const) {
    const s = speak(app.server, { FABRIC_SERVICES_DIR: services });
    s.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    assert.equal((await s.reply(1)).result!.serverInfo!.version, '1.0.0');
    const at = Date.now();
    if (how === 'eof') s.child.stdin.end(); else s.child.kill('SIGTERM');
    const exit = await s.exited;
    assert.equal(exit.signal, null, `${how}: the server exited by itself, it was not killed`);
    assert.equal(exit.code, 0, how);
    assert.ok(exit.at - at <= 1000, `${how}: exited in ${exit.at - at} ms`);
  }
});

test('LC-10: a call written just before stdin closes is still answered, then the server exits', async () => {
  const app = fakeInstall('1.0.0');
  const services = tmp('fd-mcp-svc-');
  const s = speak(app.server, { FABRIC_SERVICES_DIR: services });
  s.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_services', arguments: {} } });
  s.child.stdin.end();
  const exit = await s.exited;
  assert.equal(exit.code, 0);
  assert.deepEqual((await s.reply(1, 100)).result!.structuredContent, { services: [], services_dir: services });
});

test('LC-10: a session that ends mid-command takes the command\'s whole process group with it', { skip: process.platform === 'win32' && 'POSIX process groups and /bin/sh — the Windows twin is test/windows-processes.test.ts' }, async () => {
  const app = fakeInstall('1.0.0');
  const services = tmp('fd-mcp-svc-');
  const pidFile = path.join(services, 'grandchild.pid');
  // The doctor starts a grandchild that ignores SIGTERM: only a group kill with a SIGKILL deadline ends it.
  const script = `trap '' TERM; sleep 60 & echo $! > '${pidFile}'; wait`;
  fs.writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify({ ...DESCRIPTOR, commands: { doctor: ['/bin/sh', '-c', script] } }));
  const s = speak(app.server, { FABRIC_SERVICES_DIR: services });
  s.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'doctor', arguments: { service: 'example-agent.default' } } });
  const deadline = Date.now() + 10_000;
  while (!fs.existsSync(pidFile) || !fs.readFileSync(pidFile, 'utf8').trim()) {
    assert.ok(Date.now() < deadline, 'the doctor started');
    await new Promise((r) => setTimeout(r, 20));
  }
  const grandchild = Number(fs.readFileSync(pidFile, 'utf8'));
  const at = Date.now();
  s.child.stdin.end();
  const exit = await s.exited;
  assert.equal(exit.code, 0);
  assert.ok(exit.at - at <= 1000, `exited in ${exit.at - at} ms with a command in flight`);
  const alive = () => { try { process.kill(grandchild, 0); return true; } catch { return false; } };
  const gone = Date.now() + 2000;
  while (alive() && Date.now() < gone) await new Promise((r) => setTimeout(r, 20));
  assert.equal(alive(), false, 'no orphan survives the session');
});

test('FD-37 LC-10 (Windows): a session that ends mid-command takes the command\'s whole tree with it', { skip: process.platform !== 'win32' && 'the Windows tree kill; POSIX groups are tested above' }, async () => {
  const app = fakeInstall('1.0.0');
  const services = tmp('fd-mcp-svc-');
  const pidFile = path.join(services, 'grandchild.pid');
  const grandchild = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000)`;
  const doctor = [process.execPath, '-e', `require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { detached: true, stdio: 'ignore' }).unref(); setInterval(() => {}, 1000)`];
  fs.writeFileSync(path.join(services, 'example-agent.default.json'), JSON.stringify({ ...DESCRIPTOR, commands: { doctor } }));
  const s = speak(app.server, { FABRIC_SERVICES_DIR: services });
  s.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'doctor', arguments: { service: 'example-agent.default' } } });
  const deadline = Date.now() + 15_000;
  while (!fs.existsSync(pidFile) || !fs.readFileSync(pidFile, 'utf8').trim()) {
    assert.ok(Date.now() < deadline, 'the doctor started');
    await new Promise((r) => setTimeout(r, 20));
  }
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  s.child.stdin.end();
  const exit = await s.exited;
  assert.equal(exit.code, 0);
  const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const gone = Date.now() + 20_000;
  while (alive() && Date.now() < gone) await new Promise((r) => setTimeout(r, 50));
  assert.equal(alive(), false, 'no orphan survives the session');
});

test('LC-10: after an update replaces the bundle, the old server answers stale and leaves', async () => {
  const app = fakeInstall('1.0.0');
  const services = tmp('fd-mcp-svc-');
  const s = speak(app.server, { FABRIC_SERVICES_DIR: services });
  s.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_services', arguments: {} } });
  assert.equal((await s.reply(1)).result!.isError, undefined);
  app.update('1.1.0');
  const at = Date.now();
  s.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: {} } });
  const stale = (await s.reply(2)).result!;
  assert.equal(stale.isError, true);
  assert.deepEqual(stale.structuredContent, {
    stale: true, running_version: '1.0.0', installed_version: '1.1.0',
    action: 'Fabric Dashboards was updated. Restart this agent session to load the new version.',
  });
  const exit = await s.exited;
  assert.equal(exit.code, 0, 'a stale server exits once it has answered');
  assert.ok(exit.at - at <= 1500, `left ${exit.at - at} ms after the stale call`);
});

test('LC-10: the stale check reads the bundle outside the archive and survives a missing file', () => {
  assert.equal(codeFile('/Applications/Fabric Dashboards.app/Contents/Resources/app.asar/out/main/mcp/server.js'), '/Applications/Fabric Dashboards.app/Contents/Info.plist');
  assert.equal(codeFile('/repo/out/main/mcp/server.js'), '/repo/out/main/mcp/server.js');
  const dir = tmp('fd-stale-');
  const file = path.join(dir, 'server.js');
  fs.writeFileSync(file, 'a');
  let version = '1.0.0';
  const watch = new StaleWatch(file, () => version);
  assert.equal(watch.check().stale, false);
  version = '1.0.1';
  assert.deepEqual(watch.check(), { stale: true, running: '1.0.0', installed: '1.0.1' });
  version = '1.0.0';
  fs.rmSync(file);
  assert.equal(watch.check().stale, true, 'a bundle moved to the Trash is stale too');
});

test('LC-10: descriptor commands run without ELECTRON_RUN_AS_NODE or NODE_OPTIONS', async () => {
  const env = commandEnv({ PATH: '/usr/bin:/bin', HOME: '/h', ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '--inspect', KEEP: 'yes' });
  assert.deepEqual(env, { PATH: '/usr/bin:/bin', HOME: '/h', KEEP: 'yes' });
  const saved = { a: process.env.ELECTRON_RUN_AS_NODE, b: process.env.NODE_OPTIONS };
  process.env.ELECTRON_RUN_AS_NODE = '1';
  process.env.NODE_OPTIONS = '--max-old-space-size=64';
  try {
    // Node prints its own environment: the same check on every system (Windows names it `Path`).
    const r = await runOwned(process.execPath, ['-e', 'for (const [k, v] of Object.entries(process.env)) console.log(`${k}=${v}`)'], { timeoutMs: 15_000 });
    assert.equal(r.code, 0);
    assert.doesNotMatch(r.output, /ELECTRON_RUN_AS_NODE|NODE_OPTIONS/);
    assert.match(r.output, /^PATH=/im);
  } finally {
    if (saved.a === undefined) delete process.env.ELECTRON_RUN_AS_NODE; else process.env.ELECTRON_RUN_AS_NODE = saved.a;
    if (saved.b === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = saved.b;
  }
});

test('LC-02: a command past its timeout loses its whole group, and killOwned leaves no child', { skip: process.platform === 'win32' && 'POSIX process groups and /bin/sh — the Windows twin is test/windows-processes.test.ts' }, async () => {
  const dir = tmp('fd-owned-');
  const pidFile = path.join(dir, 'g.pid');
  const r = await runOwned('/bin/sh', ['-c', `trap '' TERM; sleep 60 & echo $! > '${pidFile}'; wait`], { timeoutMs: 300, killGraceMs: 200 });
  assert.equal(r.timedOut, true);
  const grandchild = Number(fs.readFileSync(pidFile, 'utf8'));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.throws(() => process.kill(grandchild, 0), 'the grandchild went with the group');
  const pending = runOwned('/bin/sleep', ['30'], { timeoutMs: 60_000 });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(ownedCount(), 1);
  await killOwned(200);
  assert.equal((await pending).code, null);
  assert.equal(ownedCount(), 0);
});

test('LC-02: a command that exited is done even when a descendant that left its group holds its output open', { skip: process.platform === 'win32' && 'POSIX process groups and /bin/sh — the Windows twin is test/windows-processes.test.ts' }, async () => {
  // perl forks a child that calls setsid (leaves the group) and keeps the inherited stdout for 20 s.
  // The bound (10 s) sits far from both a slow machine and the descendant (audit: 4.9 s seen under load).
  const started = Date.now();
  const r = await runOwned('/usr/bin/perl', ['-e', 'use POSIX; if (fork() == 0) { setsid(); sleep 20; exit 0 } print "parent done\\n"; exit 0'], { timeoutMs: 30_000 });
  assert.equal(r.code, 0);
  assert.equal(r.timedOut, false);
  assert.match(r.output, /parent done/);
  assert.ok(Date.now() - started < 10_000, `finished ${Date.now() - started} ms after start, not when the descendant let go`);
  assert.equal(ownedCount(), 0);
});

test('T-6: a command killed by a signal ran — it names the signal and keeps its output; one that never started did not', async () => {
  if (process.platform !== 'win32') { // Windows has no signals: a killed command reports its exit code
    const r = await runOwned('/bin/sh', ['-c', 'echo working; kill -9 $$'], { timeoutMs: 5000 });
    assert.equal(r.code, null);
    assert.equal(r.started, true);
    assert.equal(r.signal, 'SIGKILL');
    assert.match(r.output, /working/);
    assert.deepEqual(commandReason(r, 'doctor'), { code: 'result.commandSignal', params: { command: 'doctor', signal: 'SIGKILL' } });
  }
  const none = await runOwned('/no/such/command', [], { timeoutMs: 5000 });
  assert.equal(none.started, false);
  assert.equal(commandReason(none, 'doctor').code, 'result.commandFailed');
  assert.equal(commandRan(none), false);
});

test('T-12: what a finished command left in its group counts as owned until it is gone, and killOwned ends it', { skip: process.platform === 'win32' && 'POSIX process groups and /bin/sh — the Windows twin is test/windows-processes.test.ts' }, async () => {
  const dir = tmp('fd-linger-');
  const pidFile = path.join(dir, 'g.pid');
  // The command exits at once; its child ignores SIGTERM and would live 60 s.
  const r = await runOwned('/bin/sh', ['-c', `(trap '' TERM; exec sleep 60) & echo $! > '${pidFile}'; exit 0`], { timeoutMs: 5000, killGraceMs: 2000 });
  assert.equal(r.code, 0);
  const left = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.equal(ownedCount(), 1, 'the leftover group is still counted while its kill runs');
  await killOwned(100);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.throws(() => process.kill(left, 0), 'the leftover is gone after killOwned');
  await new Promise((resolve) => setTimeout(resolve, 2100));
  assert.equal(ownedCount(), 0);
});

// ── LC-07 — ask once ────────────────────────────────────────────────────────────────────

function fakeOs(openAtLogin = false): LoginItemOs & { sets: boolean[] } {
  const sets: boolean[] = [];
  let state = openAtLogin;
  return { sets, get: () => ({ openAtLogin: state, status: state ? 'enabled' : 'not-registered' }), set: (open) => { sets.push(open); state = open; } };
}

test('LC-07: launch at login is off until chosen, and a launch never registers it', () => {
  assert.equal(DEFAULT_SETTINGS.launchAtLogin, false);
  assert.equal(DEFAULT_SETTINGS.launchAtLoginAsked, false);
  const os1 = fakeOs();
  for (let launch = 0; launch < 2; launch += 1) assert.equal(loginItemAtStartup(DEFAULT_SETTINGS, os1), null);
  assert.deepEqual(os1.sets, [], 'two launches, no registration call');
  const chosen = { ...DEFAULT_SETTINGS, launchAtLogin: true, launchAtLoginAsked: true };
  assert.equal(applyLoginItem(true, os1), undefined);
  assert.deepEqual(os1.sets, [true], 'the one call is the person\'s choice');
  assert.equal(loginItemAtStartup(chosen, os1), null, 'a chosen and registered item is left alone');
  assert.deepEqual(os1.sets, [true]);
});

test('LC-07/LC-14: turned off in System Settings stays off — the launch adopts it instead of re-registering', () => {
  const os2 = fakeOs(false);
  const chosen = { ...DEFAULT_SETTINGS, launchAtLogin: true, launchAtLoginAsked: true };
  assert.deepEqual(loginItemAtStartup(chosen, os2), { launchAtLogin: false });
  assert.deepEqual(os2.sets, []);
  assert.equal(loginItemAtStartup(chosen, null), null, 'a development run never touches the login item');
});

test('LC-07: settings written by an earlier version count as not yet asked', () => {
  const old = merge({ launchAtLogin: true, theme: 'light' } as never);
  assert.equal(old.launchAtLoginAsked, false);
  assert.equal(merge({ launchAtLogin: false, launchAtLoginAsked: true }).launchAtLoginAsked, true);
});

test('LC-07: a refused login item reports the reason instead of throwing', () => {
  const refusing: LoginItemOs = { get: () => ({ openAtLogin: false, status: 'requires-approval' }), set: () => {} };
  assert.equal(applyLoginItem(true, refusing), 'requires-approval', 'P-10: a code the window words in its language (login.approval)');
  const throwing: LoginItemOs = { get: () => ({ openAtLogin: false }), set: () => { throw new Error('nope'); } };
  assert.equal(applyLoginItem(true, throwing), 'nope');
});

// ── LC-14 — uninstall is symmetric ──────────────────────────────────────────────────────

test('LC-14: uninstall removes the MCP registration from ~/.claude.json and nothing else', () => {
  const home = tmp('fd-home-');
  const file = path.join(home, '.claude.json');
  const launcher = '/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp';
  const before = {
    numStartups: 42,
    mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: launcher, args: [], env: {} }, other: { type: 'stdio', command: '/usr/local/bin/other' } },
    projects: {
      '/work/a': { mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: launcher } }, allowedTools: [] },
      '/work/b': { mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: '/somewhere/else/server' } } },
    },
  };
  fs.writeFileSync(file, JSON.stringify(before, null, 2), { mode: 0o600 });
  const r = removeMcpRegistrations(home);
  assert.deepEqual(r.removed.sort(), ['projects./work/a', 'user'].sort());
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(after.mcpServers, { other: before.mcpServers.other });
  assert.deepEqual(after.projects['/work/a'], { mcpServers: {}, allowedTools: [] });
  assert.deepEqual(after.projects['/work/b'], before.projects['/work/b'], 'a server of the same name that is not ours is kept');
  assert.equal(after.numStartups, 42);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600, 'the file keeps its mode');
  assert.deepEqual(removeMcpRegistrations(home).removed, [], 'a second run changes nothing');
  assert.deepEqual(removeMcpRegistrations(tmp('fd-home-empty-')).removed, [], 'no ~/.claude.json is not an error');
  fs.writeFileSync(file, '{broken');
  assert.throws(() => removeMcpRegistrations(home), /cannot read/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken', 'an unreadable file is never overwritten');
});

test('LC-14: uninstall names every directory the app writes and purges only inside the given home', () => {
  const home = tmp('fd-home-');
  const paths = productDataPaths(home, 'darwin');
  for (const p of paths) assert.ok(p.startsWith(home + path.sep), p);
  assert.ok(paths.includes(path.join(home, 'Library/Application Support/Fabric Dashboards')));
  assert.ok(paths.includes(path.join(home, 'Library/Logs/Fabric Dashboards')));
  assert.ok(paths.includes(path.join(home, 'Library/Caches/ai.passioncode.fabric-dashboards')));
  for (const p of paths.slice(0, 3)) { fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, 'x'), 'x'); }
  const keep = path.join(home, 'Library/Application Support/Another App');
  fs.mkdirSync(keep, { recursive: true });
  const removed = purgeData(paths, 'darwin');
  assert.equal(removed.length, 3);
  for (const p of paths) assert.equal(fs.existsSync(p), false, p);
  assert.ok(fs.existsSync(keep));
  assert.throws(() => purgeData(['/'], 'darwin'), /refuses/);
  assert.throws(() => purgeData([os.homedir()], 'darwin'), /refuses/);
});

test('LC-14: the app\'s data is removed only after the app has exited, and the helper ends', { skip: process.platform === 'win32' && 'POSIX process groups and /bin/sh — the Windows twin is test/windows-processes.test.ts' }, async () => {
  const home = tmp('fd-home-');
  const data = path.join(home, 'Library/Application Support/Fabric Dashboards');
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, 'activity.jsonl'), 'x');
  const appProcess = spawn('/bin/sleep', ['0.4']);
  const helper = purgeAfterExit(appProcess.pid!, [data, home, '/'], undefined, 30_000, { platform: 'darwin' })!; // the macOS profile's shape (Library), on any POSIX system
  // The app lets the helper go (unref) so it can quit; this test waits for it, so it holds it.
  helper.ref();
  const helperDone = new Promise((resolve) => helper.once('exit', resolve));
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.ok(fs.existsSync(data), 'nothing is removed while the app still runs');
  await new Promise((resolve) => appProcess.once('exit', resolve));
  await helperDone;
  assert.equal(fs.existsSync(data), false, 'removed once the app exited');
  assert.ok(fs.existsSync(home), 'a path that is not a product path is never handed to rm');
  assert.equal(purgeAfterExit(process.pid, [home, '/'], undefined, 30_000, { platform: 'darwin' }), null, 'nothing to remove: no helper');
});

test('audit 2026-10-07: an app still running when the wait ends keeps its data', { skip: process.platform === 'win32' && 'POSIX process groups and /bin/sh — the Windows twin is test/windows-processes.test.ts' }, async () => {
  const home = tmp('fd-home-');
  const data = path.join(home, 'Library/Application Support/Fabric Dashboards');
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, 'activity.jsonl'), 'x');
  const appProcess = spawn('/bin/sleep', ['5']);
  try {
    const helper = purgeAfterExit(appProcess.pid!, [data], undefined, 300, { platform: 'darwin' })!;
    helper.ref();
    await new Promise((resolve) => helper.once('exit', resolve));
    assert.ok(fs.existsSync(path.join(data, 'activity.jsonl')), 'nothing is removed from under a live app');
  } finally {
    appProcess.kill('SIGKILL');
  }
});

test('audit 2026-10-07: a ~/.claude.json kept as a symlink stays a symlink after the MCP entry goes', () => {
  const home = tmp('fd-home-');
  const real = path.join(home, 'dotfiles-claude.json');
  const launcher = '/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp';
  fs.writeFileSync(real, JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: launcher } } }), { mode: 0o600 });
  fs.symlinkSync(real, path.join(home, '.claude.json'));
  assert.deepEqual(removeMcpRegistrations(home).removed, ['user']);
  assert.ok(fs.lstatSync(path.join(home, '.claude.json')).isSymbolicLink(), 'the link is kept');
  assert.deepEqual(JSON.parse(fs.readFileSync(real, 'utf8')).mcpServers, {}, 'its target carries the change');
});

// ── LC-14 / ADR-0015 — the person's data survives an uninstall unless they ask ──────────

test('LC-14/ADR-0015: an uninstall that keeps the data removes everything else in the profile, after exit', { skip: process.platform === 'win32' && 'POSIX process groups and /bin/sh — the Windows twin is test/windows-processes.test.ts' }, async () => {
  const home = tmp('fd-home-');
  const data = path.join(home, 'Library/Application Support/Fabric Dashboards');
  const logs = path.join(home, 'Library/Logs/Fabric Dashboards');
  for (const d of [path.join(data, 'Partitions/svc-a.default'), path.join(data, 'Cache'), logs]) fs.mkdirSync(d, { recursive: true });
  for (const name of KEPT_FILES) fs.writeFileSync(path.join(data, name), name);
  for (const name of ['Local State', 'Cookies', '.hidden-chromium-file', 'SingletonLock']) fs.writeFileSync(path.join(data, name), 'x');
  fs.writeFileSync(path.join(logs, 'main.log'), 'x');
  const appProcess = spawn('/bin/sleep', ['0.3']);
  const helper = purgeAfterExit(appProcess.pid!, [logs], { dir: data, names: KEPT_FILES }, 30_000, { platform: 'darwin' })!;
  helper.ref();
  const helperDone = new Promise((resolve) => helper.once('exit', resolve));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(fs.existsSync(path.join(data, 'Cache')), 'nothing is removed while the app still runs');
  await helperDone;
  assert.deepEqual(fs.readdirSync(data).sort(), [...KEPT_FILES].sort(), 'only the settings, the history and the restore record stay');
  for (const name of KEPT_FILES) assert.equal(fs.readFileSync(path.join(data, name), 'utf8'), name, `${name} is untouched`);
  assert.equal(fs.existsSync(logs), false);
  assert.throws(() => purgeAfterExit(process.pid, [], { dir: data, names: ['a;rm -rf /'] }, 30_000, { platform: 'darwin' }), /plain file name/);
});

test('ADR-0015: every file the app keeps the person\'s choices and history in is on the kept list', () => {
  const dir = tmp('fd-kept-');
  new SettingsStore(dir).update({ theme: 'light', autoUpdate: false }); // the LC-16 switch file is written once the person turns it
  const activity = new ActivityStore(dir);
  activity.addAppEvent('a.default', 'A', 'test', 'notice', 'x');
  activity.markSeen();
  activity.flush();
  new NotifyLedger(path.join(dir, 'notified.json')).admit('a.default:down', 'attention', T0);
  writeRestoreRecord(dir, { at: new Date(T0).toISOString(), loginItem: true, mcp: [] });
  const written = fs.readdirSync(dir).filter((n) => !n.startsWith('.'));
  assert.deepEqual(written.sort(), [...KEPT_FILES].sort(), 'each store wrote its file');
  for (const name of written) assert.ok((KEPT_FILES as readonly string[]).includes(name), `${name} would be lost by an uninstall that keeps the data`);
});

test('ADR-0015: the MCP entries an uninstall removed come back on reinstall, pointed at the new launcher', () => {
  const home = tmp('fd-home-');
  const file = path.join(home, '.claude.json');
  const old = '/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp';
  fs.writeFileSync(file, JSON.stringify({
    mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: old, args: [], env: { A: '1' } } },
    projects: { '/work/a': { mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: old } } }, '/work/gone': { mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: old } } } },
  }), { mode: 0o600 });
  const { entries } = removeMcpRegistrations(home);
  assert.equal(entries.length, 3);
  // Between uninstall and reinstall: a project scope disappears, the person adds their own entry in another.
  const mid = JSON.parse(fs.readFileSync(file, 'utf8'));
  delete mid.projects['/work/gone'];
  mid.projects['/work/a'].mcpServers[MCP_SERVER_NAME] = { type: 'stdio', command: '/their/own' };
  fs.writeFileSync(file, JSON.stringify(mid));
  const fresh = '/Users/x/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp';
  assert.deepEqual(restoreMcpRegistrations(entries, fresh, home), ['user']);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(after.mcpServers[MCP_SERVER_NAME], { type: 'stdio', command: fresh, args: [], env: { A: '1' } });
  assert.deepEqual(after.projects['/work/a'].mcpServers[MCP_SERVER_NAME], { type: 'stdio', command: '/their/own' }, 'the person\'s own entry is kept');
  assert.equal(after.projects['/work/gone'], undefined, 'a scope that is gone is not recreated');
  assert.deepEqual(restoreMcpRegistrations(entries, fresh, home), [], 'a second run changes nothing');
});

test('ADR-0015: an MCP entry whose launcher is gone is pointed at this install; others are left alone', () => {
  const home = tmp('fd-home-');
  const file = path.join(home, '.claude.json');
  const gone = '/Volumes/Old/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp';
  const here = '/Applications/Fabric Dashboards.app/Contents/Resources/bin/fabric-dashboards-mcp';
  fs.writeFileSync(file, JSON.stringify({
    mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: gone, args: [] } },
    projects: {
      '/dev': { mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: 'node', args: ['/src/out/main/mcp/server.js'] } } },
      '/other': { mcpServers: { [MCP_SERVER_NAME]: { type: 'stdio', command: '/their/server' } } },
    },
  }));
  const exists = (p: string) => p === here;
  assert.deepEqual(repairMcpRegistrations(here, home, exists), ['user']);
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(after.mcpServers[MCP_SERVER_NAME].command, here);
  assert.equal(after.projects['/dev'].mcpServers[MCP_SERVER_NAME].command, 'node', 'a development entry is not ours to move');
  assert.equal(after.projects['/other'].mcpServers[MCP_SERVER_NAME].command, '/their/server');
  assert.deepEqual(repairMcpRegistrations(here, home, exists), [], 'nothing to repair the second time');
  assert.deepEqual(repairMcpRegistrations(here, tmp('fd-home-empty-'), exists), [], 'no ~/.claude.json is not an error');
});

test('ADR-0015: the restore record round-trips; a damaged one is ignored, never trusted', () => {
  const dir = tmp('fd-restore-');
  assert.equal(readRestoreRecord(dir), null);
  writeRestoreRecord(dir, { at: '2026-10-05T12:00:00Z', loginItem: true, mcp: [{ scope: 'user', entry: { command: '/x' } }] });
  assert.deepEqual(readRestoreRecord(dir), { version: 1, at: '2026-10-05T12:00:00Z', loginItem: true, mcp: [{ scope: 'user', entry: { command: '/x' } }] });
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, RESTORE_FILE)).mode & 0o777, 0o600);
  fs.writeFileSync(path.join(dir, RESTORE_FILE), '{"version":2}');
  assert.equal(readRestoreRecord(dir), null);
  fs.writeFileSync(path.join(dir, RESTORE_FILE), '{');
  assert.equal(readRestoreRecord(dir), null);
  clearRestoreRecord(dir);
  assert.equal(fs.existsSync(path.join(dir, RESTORE_FILE)), false);
  clearRestoreRecord(dir);
});

test('ADR-0015: a downloaded update installs only when allowed, unwatched and idle; the relaunch stays hidden', () => {
  const base = { ready: true, autoUpdate: true, visible: false, busy: 0 };
  assert.equal(autoInstallNow(base), true);
  assert.equal(autoInstallNow({ ...base, ready: false }), false);
  assert.equal(autoInstallNow({ ...base, autoUpdate: false }), false, 'the person turned it off: installs at quit');
  assert.equal(autoInstallNow({ ...base, visible: true }), false, 'never under the person\'s eyes');
  assert.equal(autoInstallNow({ ...base, busy: 1 }), false, 'a doctor or update command is running');
  assert.equal(UPDATE_IDLE_MS, 10 * 60_000);
  const now = T0;
  assert.equal(relaunchHidden(new Date(now - 30_000).toISOString(), now), true);
  assert.equal(relaunchHidden(null, now), false);
  assert.equal(relaunchHidden(new Date(now - 11 * 60_000).toISOString(), now), false, 'a stale marker is not this relaunch');
  assert.equal(relaunchHidden('garbage', now), false);
  assert.equal(relaunchHidden(new Date(now + 60_000).toISOString(), now), false);
});

// ── LC-13 — hardened fuses, read back from the built binary ─────────────────────────────

test('LC-13: the fuse wire is read and set in every slice; the release check names a wrong fuse', async () => {
  const fuses = await import('../scripts/fuses.mjs');
  const wire = (bits: string) => Buffer.concat([Buffer.from('junk'), Buffer.from(fuses.FUSE_SENTINEL), Buffer.from([1, bits.length]), Buffer.from(bits), Buffer.from('more')]);
  const universal = Buffer.concat([wire('101100011'), Buffer.from('slice-gap'), wire('101100011')]);
  const read = fuses.readFuseWires(universal);
  assert.equal(read.length, 2);
  assert.equal(read[0].fuses.RunAsNode, true);
  assert.equal(read[0].fuses.EnableNodeOptionsEnvironmentVariable, true);
  assert.deepEqual(fuses.fuseProblems(universal, fuses.WANTED_FUSES).length > 0, true, 'Electron\'s defaults are not the release fuses');
  const set = fuses.setFuses(universal, fuses.WANTED_FUSES);
  assert.equal(set.length, universal.length, 'flipping changes bytes, never the size');
  assert.deepEqual(fuses.fuseProblems(set, fuses.WANTED_FUSES), []);
  const after = fuses.readFuseWires(set);
  for (const w of after) {
    assert.equal(w.fuses.RunAsNode, true, 'declared exception: the in-binary MCP server needs RunAsNode');
    assert.equal(w.fuses.EnableNodeOptionsEnvironmentVariable, false);
    assert.equal(w.fuses.EnableNodeCliInspectArguments, false);
    assert.equal(w.fuses.EnableEmbeddedAsarIntegrityValidation, true);
    assert.equal(w.fuses.OnlyLoadAppFromAsar, true);
    assert.equal(w.fuses.EnableCookieEncryption, false, 'declared exception: no Keychain item until an upgrade test proves zero prompts');
  }
  assert.throws(() => fuses.readFuseWires(Buffer.from('no wire here')), /no fuse wire/);
  assert.throws(() => fuses.setFuses(wire('1'), { OnlyLoadAppFromAsar: true }), /does not have fuse/);
  const removed = fuses.setFuses(wire('10r100011'), {});
  assert.equal(fuses.readFuseWires(removed)[0].fuses.EnableNodeOptionsEnvironmentVariable, 'removed');
});

// ── LC-15 — builds clean up after themselves ─────────────────────────────────────────────

test('LC-15: a release build keeps the current and the previous release and prunes the rest', async () => {
  const dist = await import('../scripts/dist-mac.mjs');
  const out = tmp('fd-release-');
  const make = (v: string, suffix = '') => {
    for (const f of [`Fabric-Dashboards-${v}${suffix}.dmg`, `Fabric-Dashboards-${v}${suffix}-mac.zip`, `Fabric-Dashboards-${v}${suffix}.receipt.json`]) fs.writeFileSync(path.join(out, f), 'x');
  };
  make('0.3.4'); make('0.4.0'); make('0.4.1'); make('0.10.0'); make('0.4.1', '-unsigned');
  fs.writeFileSync(path.join(out, 'update-feed.json'), '{}');
  fs.writeFileSync(path.join(out, 'notes.txt'), 'not ours');
  const removed = dist.pruneReleases(out, 2);
  assert.deepEqual(removed.sort(), [
    'Fabric-Dashboards-0.3.4-mac.zip', 'Fabric-Dashboards-0.3.4.dmg', 'Fabric-Dashboards-0.4.0-mac.zip', 'Fabric-Dashboards-0.4.0.dmg',
  ].sort());
  const left = fs.readdirSync(out);
  const binaries = left.filter((f) => /\.(dmg|zip)$/.test(f));
  assert.deepEqual([...new Set(binaries.map((f) => /-(\d+\.\d+\.\d+)/.exec(f)![1]))].sort(), ['0.10.0', '0.4.1'], 'two releases remain, by version order, not by name');
  assert.ok(left.includes('Fabric-Dashboards-0.3.4.receipt.json'), 'receipts are small and kept');
  assert.ok(left.includes('notes.txt') && left.includes('update-feed.json'), 'files it did not build are left alone');
  assert.deepEqual(dist.pruneReleases(out, 2), [], 'idempotent');
});

test('LC-15: npm run clean removes what a build regenerates and nothing git tracks', async () => {
  const { clean } = await import('../scripts/clean.mjs');
  const root = tmp('fd-clean-');
  for (const d of ['out/main', 'test-results', 'node_modules/.cache/vite', 'node_modules/react', 'src', 'release/stage/Fabric Dashboards.app/Contents']) fs.mkdirSync(path.join(root, d), { recursive: true });
  for (const v of ['0.1.0', '0.2.0', '0.3.0']) fs.writeFileSync(path.join(root, 'release', `Fabric-Dashboards-${v}.dmg`), 'x');
  fs.writeFileSync(path.join(root, 'release/stage/build.json'), '{}'); // a staged build interrupted before --stage seal
  fs.writeFileSync(path.join(root, 'src/main.ts'), 'code');
  const removed = clean(root);
  assert.deepEqual(removed.sort(), ['node_modules/.cache', 'out', 'release/Fabric-Dashboards-0.1.0.dmg', 'release/stage', 'test-results'].sort());
  assert.ok(fs.existsSync(path.join(root, 'release/Fabric-Dashboards-0.3.0.dmg')), 'the current release stays');
  assert.ok(fs.existsSync(path.join(root, 'node_modules/react')), 'dependencies stay');
  assert.ok(fs.existsSync(path.join(root, 'src/main.ts')), 'sources stay');
  assert.deepEqual(clean(root), [], 'idempotent');
});

test('R-17 (LC-02): what a finished command left running in its own group ends with it', { skip: process.platform === 'win32' && 'Windows has no process groups: its tree kill is FD-37 M2' }, async () => {
  const marker = path.join(tmp('fd-grandchild-'), 'alive');
  // The command starts a background sleeper in its own group and exits at once.
  const r = await runOwned('/bin/sh', ['-c', `(sleep 30; touch ${marker}) & echo started`], { timeoutMs: 10_000, killGraceMs: 200 });
  assert.equal(r.code, 0);
  await new Promise((resolve) => setTimeout(resolve, 600));
  // `[s]leep`: the pattern still matches the sleeper, but not this command's own `sh -c` line — Linux's pgrep
  // excludes only itself, so a literal pattern found its own wrapper shell (FD-37, ubuntu-24.04).
  const left = spawnSync('/bin/sh', ['-c', `pgrep -f "[s]leep 30; touch ${marker}" || true`], { encoding: 'utf8' }).stdout.trim();
  assert.equal(left, '', 'no descendant of the finished command is still running');
});
