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
