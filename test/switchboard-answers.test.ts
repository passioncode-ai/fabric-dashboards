import test from 'node:test';
import assert from 'node:assert/strict';
import { execRunner } from '@passioncode-ai/fabric-service-host';
import { handoverAskOf, launchFeatures, noAnswer } from '../src/core/switchboard';

const SLOW = { code: 1, stdout: '', stderr: 'no answer within 10 s (stopped)' };

// C2-02 (2026-11-17 connections audit): a help read that timed out says nothing about what Switchboard can do.
test('C2-02: noAnswer tells a read with no answer in time from a refusal', async () => {
  assert.equal(noAnswer(SLOW), true);
  assert.equal(noAnswer({ code: 1, stdout: '', stderr: 'ended by SIGKILL' }), true);
  assert.equal(noAnswer({ code: 2, stdout: '', stderr: "error: unrecognized subcommand 'capacity'" }), false, 'an old Switchboard answered');
  assert.equal(noAnswer({ code: 0, stdout: '{}', stderr: '' }), false);
  // The words are execRunner's own: a real command killed at its deadline reads so (Node itself, so every system has it).
  const r = await execRunner(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], 200);
  assert.equal(noAnswer(r), true, r.stderr);
});

test('C2-02: launchFeatures says a timed-out help read is not settled; handoverAskOf answers null for one', async () => {
  const run = async (_f: string, args: string[]) => (args.join(' ') === 'launch --help'
    ? { code: 0, stdout: '--provider --in-place --surface --hosted', stderr: '' } : SLOW);
  const f = await launchFeatures(run, '/sb');
  assert.equal(f.settled, false);
  assert.equal(f.hosted, false, 'unknown reads as absent for this start only');
  const full = await launchFeatures(async () => ({ code: 0, stdout: '--provider --in-place', stderr: '' }), '/sb');
  assert.equal(full.settled, true);
  assert.equal(await handoverAskOf(async () => SLOW, '/sb'), null);
  assert.equal(await handoverAskOf(async () => ({ code: 0, stdout: '--ask', stderr: '' }), '/sb'), true);
  assert.equal(await handoverAskOf(async () => ({ code: 2, stdout: '', stderr: 'error: unexpected argument' }), '/sb'), false);
});

test('FD-314 (C2-06): ownedRunner reads as execRunner does, and its deadline ends the whole group', async () => {
  const { ownedRunner } = await import('../src/core/children');
  const slow = await ownedRunner(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], 300);
  assert.equal(noAnswer(slow), true, slow.stderr);
  const ok = await ownedRunner(process.execPath, ['-e', 'process.stdout.write("hi")'], 10_000);
  assert.deepEqual([ok.code, ok.stdout], [0, 'hi']);
  const bad = await ownedRunner(process.execPath, ['-e', 'process.stderr.write("no"); process.exit(3)'], 10_000);
  assert.deepEqual([bad.code, bad.stderr.trim()], [3, 'no']);
  assert.equal(noAnswer(bad), false);
});

test('FD-319: the Switchboard version is read from --version and compared with the floor; an unknown one is not old', async () => {
  const { belowFloor, parseSwitchboardVersion, SWITCHBOARD_FLOOR } = await import('../src/core/switchboard');
  assert.equal(SWITCHBOARD_FLOOR, '0.7.111');
  assert.deepEqual(parseSwitchboardVersion('switchboard 0.7.114\n'), [0, 7, 114]);
  assert.equal(parseSwitchboardVersion('error: unexpected argument'), null);
  assert.equal(belowFloor([0, 7, 110]), true);
  assert.equal(belowFloor([0, 7, 111]), false);
  assert.equal(belowFloor([0, 8, 0]), false);
  assert.equal(belowFloor([0, 6, 999]), true);
  assert.equal(belowFloor(null), false);
});
