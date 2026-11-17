import test from 'node:test';
import assert from 'node:assert/strict';
import { HandoverBook, SEEN_HANDOVERS_MAX } from '../src/core/handover-book';
import type { SbHandover } from '../src/core/switchboard';

const h = (id: string, offeredUntil = 2_000): SbHandover => ({ id, dir: '/w', agent: 'claude-code', account: 'a', workflow: 'wf', offeredUntil } as SbHandover);

// FD-307 (refactor wave 7): what a hand-overs read means, out of ConsoleHost, with the behaviour it had there.
test('FD-307: each offer is fresh once, in Switchboard\'s order; a lapsed one is fresh and expired', () => {
  const b = new HandoverBook();
  const r1 = b.read({ enabled: true, handovers: [h('a'), h('old', 500), h('b')] }, 1_000);
  assert.deepEqual(r1.fresh.map((f) => [f.handover.id, f.expired]), [['a', false], ['old', true], ['b', false]]);
  assert.equal(r1.log, null);
  assert.equal(b.enabled, true);
  assert.deepEqual(b.pending?.map((p) => p.id), ['a', 'old', 'b']);
  assert.deepEqual(b.read({ enabled: true, handovers: [h('a'), h('b'), h('c')] }, 1_100).fresh.map((f) => f.handover.id), ['c']);
});

test('FD-307 (FD-69): a list that cannot be read is said once, kept degraded since its first failure, and its recovery is said', () => {
  const b = new HandoverBook();
  const first = b.read({ unavailable: 'error', detail: 'timed out' }, 1_000);
  assert.match(first.log ?? '', /cannot be read \(error\)/);
  assert.equal(b.read({ unavailable: 'error', detail: 'again' }, 2_000).log, null, 'not said twice');
  assert.equal(b.degraded?.since, 1_000);
  assert.equal(b.degraded?.detail, 'again');
  const back = b.read({ enabled: false, handovers: [] }, 3_000);
  assert.equal(back.log, 'console: hand-overs can be read again');
  assert.equal(b.degraded, null);
  assert.equal(b.enabled, false);
});

test('FD-307: at most SEEN_HANDOVERS_MAX offers are remembered; the oldest is offered again after that', () => {
  const b = new HandoverBook();
  b.read({ enabled: true, handovers: Array.from({ length: SEEN_HANDOVERS_MAX + 1 }, (_, i) => h(`x${i}`)) }, 0);
  // x0 was forgotten; taking it in again forgets the next oldest (x1) before x1 is looked at, as ConsoleHost did.
  assert.deepEqual(b.read({ enabled: true, handovers: [h('x0'), h('x1')] }, 0).fresh.map((f) => f.handover.id), ['x0', 'x1']);
  assert.deepEqual(b.read({ enabled: true, handovers: [h('x5')] }, 0).fresh, [], 'a newer one is still remembered');
});

test('FD-314 (P2-03): a hand-over read that got no answer in time makes the host slow; any other failure does not', { skip: process.platform === 'win32' && 'POSIX execute bits: the fake switchboard is a shell script' }, async () => {
  const { ConsoleHost } = await import('../src/electron/console');
  const { SettingsStore } = await import('../src/core/settings');
  const { tmp } = await import('./helpers');
  const fs = await import('node:fs');
  const path = await import('node:path');
  for (const [stderr, slow] of [['no answer within 20 s (stopped)', true], ['error: something else', false]] as const) {
    const base = tmp('fd-314-');
    const bin = path.join(base, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
    const host = new ConsoleHost({
      settings: new SettingsStore(path.join(base, 'data')), snapshot: () => null, window: () => null, visible: () => false, log: () => {},
      testDirs: [bin], scriptsDir: path.join(base, 'scripts'), home: base,
      run: async (_f, args) => (args.join(' ') === '--json handovers' ? { code: 1, stdout: '', stderr } : { code: 1, stdout: '', stderr: '' }),
    } as never);
    await host.pollHandovers();
    assert.equal(host.switchboardSlow(), slow, stderr);
  }
});
