// FD-247 (step 4): another machine's sessions, read from its Switchboard over ssh (docs/design/2026-11-15-sessions-machines.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost } from '../src/electron/console';
import { SettingsStore } from '../src/core/settings';
import { tmp } from './helpers';
import { DEFAULT_REMOTE_SWITCHBOARD, LAUNCH_ID, parseTargets, remoteAttachArgv, remoteContinueArgv, remoteEndArgv, readRemoteSessions, targetAttachArgv, targetEndArgv, targetSessionsArgv, REMOTE_BACKOFF_MS, REMOTE_KEEP_MS, REMOTE_MAX_ROWS, REMOTE_POLL_MS, RemoteSessions, remoteSessionsArgv } from '../src/core/remote-sessions';
import { parseRequest } from '../src/core/console-channel';
import { dropRemoteTwins, machineTerminalKey, mergeSessions, remoteRowId, type SbSessionRecord, type SessionRow } from '../src/core/sessions';
import { DEFAULT_SETTINGS } from '../src/core/types';
import { parsePageRows } from '../src/core/switchboard';
import { merge as mergeSettings } from '../src/core/settings';

const TARGETS = JSON.stringify({ data: { targets: [
  { machine: 'me@192.0.2.9', aliases: ['studio-2', '-oProxyCommand=x'], program: null, data_dir: null },
  { machine: 'studio-3', aliases: [], program: '/opt/sb/bin/switchboard', data_dir: '/srv/sb data' },
  { machine: '-oProxyCommand=evil', aliases: [], program: null, data_dir: null },
  { machine: 'studio-4', aliases: [], program: '/x;rm -rf ~', data_dir: '/a/../b' },
] } });

test('FD-247 step 4: targets are read strictly; nothing ssh could take as an option, no unsafe path', () => {
  const t = parseTargets(TARGETS);
  assert.deepEqual(t.map((x) => x.machine), ['me@192.0.2.9', 'studio-3', 'studio-4']);
  assert.deepEqual(t[0]!.aliases, ['studio-2'], 'an alias that reads as an option is dropped');
  assert.deepEqual([t[2]!.program, t[2]!.dataDir], [null, null], 'a path with shell characters or .. is not kept');
  assert.deepEqual(parseTargets('not json'), []);
});

test('FD-247 step 4: one fixed argv: BatchMode, a bounded connect, the machine, then the quoted Switchboard there', () => {
  const [a, b] = parseTargets(TARGETS);
  assert.deepEqual(remoteSessionsArgv(a!), ['/usr/bin/ssh', '-T', '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', 'me@192.0.2.9', `'${DEFAULT_REMOTE_SWITCHBOARD}' --json sessions --all`]);
  assert.equal(remoteSessionsArgv(b!).at(-1), `'/opt/sb/bin/switchboard' --json sessions --all --data-dir '/srv/sb data'`);
});

test('FD-247 step 4: a machine Switchboard does not know is refused before ssh; each failure has its class', async () => {
  const known = parseTargets(TARGETS);
  const calls: string[][] = [];
  const answer = (code: number, stdout = '', stderr = '') => async (file: string, args: string[]) => { calls.push([file, ...args]); return { code, stdout, stderr }; };
  assert.deepEqual(await readRemoteSessions(answer(0) as never, known, 'elsewhere'), { ok: false, why: 'unknown-machine' });
  assert.equal(calls.length, 0);
  assert.equal((await readRemoteSessions(answer(255, '', 'ssh: connect timed out') as never, known, 'studio-2')).ok, false, 'an alias reaches its machine');
  assert.equal(calls[0]![7], 'me@192.0.2.9');
  assert.deepEqual(await readRemoteSessions(answer(127) as never, known, 'studio-3'), { ok: false, why: 'no-switchboard' });
  assert.deepEqual(await readRemoteSessions(answer(2, '', 'error: unrecognized subcommand') as never, known, 'studio-3'), { ok: false, why: 'too-old' });
  assert.equal(((await readRemoteSessions(answer(0, 'garbage') as never, known, 'studio-3')) as { why: string }).why, 'bad-answer');
});

test('FD-247 step 4: the answer is capped: at most REMOTE_MAX_ROWS rows, a row with no absolute folder skipped', async () => {
  const known = parseTargets(TARGETS);
  const sessions = [{ working_directory: 'relative', provider: 'claude', state: 'running' }, ...Array.from({ length: REMOTE_MAX_ROWS + 50 }, (_, i) => ({ working_directory: `/srv/w${i}`, provider: 'claude', state: 'running', label: 'x'.repeat(500) }))];
  const r = await readRemoteSessions((async () => ({ code: 0, stdout: JSON.stringify({ ok: true, data: { sessions } }), stderr: '' })) as never, known, 'studio-3');
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.rows.length, REMOTE_MAX_ROWS);
  assert.equal(r.rows[0]!.folder, '/srv/w0');
  assert.ok(r.rows[0]!.account.length <= 200);
});

// FD-247 (step 5): the reader behind the Sessions mode.
const SB = '/usr/local/bin/switchboard';
const TWO = JSON.stringify({ data: { targets: [{ machine: 'studio-2', aliases: [] }, { machine: 'studio-3', aliases: [] }, { machine: 'studio-4', aliases: [] }] } });
const listing = (folder: string) => JSON.stringify({ ok: true, data: { sessions: [{ working_directory: folder, provider: 'claude', state: 'running', launched_at: '2026-11-15T09:00:00Z' }] } });

