// FD-62 (Switchboard SB-108): hand-overs Switchboard leaves for a console. The CLI's answer is parsed
// strictly; each hand-over is taken once, on the console of the agent whose folder it is when that console is
// free, else on a console of its own; one the machine cannot carry (LC-17) is left for Switchboard's Terminal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Runner } from '@passioncode-ai/fabric-service-host';
import { ConsoleHost } from '../src/electron/console';
import { handoverKey, handoverRunArgv, handoversOf, isHandoverKey, type SbHandover } from '../src/core/switchboard';
import { tmp } from './helpers';

const GB = 1024 ** 3;
const ID = 'ho-0123456789ab';
const ok = (data: unknown) => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });
const record = (o: Record<string, unknown> = {}) => ({ id: ID, workflow: 'nightly-report', agent: 'claude-code', account_label: 'Work Max', dir: '/tmp', script: '/private/x.sh', offered_until: new Date(Date.now() + 60_000).toISOString(), created_at: 1, ...o });

test('FD-62: the hand-over list is read strictly — a malformed record is skipped, never guessed at', async () => {
  const run: Runner = async () => ok({ enabled: true, handovers: [record(), record({ id: 'ho-XYZ' }), record({ id: 'ho-0123456789ac', dir: 'relative/dir' }), record({ id: 'ho-0123456789ad', offered_until: 'soon' })] });
  const r = await handoversOf(run, '/bin/switchboard');
  assert.ok('handovers' in r);
  assert.equal(r.enabled, true);
  assert.deepEqual(r.handovers.map((h) => h.id), [ID]);
  assert.deepEqual({ ...r.handovers[0], offeredUntil: 0 }, { id: ID, workflow: 'nightly-report', agent: 'claude-code', account: 'Work Max', dir: '/tmp', offeredUntil: 0 });
});

test('FD-62: a running Switchboard older than its CLI, or one without hand-overs, says so; anything else is an error', async () => {
  const older: Runner = async () => ({ code: 1, stdout: JSON.stringify({ ok: false, error: 'The running Switchboard is an earlier version than this command and does not know it. Restart Switchboard to finish its update.' }), stderr: '' });
  assert.deepEqual(await handoversOf(older, 'sb'), { unavailable: 'old', detail: 'The running Switchboard is an earlier version than this command and does not know it. Restart Switchboard to finish its update.' });
  const before: Runner = async () => ({ code: 2, stdout: '', stderr: "error: unrecognized subcommand 'handovers'" });
  assert.equal(((await handoversOf(before, 'sb')) as { unavailable: string }).unavailable, 'old');
  const broken: Runner = async () => ({ code: 1, stdout: '', stderr: 'disk full' });
  assert.deepEqual(await handoversOf(broken, 'sb'), { unavailable: 'error', detail: 'disk full' });
});

test('FD-62: a hand-over opens in the free console of the agent whose folder it is, else in a console of its own', () => {
  const base = tmp('fd-ho-key-');
  const h: SbHandover = { id: ID, workflow: 'w', agent: 'claude-code', account: 'a', dir: base, offeredUntil: Date.now() + 60_000 };
  assert.equal(handoverKey(h, [{ key: 'other.default', folder: '/elsewhere', running: false }, { key: 'agent.default', folder: base, running: false }]), 'agent.default');
  assert.equal(handoverKey(h, [{ key: 'agent.default', folder: base, running: true }]), `handover.${ID}`, 'a running console is never doubled');
  assert.equal(handoverKey(h, []), `handover.${ID}`);
  assert.ok(isHandoverKey(`handover.${ID}`));
  assert.ok(!isHandoverKey('handover.something'));
  assert.deepEqual(handoverRunArgv('/bin/switchboard', ID), ['/bin/switchboard', 'handovers', 'run', ID]);
});

function rig(o: { freeDisk?: number; handovers?: unknown[]; switchboard?: boolean; serviceFolder?: string } = {}) {
  const base = tmp('fd-ho-');
  const bin = path.join(base, 'bin');
  const dir = path.join(base, 'checkout');
  fs.mkdirSync(bin); fs.mkdirSync(dir);
  if (o.switchboard !== false) fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  let settings = { consoles: o.serviceFolder ? { 'agent.default': { runtime: 'claude-code', folder: o.serviceFolder === 'same' ? dir : o.serviceFolder } } : {} } as Record<string, unknown>;
  const calls: string[][] = [];
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const exits: ((e: { exitCode: number; signal?: number }) => void)[] = [];
  const logs: string[] = [];
  let changed = 0;
  const handovers = o.handovers ?? [record({ dir })];
  const host = new ConsoleHost({
    settings: { get: () => settings, update: (p: Record<string, unknown>) => { settings = { ...settings, ...p }; } } as never,
    snapshot: () => null, window: () => null, visible: () => false, log: (l) => logs.push(l),
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async (_file, args) => {
      calls.push(args);
      if (args.join(' ') === '--json handovers') return ok({ enabled: true, handovers });
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file, args, opts) => {
      spawned.push({ file, args, cwd: opts.cwd });
      return { pid: 999_999_999, onData: () => ({ dispose() {} }), onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { exits.push(cb); return { dispose() {} }; }, write() {}, resize() {}, kill() {} };
    },
    killGroup: () => {},
    idleMs: 0,
    machine: async () => ({ freeDisk: o.freeDisk ?? 50 * GB, swap: null, running: 0 }),
    keys: () => (o.serviceFolder ? ['agent.default'] : []),
    changed: () => { changed += 1; },
  });
  return { host, dir, calls, spawned, exits, logs, changed: () => changed, sb: path.join(bin, 'switchboard') };
}

