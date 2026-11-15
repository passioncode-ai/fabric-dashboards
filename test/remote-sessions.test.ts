// FD-247 (step 4): another machine's sessions, read from its Switchboard over ssh (docs/design/2026-11-15-sessions-machines.md).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost } from '../src/electron/console';
import { SettingsStore } from '../src/core/settings';
import { tmp } from './helpers';
import { DEFAULT_REMOTE_SWITCHBOARD, parseTargets, readRemoteSessions, REMOTE_BACKOFF_MS, REMOTE_KEEP_MS, REMOTE_MAX_ROWS, REMOTE_POLL_MS, RemoteSessions, remoteSessionsArgv } from '../src/core/remote-sessions';
import { dropRemoteTwins, mergeSessions, remoteRowId, type SbSessionRecord, type SessionRow } from '../src/core/sessions';
import { DEFAULT_SETTINGS } from '../src/core/types';
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

function fakeMachines(answers: Record<string, () => { code: number; stdout?: string; stderr?: string }>) {
  const calls: string[] = [];
  let open = 0;
  let most = 0;
  const run = async (file: string, args: string[]) => {
    if (file === SB) { calls.push('targets'); return { code: 0, stdout: TWO, stderr: '' }; }
    const machine = args[args.length - 2]!;
    calls.push(machine);
    open += 1; most = Math.max(most, open);
    await new Promise((r) => setImmediate(r));
    open -= 1;
    const a = answers[machine]!();
    return { code: a.code, stdout: a.stdout ?? '', stderr: a.stderr ?? '' };
  };
  return { run: run as never, calls, most: () => most };
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