function fakeMachines(answers: Record<string, () => { code: number; stdout?: string; stderr?: string }>, o: { target?: boolean } = {}) {
  const calls: string[] = [];
  const argvs: string[][] = [];
  let open = 0;
  let most = 0;
  const run = async (file: string, args: string[]) => {
    if (file === SB && args.at(-1) === '--help') return { code: 0, stdout: o.target ? '      --target <TARGET>\n      --remote <REMOTE>\n      --remote-data-dir <REMOTE_DATA_DIR>\n' : '      --all\n', stderr: '' };
    if (file === SB && args.includes('targets')) { calls.push('targets'); return { code: 0, stdout: TWO, stderr: '' }; }
    argvs.push([file, ...args]);
    const machine = file === SB ? args[args.indexOf('--target') + 1]! : args[args.length - 2]!;
    calls.push(machine);
    open += 1; most = Math.max(most, open);
    await new Promise((r) => setImmediate(r));
    open -= 1;
    const a = answers[machine]!();
    return { code: a.code, stdout: a.stdout ?? '', stderr: a.stderr ?? '' };
  };
  return { run: run as never, calls, argvs, most: () => most };
}

test('FD-247 step 5: every machine read once a minute, two ssh at most, targets asked once per 10 minutes', async () => {
  let now = 1_000_000;
  const f = fakeMachines({ 'studio-2': () => ({ code: 0, stdout: listing('/w/a') }), 'studio-3': () => ({ code: 0, stdout: listing('/w/b') }), 'studio-4': () => ({ code: 0, stdout: listing('/w/c') }) });
  const r = new RemoteSessions(f.run, () => now);
  assert.equal(await r.poll(SB), true);
  assert.deepEqual(f.calls.sort(), ['studio-2', 'studio-3', 'studio-4', 'targets']);
  assert.equal(f.most(), 2, 'at most two ssh at once');
  assert.deepEqual(r.input().map((m) => m.machine).sort(), ['studio-2', 'studio-3', 'studio-4']);
  f.calls.length = 0;
  now += 15_000;
  assert.equal(await r.poll(SB), false, 'a tick 15 s later reads nothing');
  assert.deepEqual(f.calls, []);
  now += REMOTE_POLL_MS;
  await r.poll(SB);
  assert.deepEqual(f.calls.sort(), ['studio-2', 'studio-3', 'studio-4'], 'a minute later each machine again, targets not');
});

test('FD-247 step 5: a failing machine backs off 1, 5, 15 minutes, keeps its last rows, and drops them after 24 h', async () => {
  let now = 1_000_000;
  let up = true;
  const f = fakeMachines({ 'studio-2': () => (up ? { code: 0, stdout: listing('/w/a') } : { code: 255, stderr: 'ssh: connect to host studio-2: Operation timed out' }), 'studio-3': () => ({ code: 127 }), 'studio-4': () => ({ code: 2, stderr: "error: unrecognized subcommand 'sessions'" }) });
  const r = new RemoteSessions(f.run, () => now);
  await r.poll(SB);
  const firstRead = now;
  assert.deepEqual(r.status().map((m) => [m.machine, m.state]), [['studio-2', 'ok'], ['studio-3', 'no-switchboard'], ['studio-4', 'too-old']]);
  up = false;
  const reads = () => f.calls.filter((c) => c === 'studio-2').length;
  now += REMOTE_POLL_MS; await r.poll(SB);
  assert.equal(r.status()[0]!.state, 'unreachable');
  assert.equal(r.status()[0]!.at, firstRead, 'the last good read stays');
  assert.equal(r.input()[0]!.rows[0]!.folder, '/w/a', 'its rows stay');
  // The failure just read was the first: the next waits are 1 minute, then 5, then 15, then 15 again.
  for (const wait of [...REMOTE_BACKOFF_MS, REMOTE_BACKOFF_MS[2]]) {
    const c = reads();
    now += wait - 1; await r.poll(SB);
    assert.equal(reads(), c, `not before ${wait} ms`);
    now += 1; await r.poll(SB);
    assert.equal(reads(), c + 1, `once after ${wait} ms`);
  }
  now = firstRead + REMOTE_KEEP_MS + 1;
  assert.deepEqual(r.input(), [], 'rows older than 24 h go');
  assert.equal(r.clear(), true);
  assert.deepEqual(r.status(), []);
});

