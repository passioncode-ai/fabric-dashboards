// FD-206 (SCN-101): New session on another machine: Switchboard's targets, the projects that machine has, the start
// through `switchboard launch --target`, and the doors that carry the machine (dialog, console channel).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost, newSessionChoiceOf } from '../src/electron/console';
import { projectsOf, projectsProbeArgv, targetLaunchArgv, targetsOf, MACHINE } from '../src/core/target-session';
import { parseRequest } from '../src/core/console-channel';
import { SettingsStore } from '../src/core/settings';
import { newSessionFailText } from '../src/renderer/components/NewSessionDialog';
import { t } from '../src/core/i18n';
import { tmp } from './helpers';

const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtimes are shell scripts' };
const TARGETS = JSON.stringify({ ok: true, data: { targets: [{ machine: 'me@192.0.2.9', known_by: ['moves'] }, { machine: 'studio-org' }, { machine: '-oProxyCommand=x' }, { machine: 'me@192.0.2.9' }] } });
const PROJECTS = 'fabric-home:/srv/them\nfabric-folder:/srv/them/DATA/zeta\nfabric-folder:/srv/them/DATA/alpha\nfabric-folders-end\n';

function rig(o: { target?: boolean; answers?: boolean } = {}) {
  const base = tmp('fd-206-');
  const bin = path.join(base, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'goose'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const asked: string[][] = [];
  const exits = new Map<number, (e: { exitCode: number; signal?: number }) => void>();
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'), packRoot: path.join(base, 'packs'), mcpServer: () => ({ command: '/app/mcp', args: [] }),
    run: async (file, args) => {
      asked.push([file, ...args]);
      const line = args.join(' ');
      if (line === 'launch --help') return { code: 0, stdout: `--provider --in-place --surface${o.target === false ? '' : ' --target'}`, stderr: '' };
      if (line === '--json targets') return { code: 0, stdout: TARGETS, stderr: '' };
      if (file === '/usr/bin/ssh') return o.answers === false ? { code: 255, stdout: '', stderr: 'timeout' } : { code: 0, stdout: PROJECTS, stderr: '' };
      if (line.startsWith('--json project show')) return { code: 0, stdout: JSON.stringify({ ok: true, data: { project: null, rules: [] } }), stderr: '' };
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file, args, opts) => {
      spawned.push({ file, args, cwd: opts.cwd });
      const me = 2_100_000_000 + spawned.length;
      return { pid: me, onData: () => ({ dispose() {} }), onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { exits.set(me, cb); return { dispose() {} }; }, write() {}, resize() {}, kill() {} };
    },
    killGroup: (p) => { setTimeout(() => exits.get(p)?.({ exitCode: 0, signal: 1 }), 1); }, idleMs: 0,
    machine: async () => ({ freeDisk: 50 * 1024 ** 3, swap: null, running: 0 }),
    home: base,
  });
  return { host, base, bin, settings, spawned, asked };
}

test('FD-206: the targets are Switchboard\'s machines, each once, and nothing ssh could read as an option', async () => {
  const run = async () => ({ code: 0, stdout: TARGETS, stderr: '' });
  assert.deepEqual(await targetsOf(run, '/bin/sb'), ['me@192.0.2.9', 'studio-org']);
  assert.deepEqual(await targetsOf(async () => ({ code: 1, stdout: '', stderr: 'no' }), '/bin/sb'), []);
  assert.deepEqual(await targetsOf(async () => ({ code: 0, stdout: 'not json', stderr: '' }), '/bin/sb'), []);
  assert.equal(MACHINE.test('-oProxyCommand=x'), false);
  assert.equal(MACHINE.test('me@host;rm'), false);
});