const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake switchboard is a shell script' };

test('FD-62: a waiting hand-over is taken once, on a console of its own, and the shell lists it until it is closed', POSIX, async () => {
  const r = rig();
  assert.deepEqual(await r.host.pollHandovers(), [`handover.${ID}`]);
  assert.deepEqual(r.spawned, [{ file: r.sb, args: ['handovers', 'run', ID], cwd: r.dir }]);
  assert.deepEqual(await r.host.pollHandovers(), [], 'the same hand-over is never taken twice');
  assert.equal(r.spawned.length, 1);
  assert.deepEqual(r.host.handoverConsoles(), [{ key: `handover.${ID}`, workflow: 'nightly-report', agent: 'claude-code', account: 'Work Max', dir: r.dir, state: 'running', kind: 'handover' }]);
  assert.equal(r.changed(), 1);
  const info = await r.host.info(`handover.${ID}`);
  assert.deepEqual(info.handover, { id: ID, workflow: 'nightly-report', agent: 'claude-code', account: 'Work Max', dir: r.dir, kind: 'handover' });
  r.host.dismissHandover(`handover.${ID}`);
  assert.equal(r.host.handoverConsoles().length, 1, 'a running hand-over is not closed from the list');
  r.exits[0]!({ exitCode: 0 });
  assert.equal(r.host.handoverConsoles()[0]!.state, 'exited');
  assert.deepEqual(await r.host.pollHandovers(), [], 'still listed after its session ended: not taken again');
  assert.equal(r.spawned.length, 1);
  r.host.dismissHandover(`handover.${ID}`);
  assert.deepEqual(r.host.handoverConsoles(), []);
});

test('FD-62: a hand-over in an agent\'s folder opens in that agent\'s free console', POSIX, async () => {
  const r = rig({ serviceFolder: 'same' });
  assert.deepEqual(await r.host.pollHandovers(), ['agent.default']);
  assert.equal((await r.host.info('agent.default')).handover?.id, ID);
  assert.deepEqual(r.host.handoverConsoles(), [], 'it runs in the agent\'s console, not in a list of its own');
});

test('FD-62: one the machine cannot carry (LC-17), a lapsed offer or a folder not here is left to Switchboard\'s Terminal', POSIX, async () => {
  const short = rig({ freeDisk: 1.8 * GB });
  assert.deepEqual(await short.host.pollHandovers(), []);
  assert.deepEqual(short.spawned, []);
  assert.match(short.logs.join('\n'), /hand-over ho-0123456789ab left to Terminal \(LC-17: disk\)/);
  const lapsed = rig({ handovers: [record({ dir: '/tmp', offered_until: new Date(Date.now() - 1000).toISOString() })] });
  assert.deepEqual(await lapsed.host.pollHandovers(), []);
  const away = rig({ handovers: [record({ dir: '/nonexistent/checkout' })] });
  assert.deepEqual(await away.host.pollHandovers(), []);
  assert.match(away.logs.join('\n'), /its folder is not here/);
});

test('FD-62: without Switchboard nothing is read', POSIX, async () => {
  const r = rig({ switchboard: false });
  assert.deepEqual(await r.host.pollHandovers(), []);
  assert.deepEqual(r.calls, []);
});

test('FD-69: a hand-over read that failed and then works again is said once each way', POSIX, async () => {
  const r = rig();
  let fail = true;
  const host = r.host as unknown as { run: Runner };
  const real = host.run;
  host.run = async (file, args, ms) => (fail && args.join(' ') === '--json handovers' ? { code: 1, stdout: '', stderr: 'killed' } : real(file, args, ms));
  await r.host.pollHandovers();
  await r.host.pollHandovers();
  fail = false;
  await r.host.pollHandovers();
  await r.host.pollHandovers();
  assert.equal(r.logs.filter((l) => /hand-overs cannot be read \(error\): killed/.test(l)).length, 1, 'the failure is logged once, with its reason');
  assert.equal(r.logs.filter((l) => /hand-overs can be read again/.test(l)).length, 1, 'the recovery is logged once');
});