test('FD-247 step 5: remote rows are their machine\'s, act on nothing yet, and a console\'s own session there is listed once', () => {
  const NOW = Date.parse('2026-11-15T10:00:00Z');
  const rec: SbSessionRecord = { home: '', folder: '/srv/w/alpha', provider: 'claude', agent: 'claude-code', pool: 'default', mode: 'managed', account: 'Work', accountId: 'a', context: null, contextName: null, continues: null, inPlace: true, launchedAt: NOW - 5 * 60_000, startedAt: NOW - 5 * 60_000, state: 'running', launch: null };
  const rows = mergeSessions({ now: NOW, switchboard: [], pending: [], stops: [], consoles: [], records: [], dismissed: [], remote: [{ machine: 'studio-2', rows: [rec, { ...rec, folder: '/srv/w/beta', state: 'ended', launchedAt: NOW - 3 * 24 * 3_600_000, startedAt: NOW - 3 * 24 * 3_600_000 }] }] });
  assert.equal(rows.length, 1, 'an ended session older than a day is not listed');
  assert.equal(rows[0]!.id, remoteRowId('studio-2', rec));
  assert.ok(rows[0]!.id.startsWith('rm:studio-2:/srv/w/alpha:'));
  assert.equal(rows[0]!.machine, 'studio-2');
  assert.deepEqual(rows[0]!.actions, []);
  const own = { ...rows[0]!, id: 'c:session.ab12:1', key: 'session.ab12', startedAt: NOW - 4 * 60_000 } as SessionRow;
  assert.deepEqual(dropRemoteTwins([own, rows[0]!]).map((r) => r.id), ['c:session.ab12:1']);
  assert.equal(dropRemoteTwins([{ ...own, machine: 'studio-3' }, rows[0]!]).length, 2, 'another machine\'s session is not a twin');
});

test('FD-247 step 5: "Show sessions on other machines" is on by default and in a file from an earlier version', () => {
  assert.equal(DEFAULT_SETTINGS.remoteSessions, true);
  const { remoteSessions: _, ...earlier } = DEFAULT_SETTINGS;
  assert.equal(mergeSettings(earlier as never).remoteSessions, true);
  assert.equal(mergeSettings({ ...DEFAULT_SETTINGS, remoteSessions: false }).remoteSessions, false);
});