test('FD-206: the projects probe asks a plain sh for the home and ~/DATA, and reads it; no answer is null', () => {
  const argv = projectsProbeArgv('me@192.0.2.9');
  assert.deepEqual(argv.slice(0, 7), ['/usr/bin/ssh', '-T', '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']);
  assert.equal(argv[7], 'me@192.0.2.9');
  assert.match(argv[8]!, /^\/bin\/sh -c '/);
  assert.match(argv[8]!, /DATA\/\*\//);
  assert.deepEqual(projectsOf({ code: 0, stdout: PROJECTS }), { home: '/srv/them', folders: ['/srv/them/DATA/alpha', '/srv/them/DATA/zeta'] });
  assert.deepEqual(projectsOf({ code: 0, stdout: 'fabric-home:/h\nfabric-folder:/h/DATA/_worktrees\nfabric-folder:/h/DATA/b\nfabric-folder:/h/DATA/a\nfabric-folders-end\n' })?.folders,
    ['/h/DATA/a', '/h/DATA/b', '/h/DATA/_worktrees'], 'service folders after the projects');
  assert.equal(projectsOf({ code: 255, stdout: '' }), null);
  assert.equal(projectsOf({ code: 0, stdout: 'fabric-home:/srv/them\n' }), null, 'a cut answer is no answer');
  assert.deepEqual(projectsOf({ code: 0, stdout: 'fabric-home:/srv/them\nfabric-folder:/etc/x\nfabric-folders-end\n' })?.folders, [], 'only folders under its home');
});

test('FD-206: the launch runs that machine\'s Switchboard in place, managed or isolated, with the runtime\'s arguments', () => {
  assert.deepEqual(targetLaunchArgv({ sb: '/bin/sb', machine: 'studio-org', provider: 'claude', isolated: false, folder: '/srv/them/DATA/a', args: ['--dangerously-skip-permissions'], surface: true }),
    ['/bin/sb', 'launch', '--target', 'studio-org', '--provider', 'claude', '--mode', 'managed', '--working-directory', '/srv/them/DATA/a', '--in-place', '--surface', 'dashboards', '--', '--dangerously-skip-permissions']);
  assert.deepEqual(targetLaunchArgv({ sb: '/bin/sb', machine: 'studio-org', provider: 'codex', isolated: true, folder: '/srv/them', args: [], surface: false }),
    ['/bin/sb', 'launch', '--target', 'studio-org', '--provider', 'codex', '--mode', 'isolated', '--working-directory', '/srv/them', '--in-place']);
});

test('FD-206 (SCN-101): a session on another machine starts through its Switchboard, lists the folder there, and Continue goes there again', POSIX, async () => {
  const r = rig();
  const o = await r.host.newSessionOptions();
  assert.deepEqual(o.machines, ['me@192.0.2.9', 'studio-org']);
  assert.equal(o.machine, null);
  assert.deepEqual(await r.host.machineFolders('studio-org'), { ok: true, home: '/srv/them', folders: ['/srv/them/DATA/alpha', '/srv/them/DATA/zeta'] });
  const done = await r.host.startNew({ kind: 'session', runtime: 'claude-code', folder: '/srv/them/DATA/alpha', bypass: true, isolated: false, machine: 'studio-org' }, { cols: 80, rows: 24 });
  assert.ok(done.ok);
  const key = done.ok ? done.key : '';
  const s = r.spawned[0]!;
  assert.equal(path.basename(s.file), 'switchboard');
  assert.deepEqual(s.args.slice(0, 9), ['launch', '--target', 'studio-org', '--provider', 'claude', '--mode', 'managed', '--working-directory', '/srv/them/DATA/alpha']);
  assert.ok(s.args.includes('--in-place') && s.args.includes('--dangerously-skip-permissions'));
  assert.equal(s.cwd, r.base, 'the terminal is this machine\'s');
  const row = r.host.sessionsStatus().rows.find((x) => x.key === key);
  assert.equal(row?.folder, '/srv/them/DATA/alpha');
  assert.match(r.host.manager.snapshot(key).label, /· studio-org$/);
  const next = await r.host.newSessionOptions();
  assert.equal(next.machine, 'studio-org');
  assert.equal(next.remoteFolder, '/srv/them/DATA/alpha');
  r.host.stopByPerson(key);
  await new Promise((res) => setTimeout(res, 30));
  assert.ok((await r.host.start(key, 'continue', { cols: 80, rows: 24 })).ok);
  const c = r.spawned[1]!;
  assert.deepEqual(c.args.slice(0, 4), ['launch', '--target', 'studio-org', '--provider']);
  assert.ok(c.args.includes('--continue'), 'Continue continues there');
});

test('FD-206: refused before it starts: a coding agent Switchboard cannot start there, an old Switchboard, an unknown machine', POSIX, async () => {
  const r = rig();
  const goose = await r.host.startNew({ kind: 'session', runtime: 'goose', folder: '/srv/them', bypass: false, isolated: false, machine: 'studio-org' }, { cols: 80, rows: 24 });
  assert.deepEqual(goose, { ok: false, reason: 'remote', detail: 'provider' });
  const unknown = await r.host.startNew({ kind: 'session', runtime: 'claude-code', folder: '/srv/them', bypass: false, isolated: false, machine: 'elsewhere' }, { cols: 80, rows: 24 });
  assert.deepEqual(unknown, { ok: false, reason: 'remote', detail: 'unknown-machine' });
  assert.deepEqual(await r.host.machineFolders('elsewhere'), { ok: false, why: 'unknown-machine' });
  const old = rig({ target: false });
  assert.deepEqual((await old.host.newSessionOptions()).machines, [], 'no machine is offered by a Switchboard without --target');
  assert.deepEqual(await old.host.startNew({ kind: 'session', runtime: 'claude-code', folder: '/srv/them', bypass: false, isolated: false, machine: 'studio-org' }, { cols: 80, rows: 24 }), { ok: false, reason: 'remote', detail: 'old-switchboard' });
  assert.deepEqual(r.spawned, []);
  const silent = rig({ answers: false });
  assert.deepEqual(await silent.host.machineFolders('studio-org'), { ok: false, why: 'unreachable' });
  const tt = (k: string, p?: Record<string, string | number>) => t('en', k, p);
  for (const d of ['provider', 'old-switchboard', 'no-switchboard', 'unknown-machine']) {
    assert.ok(!newSessionFailText(tt, { ok: false, reason: 'remote', detail: d }).startsWith('newSession.'), d);
  }
  assert.equal(newSessionFailText(tt, { ok: false, reason: 'remote', detail: 'provider' }), 'On another machine only Claude Code and Codex start.');
});

test('FD-206: the dialog\'s choice and the console channel carry a machine only with a folder there', () => {
  assert.deepEqual(newSessionChoiceOf({ kind: 'session', runtime: 'claude-code', folder: '/srv/them/DATA/a', bypass: true, isolated: false, machine: 'studio-org' }),
    { kind: 'session', runtime: 'claude-code', folder: '/srv/them/DATA/a', bypass: true, isolated: false, machine: 'studio-org' });
  assert.equal(newSessionChoiceOf({ kind: 'session', runtime: 'claude-code', folder: '/srv/them', bypass: true, isolated: false, machine: '-oProxyCommand=x' }), null);
  const ok = parseRequest(JSON.stringify({ key: 'k', op: 'session.new', start: { kind: 'session', machine: 'studio-org', folder: '/srv/them' } }));
  assert.ok(ok.ok && ok.request.start?.machine === 'studio-org');
  assert.deepEqual(parseRequest(JSON.stringify({ key: 'k', op: 'session.new', start: { kind: 'session', machine: 'studio-org' } })), { ok: false, code: 'bad-start' });
});

test('FD-206: a session\'s machine and its folder there survive a restart and a write that does not name them', () => {
  const dir = tmp('fd-206-settings-');
  const store = new SettingsStore(dir);
  store.update({ consoles: { 'session.abc123': { runtime: 'claude-code', folder: '/srv/them/DATA/a', machine: 'studio-org' } } });
  store.update({ consoles: { 'session.abc123': { runtime: 'claude-code', folder: '/srv/them/DATA/a', idle: null } } });
  const again = new SettingsStore(dir).get().consoles['session.abc123'];
  assert.equal(again?.machine, 'studio-org');
  assert.equal(again?.folder, '/srv/them/DATA/a');
});
