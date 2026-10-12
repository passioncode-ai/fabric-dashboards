// FD-43 (Switchboard SB-95 sessions beside the agent) and FD-51 (LC-20: every Claude Code / Codex
// console start runs managed through Switchboard; say when Switchboard moved the session, SB-98).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { RunResult } from '@passioncode-ai/fabric-service-host';
import { planStart } from '../src/core/consoles';
import { KNOWN_RUNTIMES } from '../src/core/runtimes';
import { accountsOf, managesProvider, sessionsIn } from '../src/core/switchboard';
import { ConsoleHost } from '../src/electron/console';
import { tmp } from './helpers';

const ok = (data: unknown): RunResult => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });
const ACCOUNTS = { routes: { 'claude:default': 'acc-2', 'codex:default': 'acc-9' }, accounts: [{ id: 'acc-1', label: 'Work 1' }, { id: 'acc-2', label: 'Work 2' }] };

function runner(folder: string, sessions: unknown[] | 'old') {
  return async (_file: string, args: string[]): Promise<RunResult> => {
    const a = args.join(' ');
    if (a === '--json accounts list') return ok(ACCOUNTS);
    if (a === '--json sessions') return sessions === 'old' ? { code: 2, stdout: '', stderr: "error: unrecognized subcommand 'sessions'" } : ok({ sessions });
    if (a === 'launch --help') return { code: 0, stdout: '--in-place --provider', stderr: '' };
    if (a.startsWith('--json project show')) return ok({ project: null, rules: [] });
    if (a === '--json agents list') return ok({ agents: [] });
    return { code: 1, stdout: '', stderr: `unexpected ${a} in ${folder}` };
  };
}

test('FD-43: only the sessions launched in this folder, newest first, with label, mode and launch time', async () => {
  const folder = tmp('fd-sb-folder-');
  const other = tmp('fd-sb-other-');
  const run = runner(folder, [
    { working_directory: other, state: 'running', label: 'Elsewhere', mode: 'managed', provider: 'claude', pool: 'default', account_id: 'acc-2', launched_at: 1_760_000_000 },
    { working_directory: folder, state: 'running', label: 'Work 2', mode: 'managed', provider: 'claude', pool: 'default', account_id: 'acc-2', launched_at: 1_760_000_100 },
    { working_directory: folder, state: 'starting', label: 'Work 1', mode: 'isolated', provider: 'claude', pool: 'default', account_id: 'acc-1', launched_at: 1_760_000_200 },
  ]);
  const r = await sessionsIn(run, '/sb', folder, await accountsOf(run, '/sb'));
  assert.ok('sessions' in r);
  assert.deepEqual(r.sessions.map((s) => [s.label, s.state, s.mode]), [['Work 1', 'starting', 'isolated'], ['Work 2', 'running', 'managed']]);
  assert.equal(r.sessions[0]!.launchedAt, 1_760_000_200_000, 'seconds read as milliseconds');
  assert.equal(r.sessions[1]!.movedTo, null, 'the pool still selects the account it was launched on');
});

test('FD-51 (SB-98): a managed session whose pool now selects another account was moved — to that account', async () => {
  const folder = tmp('fd-sb-moved-');
  const run = runner(folder, [{ working_directory: folder, state: 'running', label: 'Work 1', mode: 'managed', provider: 'claude', pool: 'default', account_id: 'acc-1', launched_at: 1 }]);
  const r = await sessionsIn(run, '/sb', folder, await accountsOf(run, '/sb'));
  assert.ok('sessions' in r);
  assert.equal(r.sessions[0]!.movedTo, 'Work 2');
  const isolated = runner(folder, [{ working_directory: folder, state: 'running', mode: 'isolated', provider: 'claude', pool: 'default', account_id: 'acc-1' }]);
  const s = await sessionsIn(isolated, '/sb', folder, await accountsOf(isolated, '/sb'));
  assert.ok('sessions' in s && s.sessions[0]!.movedTo === null, 'an isolated session never moves');
});

test('FD-43: a Switchboard before SB-95 says it cannot list sessions, rather than showing none', async () => {
  const folder = tmp('fd-sb-old-');
  const r = await sessionsIn(runner(folder, 'old'), '/sb', folder, null);
  assert.equal('unavailable' in r && r.unavailable, 'old');
});

test('FD-51 (LC-20): with a Switchboard route for the provider, an unbound folder starts managed, in place', () => {
  const claude = { ...KNOWN_RUNTIMES.find((r) => r.id === 'claude-code')!, path: '/bin/claude' };
  const base = { runtime: claude, mode: 'new' as const, folder: '/w', binding: { kind: 'none' as const }, switchboard: '/sb', inPlace: true };
  assert.deepEqual(planStart({ ...base, managed: true }), { kind: 'run', argv: ['/sb', 'launch', '--provider', 'claude', '--mode', 'managed', '--working-directory', '/w', '--in-place'], cwd: '/w' });
  assert.deepEqual(planStart({ ...base, managed: false }), { kind: 'run', argv: ['/bin/claude'], cwd: '/w' }, 'no route: the ordinary sign-in');
  assert.deepEqual(planStart({ ...base, managed: true, inPlace: false }), { kind: 'run', argv: ['/bin/claude'], cwd: '/w' }, 'a Switchboard that cannot launch in place cannot host it in the console');
  assert.equal(managesProvider({ routes: { 'codex:default': 'x' }, labels: {} }, 'claude'), false);
  assert.equal(managesProvider({ routes: { 'claude:team': 'x' }, labels: {} }, 'claude'), true);
});

test('FD-51 (LC-20): the console start itself goes through Switchboard when it manages the provider', async () => {
  const base = tmp('fd-sb-host-');
  const bin = path.join(base, 'bin');
  const folder = path.join(base, 'agent');
  fs.mkdirSync(bin); fs.mkdirSync(folder);
  for (const name of ['claude', 'switchboard']) fs.writeFileSync(path.join(bin, name), '#!/bin/sh\n', { mode: 0o755 });
  let settings = { consoles: { 'example-agent.default': { runtime: 'claude-code', folder } } } as Record<string, unknown>;
  const spawned: string[][] = [];
  const host = new ConsoleHost({
    settings: { get: () => settings, update: (p: Record<string, unknown>) => { settings = { ...settings, ...p }; } } as never,
    snapshot: () => null, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'), run: runner(folder, []),
    spawn: (file, args) => { spawned.push([file, ...args]); return { pid: 1, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    machine: async () => ({ freeDisk: null, swap: null, running: 0 }),
  });
  assert.deepEqual(await host.start('example-agent.default', 'new', { cols: 80, rows: 24 }), { ok: true });
  assert.equal(spawned[0]![0], path.join(bin, 'switchboard'));
  assert.ok(spawned[0]!.includes('managed') && spawned[0]!.includes('--in-place'), spawned[0]!.join(' '));
  const listed = await host.sessions('example-agent.default');
  assert.ok('sessions' in listed);
});
