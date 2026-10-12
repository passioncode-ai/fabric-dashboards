// FD-20 (audit M-3): the one control sequence both the app and the MCP tool run.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Descriptor, WellKnownResult } from '@passioncode-ai/fabric-service-host';
import { CONTROL_TIMEOUT_MS, controlService, type ControlDeps } from '../src/core/control';

const desc = (over: Partial<Descriptor> = {}): Descriptor => ({
  id: 'example-agent', instance: 'default', name: 'Example', origin: 'http://127.0.0.1:8899', placement: 'local',
  auth: { tokenFile: '~/t' }, lifecycle: { manager: 'launchd', label: 'ai.example.agent', plist: '/tmp/ai.example.agent.plist' },
  ...over,
} as unknown as Descriptor);
const answer = (pid: number, id = 'example-agent', instance = 'default') =>
  ({ kind: 'answer', doc: { service: { id, instance }, process: { pid } } } as unknown as WellKnownResult);
const none = { kind: 'no-answer', detail: 'refused' } as unknown as WellKnownResult;

function deps(answers: WellKnownResult[], over: Partial<ControlDeps> = {}) {
  let clock = 0;
  const calls: string[] = [];
  const d: ControlDeps = {
    platform: 'darwin',
    launchd: {
      start: async (l) => { calls.push(`start ${l}`); return { code: 0, stdout: '', stderr: '' }; },
      stop: async (l) => { calls.push(`stop ${l}`); return { code: 0, stdout: '', stderr: '' }; },
      restart: async (l) => { calls.push(`restart ${l}`); return { code: 0, stdout: '', stderr: '' }; },
    },
    wellKnown: async () => answers.length > 1 ? answers.shift()! : answers[0],
    exists: () => true,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    ...over,
  };
  return { d, calls };
}

test('FD-20: the refusals come first, in order, and launchctl is never called for one', async () => {
  for (const [d, why, platform] of [
    [desc({ placement: 'remote' } as Partial<Descriptor>), 'remote', 'darwin'],
    [desc(), 'unsupervised-here', 'linux'],
    [desc({ lifecycle: { manager: 'none' } } as Partial<Descriptor>), 'unmanaged', 'darwin'],
  ] as const) {
    const { d: dp, calls } = deps([none], { platform: platform as NodeJS.Platform });
    const out = await controlService(d, 'start', dp);
    assert.deepEqual(out, { kind: 'refused', why });
    assert.deepEqual(calls, []);
  }
  const { d: dp, calls } = deps([none], { exists: () => false });
  const out = await controlService(desc(), 'restart', dp);
  assert.equal(out.kind, 'refused');
  assert.equal((out as { why: string }).why, 'plist-missing');
  assert.deepEqual(calls, [], 'a missing plist is said at once, not retried by bootstrap (M-3)');
});

test('FD-20: a stop needs the service to stop answering; a stop that keeps answering says so', async () => {
  const stopped = await controlService(desc(), 'stop', deps([answer(10), none]).d);
  assert.equal(stopped.kind, 'stopped');
  const still = await controlService(desc(), 'stop', deps([answer(10)]).d);
  assert.equal(still.kind, 'still-answering');
});

test('FD-20: a restart needs a new pid as this service; another program on the port is not success', async () => {
  const ok = await controlService(desc(), 'restart', deps([answer(10), answer(10), answer(11)]).d, { oldPid: 10 });
  assert.deepEqual(ok.kind === 'answered' && ok.pid, 11);
  const foreign = await controlService(desc(), 'start', deps([answer(12, 'someone-else')]).d);
  assert.equal(foreign.kind, 'timeout');
});

test('FD-20: a duplicate whose stray copy keeps the port is named by its pid (U-15) — now for MCP too', async () => {
  const out = await controlService(desc(), 'restart', deps([answer(10)]).d, { oldPid: 10, duplicate: true });
  assert.deepEqual(out, { kind: 'stray-holds', pid: 10, port: 8899 });
});

test('FD-20: launchctl failing is its own outcome with its words', async () => {
  const { d } = deps([none], { launchd: { start: async () => ({ code: 5, stdout: '', stderr: 'Bootstrap failed: 5: Input/output error\n' }), stop: async () => ({ code: 0, stdout: '', stderr: '' }), restart: async () => ({ code: 0, stdout: '', stderr: '' }) } });
  assert.deepEqual(await controlService(desc(), 'start', d), { kind: 'launchctl-failed', detail: 'Bootstrap failed: 5: Input/output error' });
});

test('FD-20: the caller is told before launchctl runs, so a second click meets a busy service (R-8)', async () => {
  const order: string[] = [];
  const { d } = deps([answer(11)], {
    onLaunch: () => order.push('busy'),
    launchd: { start: async () => { order.push('launchctl'); return { code: 0, stdout: '', stderr: '' }; }, stop: async () => ({ code: 0, stdout: '', stderr: '' }), restart: async () => ({ code: 0, stdout: '', stderr: '' }) },
  });
  await controlService(desc(), 'start', d);
  assert.deepEqual(order, ['busy', 'launchctl']);
});

test('FD-20: the wait ends at the shared deadline', async () => {
  const { d } = deps([none]);
  const started = d.now();
  assert.equal((await controlService(desc(), 'start', d)).kind, 'timeout');
  assert.ok(d.now() - started >= CONTROL_TIMEOUT_MS);
});
