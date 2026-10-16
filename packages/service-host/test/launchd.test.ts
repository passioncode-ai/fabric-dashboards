// Reading launchd: `print` and `print-disabled` only — this package never changes a job.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execRunner, failureReason, LaunchdReader, parseDisabled, parsePrint, UNMANAGED, type Runner } from '../src/launchd';

test('launchctl output parsing', () => {
  assert.deepEqual(parsePrint('gui/501/x = {\n\tstate = running\n\tpid = 5542\n}'), { pid: 5542 });
  assert.deepEqual(parsePrint('state = not running'), { pid: null });
  const table = 'disabled services = {\n\t"com.example.plan-board" => disabled\n\t"com.other" => enabled\n\t"com.old" => true\n\t"com.a.b" => false\n}';
  assert.equal(parseDisabled(table, 'com.example.plan-board'), true);
  assert.equal(parseDisabled(table, 'com.other'), false);
  assert.equal(parseDisabled(table, 'com.old'), true);
  assert.equal(parseDisabled(table, 'com.a.b'), false);
  assert.equal(parseDisabled(table, 'com.absent'), false);
  assert.equal(parseDisabled(table, 'com.a+b'), false, 'a label is matched literally, not as a pattern');
});

test('status reads print and print-disabled, and nothing else', async () => {
  const calls: string[] = [];
  const run: Runner = async (cmd, args) => {
    calls.push(`${cmd} ${args.join(' ')}`);
    if (args[0] === 'print') return args[1] === 'gui/501/com.on' ? { code: 0, stdout: 'pid = 7\n', stderr: '' } : { code: 113, stdout: '', stderr: 'Could not find service' };
    if (args[0] === 'print-disabled') return { code: 0, stdout: '"com.off" => disabled\n', stderr: '' };
    throw new Error(`unexpected ${args[0]}`);
  };
  const reader = new LaunchdReader(run, 501);
  assert.deepEqual(await reader.status('com.on'), { loaded: true, pid: 7, disabled: false });
  assert.deepEqual(await reader.status('com.off'), { loaded: false, pid: null, disabled: true });
  const table = await reader.disabledTable();
  calls.length = 0;
  assert.deepEqual(await reader.status('com.off', table), { loaded: false, pid: null, disabled: true });
  assert.deepEqual(calls, ['launchctl print gui/501/com.off'], 'a table read once is reused');
  assert.ok(calls.every((c) => /^launchctl print(-disabled)? /.test(c)));
});

test('a launchctl that fails reads as not loaded, never throws', async () => {
  const reader = new LaunchdReader(async () => ({ code: 1, stdout: '', stderr: 'launchctl: command not found' }), 501);
  assert.equal(await reader.disabledTable(), '');
  assert.deepEqual(await reader.status('com.x'), { loaded: false, pid: null, disabled: false });
  assert.deepEqual(UNMANAGED, { managed: false, loaded: false, pid: null, disabled: false });
});

test('FD-69: a command killed at its deadline says so — the reason is not dropped for an empty stderr', { skip: process.platform === 'win32' && 'POSIX sleep' }, async () => {
  const r = await execRunner('/bin/sleep', ['5'], 200);
  assert.notEqual(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, 'no answer within 0.2 s (stopped)', 'the deadline is said, not Node\'s bare "Command failed" (FD-70)');
  const ok = await execRunner('/bin/sh', ['-c', 'echo out; echo err >&2; exit 3'], 5000);
  assert.deepEqual(ok, { code: 3, stdout: 'out\n', stderr: 'err\n' }, 'a command that wrote stderr keeps its own words');
});

test('FD-70: a failure with nothing on stderr names its cause — deadline, signal, exit code or a missing program', async () => {
  const silentExit = await execRunner('/bin/sh', ['-c', 'exit 4'], 5000);
  assert.deepEqual(silentExit, { code: 4, stdout: '', stderr: 'exit 4 with nothing on stderr' });
  const missing = await execRunner('/nonexistent/switchboard', [], 5000);
  assert.match(missing.stderr, /^ENOENT: /);
  assert.equal(failureReason(Object.assign(new Error('Command failed: x'), { killed: true, signal: 'SIGKILL' as NodeJS.Signals }), 10_000), 'ended by SIGKILL');
});