test('FD-247 step 5: the console host reads other machines only with the window shown on the Sessions mode, and forgets them when switched off', { skip: process.platform === 'win32' && 'the fake switchboard is a shell script' }, async () => {
  const base = tmp('fd-remote-');
  const bin = path.join(base, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  let visible = false;
  const ssh: string[] = [];
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => visible, log: () => undefined, testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (file, args) => {
      if (args.join(' ') === '--json targets') return { code: 0, stdout: JSON.stringify({ data: { targets: [{ machine: 'studio-2', aliases: [] }] } }), stderr: '' };
      if (file === '/usr/bin/ssh') { ssh.push(args.at(-2)!); return { code: 0, stdout: listing('/srv/w/alpha'), stderr: '' }; }
      if (args.join(' ') === '--json sessions --all') return { code: 0, stdout: JSON.stringify({ ok: true, data: { sessions: [] } }), stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: () => { throw new Error('no spawn'); }, killGroup: () => undefined, idleMs: 0,
    machine: async () => ({ freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }), keys: () => [], home: base,
  } as ConstructorParameters<typeof ConsoleHost>[0]);
  const settle = async () => { await host.pollSessions(); for (let i = 0; i < 20 && ssh.length === 0; i++) await new Promise((r) => setTimeout(r, 10)); await new Promise((r) => setTimeout(r, 10)); };
  settings.update({ layout: { ...settings.get().layout, mode: 'sessions' } });
  await settle();
  assert.deepEqual(ssh, [], 'a hidden window reads nothing');
  visible = true;
  settings.update({ layout: { ...settings.get().layout, mode: 'agents' } });
  await settle();
  assert.deepEqual(ssh, [], 'the Agents mode reads nothing');
  settings.update({ layout: { ...settings.get().layout, mode: 'sessions' } });
  await settle();
  assert.deepEqual(ssh, ['studio-2']);
  const st = host.sessionsStatus();
  assert.deepEqual(st.machines?.map((m) => [m.machine, m.state]), [['studio-2', 'ok']]);
  assert.deepEqual(st.rows.filter((r) => r.machine === 'studio-2').map((r) => r.folder), ['/srv/w/alpha']);
  settings.update({ remoteSessions: false });
  await settle();
  assert.deepEqual(host.sessionsStatus().machines, []);
  assert.equal(host.sessionsStatus().rows.some((r) => r.machine === 'studio-2'), false, 'switched off, the rows go');
});

test('FD-247 step 7: Open here and End reach another machine through fixed argv; an id that is not a launch id goes nowhere', () => {
  const [a, b] = parseTargets(TARGETS);
  assert.deepEqual(remoteAttachArgv(a!, 'L-1.2:x'), ['/usr/bin/ssh', '-t', '-o', 'ConnectTimeout=5', 'me@192.0.2.9', `'${DEFAULT_REMOTE_SWITCHBOARD}' attach 'L-1.2:x'`]);
  assert.equal(remoteEndArgv(b!, 'L1')!.at(-1), `'/opt/sb/bin/switchboard' --json sessions end 'L1' --data-dir '/srv/sb data'`);
  assert.deepEqual(remoteEndArgv(b!, 'L1')!.slice(0, 7), ['/usr/bin/ssh', '-T', '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5']);
  for (const bad of ['', 'a b', "x';rm -rf ~;'", '$(id)', 'x'.repeat(129)]) {
    assert.equal(LAUNCH_ID.test(bad), false);
    assert.equal(remoteAttachArgv(a!, bad), null);
    assert.equal(remoteEndArgv(a!, bad), null);
  }
});

test('FD-247 step 7: a hosted session on another machine offers Open here and End; one not hosted offers nothing', () => {
  const NOW = Date.parse('2026-11-15T10:00:00Z');
  const base: SbSessionRecord = { home: '', folder: '/srv/w/alpha', provider: 'claude', agent: 'claude-code', pool: 'default', mode: 'managed', account: 'Work', accountId: 'a', context: null, contextName: null, continues: null, inPlace: false, launchedAt: NOW - 60_000, startedAt: NOW - 60_000, state: 'running', launch: { launchId: 'L-7' } as SbSessionRecord['launch'] };
  const rows = mergeSessions({ now: NOW, switchboard: [], pending: [], stops: [], consoles: [], records: [], dismissed: [], remote: [{ machine: 'studio-2', rows: [{ ...base, attachable: true }, { ...base, folder: '/srv/w/beta', launch: { launchId: 'L-8' } as SbSessionRecord['launch'] }, { ...base, folder: '/srv/w/gamma', attachable: true, launch: { launchId: 'bad id' } as SbSessionRecord['launch'] }] }] });
  const by = (f: string) => rows.find((r) => r.folder === f)!.actions;
  assert.deepEqual(by('/srv/w/alpha'), ['attach', 'end']);
  assert.deepEqual(by('/srv/w/beta'), []);
  assert.deepEqual(by('/srv/w/gamma'), [], 'an id Switchboard should never write is not acted on');
});

test('FD-247 step 7: the console host opens a remote hosted session in a console of its own and ends it there', { skip: process.platform === 'win32' && 'the fake switchboard is a shell script' }, async () => {
  const base = tmp('fd-remote-act-');
  const bin = path.join(base, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const calls: string[][] = [];
  const spawned: string[][] = [];
  const hosted = JSON.stringify({ ok: true, data: { sessions: [{ working_directory: '/srv/w/alpha', provider: 'claude', state: 'running', attachable: true, launch_id: '0f9e8d7c-6b5a-4f3e-9d2c-1b0a99887766', launched_at: new Date(Date.now() - 60_000).toISOString() }] } });
  let endCode = 0;
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => true, log: () => undefined, testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (file, args) => {
      calls.push([file, ...args]);
      if (args.join(' ') === '--json targets') return { code: 0, stdout: JSON.stringify({ data: { targets: [{ machine: 'studio-2', aliases: [] }] } }), stderr: '' };
      if (file === '/usr/bin/ssh' && args.at(-1)!.includes('sessions --all')) return { code: 0, stdout: hosted, stderr: '' };
      if (file === '/usr/bin/ssh' && args.at(-1)!.includes('sessions end')) return { code: endCode, stdout: '', stderr: endCode ? 'no such session' : '' };
      if (args.join(' ') === '--json sessions --all') return { code: 0, stdout: JSON.stringify({ ok: true, data: { sessions: [] } }), stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file: string, args: string[]) => { spawned.push([file, ...args]); return { pid: 2_100_000_000, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    killGroup: () => undefined, idleMs: 0,
    machine: async () => ({ freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }), keys: () => [], home: base,
  } as ConstructorParameters<typeof ConsoleHost>[0]);
  settings.update({ layout: { ...settings.get().layout, mode: 'sessions' } });
  await host.pollSessions();
  for (let i = 0; i < 50 && !host.sessionsStatus().rows.some((r) => r.machine === 'studio-2'); i++) await new Promise((r) => setTimeout(r, 10));
  const row = host.sessionsStatus().rows.find((r) => r.machine === 'studio-2')!;
  assert.deepEqual(row.actions, ['attach', 'end']);
  const opened = await host.attachSession(row.id);
  assert.equal(opened.ok, true);
  assert.ok(spawned.some((a) => a.join(' ').includes("studio-2 '/Applications/Fabric Switchboard.app/Contents/MacOS/switchboard' attach '0f9e8d7c-6b5a-4f3e-9d2c-1b0a99887766'")), JSON.stringify(spawned));
  assert.deepEqual(await host.attachSession(row.id), opened, 'a second Open here finds the same console');
  assert.deepEqual(await host.endSession(row.id), { ok: true, key: null });
  assert.ok(calls.some((c) => c[0] === '/usr/bin/ssh' && c.at(-1)!.endsWith("sessions end '0f9e8d7c-6b5a-4f3e-9d2c-1b0a99887766'")));
  endCode = 2;
  const failed = await host.endSession(row.id);
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.detail, 'no such session');
});

test('FD-247 step 7b: Open terminal on a machine Switchboard names: one console per machine, a login shell over ssh; any other machine is refused', { skip: process.platform === 'win32' && 'the fake switchboard is a shell script' }, async () => {
  const base = tmp('fd-remote-term-');
  const bin = path.join(base, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const spawned: string[][] = [];
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => true, log: () => undefined, testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (_file, args) => (args.join(' ') === '--json targets' ? { code: 0, stdout: JSON.stringify({ data: { targets: [{ machine: 'studio-2', aliases: ['studio-two'] }] } }), stderr: '' } : { code: 1, stdout: '', stderr: '' }),
    spawn: (file: string, args: string[]) => { spawned.push([file, ...args]); return { pid: 2_100_000_001, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    killGroup: () => undefined, idleMs: 0,
    machine: async () => ({ freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }), keys: () => [], home: base,
  } as ConstructorParameters<typeof ConsoleHost>[0]);
  assert.deepEqual(await host.openMachineTerminal('studio-9'), { ok: false, reason: 'remote', detail: 'unknown-machine' });
  const a = await host.openMachineTerminal('studio-2');
  assert.ok(a.ok && a.key === machineTerminalKey('studio-2'));
  assert.ok(spawned.some((x) => x.slice(-4).join(' ') === '-t -o ConnectTimeout=5 studio-2'), JSON.stringify(spawned));
  assert.deepEqual(await host.openMachineTerminal('studio-two'), { ok: true, key: (a as { key: string }).key }, 'an alias finds the same machine and its console');
  const row = host.sessionsStatus().rows.find((r) => r.key === (a as { key: string }).key);
  assert.equal(row?.machine, 'studio-2');
  assert.match(machineTerminalKey('studio-2'), /^session\.term-[0-9a-f]{12}$/);
});

test('FD-247 step 7b: the console channel takes a terminal with a machine and nothing else', () => {
  const ok = parseRequest(JSON.stringify({ key: 'k', op: 'session.new', start: { kind: 'terminal', machine: 'studio-2' } }));
  assert.deepEqual(ok, { ok: true, request: { key: 'k', op: 'session.new', service: '', start: { kind: 'terminal', machine: 'studio-2' } } });
  for (const start of [{ kind: 'terminal' }, { kind: 'terminal', machine: '-oProxyCommand=x' }, { kind: 'terminal', machine: 'studio-2', folder: '/x' }, { kind: 'terminal', machine: 'studio-2', runtime: 'codex' }]) {
    assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'session.new', start })), { ok: false, code: 'bad-start' }, JSON.stringify(start));
  }
});

test('FD-247 step 10: a Switchboard that reads other machines is asked through `sessions --all --target`; an older one keeps the ssh path', async () => {
  const via = fakeMachines({ 'studio-2': () => ({ code: 0, stdout: listing('/w/a') }), 'studio-3': () => ({ code: 255, stderr: 'ssh: connect to host studio-3: Operation timed out' }), 'studio-4': () => ({ code: 0, stdout: listing('/w/c') }) }, { target: true });
  const r = new RemoteSessions(via.run, () => 1_000_000);
  await r.poll(SB);
  assert.ok(via.argvs.every((a) => a[0] === SB && a.slice(1, 6).join(' ') === '--json sessions --all --target ' + a[5]), JSON.stringify(via.argvs));
  assert.deepEqual(r.input().map((m) => m.machine).sort(), ['studio-2', 'studio-4']);
  assert.equal(r.status().find((m) => m.machine === 'studio-3')?.state, 'unreachable', 'its ssh exit code still names the state');
  const old = fakeMachines({ 'studio-2': () => ({ code: 0, stdout: listing('/w/a') }), 'studio-3': () => ({ code: 0, stdout: listing('/w/b') }), 'studio-4': () => ({ code: 0, stdout: listing('/w/c') }) });
  await new RemoteSessions(old.run, () => 1_000_000).poll(SB);
  assert.ok(old.argvs.every((a) => a[0] === '/usr/bin/ssh'), JSON.stringify(old.argvs));
  assert.deepEqual(targetSessionsArgv(SB, { machine: 'studio-2', aliases: [], program: '/opt/sb/switchboard', dataDir: '/srv/sb data' }),
    [SB, '--json', 'sessions', '--all', '--target', 'studio-2', '--remote', '/opt/sb/switchboard', '--remote-data-dir', '/srv/sb data'], 'an argv: a space in a path is no shell word');
});

test('FD-247 step 10: Open here and End there go through this Mac\'s Switchboard when it attaches and ends on another machine itself', async () => {
  const f = fakeMachines({ 'studio-2': () => ({ code: 0, stdout: listing('/w/a') }), 'studio-3': () => ({ code: 0, stdout: listing('/w/b') }), 'studio-4': () => ({ code: 0, stdout: listing('/w/c') }) }, { target: true });
  const r = new RemoteSessions(f.run, () => 0);
  assert.equal(r.via(), null, 'nothing asked yet');
  await r.poll(SB);
  assert.deepEqual(r.via(), { switchboard: SB, doors: { sessions: true, rows: false, attach: true, end: true } });
  const target = { machine: 'studio-2', aliases: [], program: '/opt/sb', dataDir: '/data/sb' } as never;
  assert.deepEqual(targetAttachArgv(SB, target, 'L-1'), [SB, 'attach', 'L-1', '--target', 'studio-2', '--remote', '/opt/sb', '--remote-data-dir', '/data/sb']);
  assert.deepEqual(targetEndArgv(SB, target, 'L-1'), [SB, '--json', 'sessions', 'end', 'L-1', '--target', 'studio-2', '--remote', '/opt/sb', '--remote-data-dir', '/data/sb']);
  assert.equal(targetEndArgv(SB, target, 'x; rm'), null, 'only a launch id reaches a command');
  const old = fakeMachines({ 'studio-2': () => ({ code: 0, stdout: listing('/w/a') }), 'studio-3': () => ({ code: 0, stdout: listing('/w/b') }), 'studio-4': () => ({ code: 0, stdout: listing('/w/c') }) });
  const r2 = new RemoteSessions(old.run, () => 0);
  await r2.poll(SB);
  assert.deepEqual(r2.via()!.doors, { sessions: false, rows: false, attach: false, end: false }, 'an older Switchboard keeps our own ssh');
});

test('FD-247 step 10: the console host opens and ends a session there through Switchboard\'s --target, and shows its refusal as a sentence', { skip: process.platform === 'win32' && 'the fake switchboard is a shell script' }, async () => {
  const base = tmp('fd-remote-via-');
  const bin = path.join(base, 'bin');
  fs.mkdirSync(bin);
  const sb = path.join(bin, 'switchboard');
  fs.writeFileSync(sb, '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const calls: string[][] = [];
  const spawned: string[][] = [];
  const id = '0f9e8d7c-6b5a-4f3e-9d2c-1b0a99887766';
  const hosted = JSON.stringify({ ok: true, data: { sessions: [{ working_directory: '/srv/w/alpha', provider: 'claude', state: 'running', attachable: true, launch_id: id, launched_at: new Date(Date.now() - 60_000).toISOString() }] } });
  let endAnswer = { code: 0, stdout: JSON.stringify({ ok: true }) };
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => true, log: () => undefined, testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (file, args) => {
      calls.push([file, ...args]);
      if (args.at(-1) === '--help') return { code: 0, stdout: '      --target <TARGET>\n      --remote <REMOTE>\n      --remote-data-dir <REMOTE_DATA_DIR>\n', stderr: '' };
      if (args.join(' ') === '--json targets') return { code: 0, stdout: JSON.stringify({ data: { targets: [{ machine: 'studio-2', aliases: [] }] } }), stderr: '' };
      if (args.join(' ') === '--json sessions --all --target studio-2') return { code: 0, stdout: hosted, stderr: '' };
      if (args.slice(0, 3).join(' ') === '--json sessions end') return { ...endAnswer, stderr: '' };
      if (args.join(' ') === '--json sessions --all') return { code: 0, stdout: JSON.stringify({ ok: true, data: { sessions: [] } }), stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file: string, args: string[]) => { spawned.push([file, ...args]); return { pid: 2_100_000_000, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    killGroup: () => undefined, idleMs: 0,
    machine: async () => ({ freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }), keys: () => [], home: base,
  } as ConstructorParameters<typeof ConsoleHost>[0]);
  settings.update({ layout: { ...settings.get().layout, mode: 'sessions' } });
  await host.pollSessions();
  for (let i = 0; i < 50 && !host.sessionsStatus().rows.some((r) => r.machine === 'studio-2'); i++) await new Promise((r) => setTimeout(r, 10));
  const row = host.sessionsStatus().rows.find((r) => r.machine === 'studio-2')!;
  assert.equal((await host.attachSession(row.id)).ok, true);
  assert.ok(spawned.some((a) => a.join(' ').endsWith(`attach ${id} --target studio-2`)), JSON.stringify(spawned));
  assert.ok(!spawned.some((a) => a[0] === '/usr/bin/ssh'), 'no ssh of our own');
  assert.deepEqual(await host.endSession(row.id), { ok: true, key: null });
  assert.ok(calls.some((c) => c.slice(1).join(' ') === `--json sessions end ${id} --target studio-2`), JSON.stringify(calls));
  endAnswer = { code: 1, stdout: JSON.stringify({ ok: false, error: 'No session with this launch id is open on this computer.' }) };
  const failed = await host.endSession(row.id);
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.detail, 'No session with this launch id is open on this computer.');
});

// FD-291 (step 1): another machine's sessions page (`sessions --rows --target`, SB-395).
const NOW = Date.parse('2026-11-16T12:00:00Z');
const page = (rows: unknown[]) => JSON.stringify({ ok: true, data: { rows, counts: {}, degraded: [], observed_at: NOW / 1000 } });
const ROWS = [
  { id: 'pid:4242', group: 'running', why: 'quiet', acts: [], agent: 'claude-code', folder: '/w/a', account: null, pool: null, origin: null, since: NOW / 1000 - 600, launch_id: null, session_id: null, pid: 4242, quiet_minutes: 37 },
  { id: 'launch:L-1', group: 'running', why: 'working', acts: ['attach', 'end'], agent: 'codex', folder: '/w/b', account: 'Work', pool: 'p', origin: 'cli', since: NOW / 1000 - 60, launch_id: 'L-1', session_id: 's1' },
  { id: 'stop:cc-abc-1', group: 'needs_you', why: 'ready_to_continue', acts: ['continue'], agent: 'claude-code', folder: '/w/c', account: 'Home', pool: null, origin: null, since: NOW / 1000 - 3600, launch_id: null, session_id: 'abc' },
  { id: 'stop:cc-def-2', group: 'waiting', why: 'limit', acts: [], agent: 'claude-code', folder: '/w/d', account: 'Home', pool: null, origin: null, since: NOW / 1000 - 3600, launch_id: null, session_id: 'def', probe_at: NOW / 1000 + 900 },
  { id: 'launch:L-2', group: 'ended', why: 'exited', acts: ['continue'], agent: 'claude-code', folder: '/w/e', account: null, pool: null, origin: 'fabric', since: NOW / 1000 - 7200, launch_id: 'L-2', session_id: null },
  { id: 'launch:L-3', group: 'ended', why: 'exited', acts: [], agent: 'claude-code', folder: '/w/f', account: null, pool: null, origin: 'cli', since: NOW / 1000 - 9 * 86_400, launch_id: 'L-3', session_id: null },
  { id: '--evil', group: 'running', why: 'working', acts: [], agent: 'codex', folder: '/w/x', since: NOW / 1000 },
  { id: 'pid:1', group: 'other', why: 'working', acts: [], agent: 'codex', folder: '/w/x', since: NOW / 1000 },
  { id: 'pid:2', group: 'running', why: 'working', acts: [], agent: 'codex', folder: 'relative', since: NOW / 1000 },
];

function fakeRows(answer: (args: string[]) => { code: number; stdout?: string; stderr?: string }, help = '      --rows\n      --target <TARGET>\n      --remote <REMOTE>\n      --remote-data-dir <REMOTE_DATA_DIR>\n') {
  const argvs: string[][] = [];
  const run = async (file: string, args: string[]) => {
    if (file === SB && args.at(-1) === '--help') return { code: 0, stdout: help, stderr: '' };
    if (file === SB && args.includes('targets')) return { code: 0, stdout: JSON.stringify({ data: { targets: [{ machine: 'studio-2', aliases: [] }] } }), stderr: '' };
    argvs.push([file, ...args]);
    const a = answer(args);
    return { code: a.code, stdout: a.stdout ?? '', stderr: a.stderr ?? '' };
  };
  return { run: run as never, argvs };
}

test('FD-291 step 1: a machine whose Switchboard has the sessions page is read with `--rows --target`; odd rows are dropped', async () => {
  const f = fakeRows(() => ({ code: 0, stdout: page(ROWS) }));
  const r = new RemoteSessions(f.run, () => NOW);
  await r.poll(SB);
  assert.deepEqual(f.argvs, [[SB, '--json', 'sessions', '--rows', '--target', 'studio-2']]);
  const m = r.input()[0]!;
  assert.deepEqual(m.page!.map((p) => p.id), ['pid:4242', 'launch:L-1', 'stop:cc-abc-1', 'stop:cc-def-2', 'launch:L-2', 'launch:L-3'], 'an id of another form, an unknown group and a relative folder are skipped');
  assert.equal(r.status()[0]!.rows, 6);
});

test('FD-291 step 1: a Switchboard there without the page answers too old, and its launches are read with `--all` as before', async () => {
  const f = fakeRows((args) => (args.includes('--rows') ? { code: 2, stderr: "error: unexpected argument '--rows' found" } : { code: 0, stdout: listing('/w/a') }));
  const r = new RemoteSessions(f.run, () => NOW);
  await r.poll(SB);
  assert.deepEqual(f.argvs.map((a) => a[3]), ['--rows', '--all']);
  assert.deepEqual(r.input()[0]!.rows.map((s) => s.folder), ['/w/a']);
  assert.equal(r.input()[0]!.page, undefined);
  const old = fakeRows(() => ({ code: 0, stdout: listing('/w/a') }), '      --target <TARGET>\n      --remote-data-dir <REMOTE_DATA_DIR>\n');
  await new RemoteSessions(old.run, () => NOW).poll(SB);
  assert.deepEqual(old.argvs.map((a) => a[3]), ['--all'], 'a Switchboard here without --rows is not asked for it');
  const down = fakeRows(() => ({ code: 255, stderr: 'ssh: connect to host studio-2: Operation timed out' }));
  const d = new RemoteSessions(down.run, () => NOW);
  await d.poll(SB);
  assert.equal(down.argvs.length, 1, 'an unreachable machine is not asked twice');
  assert.equal(d.status()[0]!.state, 'unreachable');
});

test('FD-291 step 1: page rows become the machine\'s rows in their groups; acts on another machine are Continue, Open here and End', async () => {
  const f = fakeRows(() => ({ code: 0, stdout: page(ROWS) }));
  const r = new RemoteSessions(f.run, () => NOW);
  await r.poll(SB);
  const rows = mergeSessions({ now: NOW, switchboard: [], pending: [], stops: [], consoles: [], records: [], dismissed: [], remote: r.input(NOW) });
  const by = (id: string) => rows.find((x) => x.id === `rm:studio-2:${id}`)!;
  assert.equal(by('pid:4242').state, 'running-unmanaged');
  assert.equal(by('pid:4242').quietMinutes, 37);
  assert.equal(by('pid:4242').origin, 'machine');
  assert.deepEqual([by('launch:L-1').state, by('launch:L-1').actions], ['running-terminal', ['attach', 'end']]);
  assert.equal(by('launch:L-1').launch?.providerSessionId, 's1');
  assert.deepEqual([by('stop:cc-abc-1').state, by('stop:cc-abc-1').reason, by('stop:cc-abc-1').group], ['needs-you-not-opened', 'remote-ready', 'needs-you']);
  assert.deepEqual([by('stop:cc-abc-1').actions, by('stop:cc-abc-1').remoteSession, by('stop:cc-abc-1').resumable], [['continue', 'dismiss'], 'abc', true]);
  assert.equal(by('launch:L-2').actions.includes('continue' as never), false, 'an ended launch there is not continued from here');
  assert.deepEqual([by('stop:cc-def-2').state, by('stop:cc-def-2').expectedAt, by('stop:cc-def-2').origin], ['waiting-reset', NOW + 900_000, 'limit']);
  assert.equal(by('launch:L-2').state, 'ended');
  assert.equal(rows.find((x) => x.id === 'rm:studio-2:launch:L-3'), undefined, 'an ended row older than the list keeps is not listed');
  assert.ok(rows.every((x) => x.machine === 'studio-2'));
});

// FD-291: Continue for a stop another machine's Switchboard reads as ready (`sessions continue --in-place --hosted`, SB-400).
test('FD-291: Continue on another machine is one fixed argv over our ssh; a session id that is not one goes nowhere', () => {
  const [a, b] = parseTargets(TARGETS);
  assert.deepEqual(remoteContinueArgv(a!, 'e673ebe6-a533-4a96-895b-9575d7fdbee4'), ['/usr/bin/ssh', '-t', '-o', 'ConnectTimeout=5', 'me@192.0.2.9',
    `'${DEFAULT_REMOTE_SWITCHBOARD}' sessions continue 'e673ebe6-a533-4a96-895b-9575d7fdbee4' --in-place --hosted --surface dashboards`]);
  assert.equal(remoteContinueArgv(b!, 's1')!.at(-1), `'/opt/sb/bin/switchboard' sessions continue 's1' --in-place --hosted --surface dashboards --data-dir '/srv/sb data'`);
  for (const bad of ['', 'a b', "x';rm -rf ~;'", '$(id)', '-x', 'x'.repeat(129)].filter((x) => !LAUNCH_ID.test(x))) assert.equal(remoteContinueArgv(a!, bad), null);
});

test('FD-291: a ready stop there offers Continue only when its Switchboard does and its session id is safe', () => {
  const stop = ROWS[2]!;
  const rows = mergeSessions({ now: NOW, switchboard: [], pending: [], stops: [], consoles: [], records: [], dismissed: [], remote: [{ machine: 'studio-2', rows: [], page: parsePageRows({ rows: [
    stop, { ...stop, id: 'stop:cc-x-2', acts: [] }, { ...stop, id: 'stop:cc-x-3', session_id: 'bad id' }, { ...stop, id: 'stop:cc-x-4', session_id: null },
  ] }) }] });
  const by = (id: string) => rows.find((x) => x.id === `rm:studio-2:${id}`)!;
  assert.deepEqual(by('stop:cc-abc-1').actions, ['continue', 'dismiss']);
  for (const id of ['stop:cc-x-2', 'stop:cc-x-3', 'stop:cc-x-4']) {
    assert.deepEqual([by(id).actions, by(id).remoteSession, by(id).resumable], [['dismiss'], undefined, false], id);
  }
});

test('FD-291: the console host continues a ready stop there in a console of its own over ssh; a second press finds it', { skip: process.platform === 'win32' && 'the fake switchboard is a shell script' }, async () => {
  const base = tmp('fd-remote-continue-');
  const bin = path.join(base, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const spawned: string[][] = [];
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => true, log: () => undefined, testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (_file, args) => {
      if (args.at(-1) === '--help') return { code: 0, stdout: '      --rows\n      --target <TARGET>\n      --remote <REMOTE>\n      --remote-data-dir <REMOTE_DATA_DIR>\n', stderr: '' };
      if (args.join(' ') === '--json targets') return { code: 0, stdout: JSON.stringify({ data: { targets: [{ machine: 'studio-2', aliases: [] }] } }), stderr: '' };
      if (args.join(' ') === '--json sessions --rows --target studio-2') return { code: 0, stdout: page([{ ...ROWS[2], since: Date.now() / 1000 - 600 }]), stderr: '' };
      if (args.join(' ') === '--json sessions --all') return { code: 0, stdout: JSON.stringify({ ok: true, data: { sessions: [] } }), stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file: string, args: string[]) => { spawned.push([file, ...args]); return { pid: 2_100_000_000, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    killGroup: () => undefined, idleMs: 0,
    machine: async () => ({ freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }), keys: () => [], home: base,
  } as ConstructorParameters<typeof ConsoleHost>[0]);
  settings.update({ layout: { ...settings.get().layout, mode: 'sessions' } });
  await host.pollSessions();
  for (let i = 0; i < 50 && !host.sessionsStatus().rows.some((r) => r.machine === 'studio-2'); i++) await new Promise((r) => setTimeout(r, 10));
  const row = host.sessionsStatus().rows.find((r) => r.machine === 'studio-2')!;
  assert.deepEqual([row.reason, row.actions], ['remote-ready', ['continue', 'dismiss']]);
  const done = await host.continueSession(row.id);
  assert.equal(done.ok, true);
  assert.equal(spawned.length, 1);
  assert.ok(spawned[0]!.join(' ').endsWith(`studio-2 '${DEFAULT_REMOTE_SWITCHBOARD}' sessions continue 'abc' --in-place --hosted --surface dashboards`), JSON.stringify(spawned));
  assert.deepEqual(await host.continueSession(row.id), done, 'a second press finds the same console');
  assert.equal(spawned.length, 1);
});
