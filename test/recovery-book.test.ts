// FD-310 step 2: what limit recovery knows between two reads, out of ConsoleHost (FD-83, FD-233, FD-288, P2-06).
import assert from 'node:assert/strict';
import test from 'node:test';
import type { SbStop } from '../src/core/recovery';
import { ACTED_KEEP_MS, RecoveryBook } from '../src/core/recovery-book';
import type { StopView } from '../src/core/types';

const stop = (event: string, state = 'waiting') => ({ event, state }) as unknown as SbStop;
const view = (event: string, stoppedAt = 0, verdict: StopView['verdict'] = 'resume') => ({ event, session: 's', dir: '/d', provider: 'claude', stoppedAt, attempt: 1, verdict }) as StopView;
const nobody = () => false;

test('FD-310: a read keeps the stops listed, drops resumed, acted and taken ones from what is left to look at', () => {
  const b = new RecoveryBook();
  b.acted.set('e2', view('e2', 0, 'resumed'));
  const pending = b.read([stop('e1'), stop('e2'), stop('e3', 'resumed'), stop('e4')], 1000, (e) => e === 'e4');
  assert.deepEqual(pending.map((s) => s.event), ['e1']);
  assert.deepEqual([...b.last.keys()], ['e1', 'e2', 'e3', 'e4'], 'Continue now finds every stop listed');
});

test('FD-310 (P2-06): a stop acted on stays while listed, and goes a day after it stopped once it is not', () => {
  const b = new RecoveryBook();
  b.acted.set('old', view('old', 0));
  b.acted.set('young', view('young', 10));
  b.acted.set('listed', view('listed', 0));
  b.read([stop('listed')], ACTED_KEEP_MS + 5, nobody);
  assert.deepEqual([...b.acted.keys()].sort(), ['listed', 'young']);
});

test('FD-310 (FD-233, FD-288): a wait is logged once per reason, and forgotten with its stop', () => {
  const b = new RecoveryBook();
  assert.equal(b.noteWait('e1', 'disk'), true);
  assert.equal(b.noteWait('e1', 'disk'), false, 'the same reason again is not logged');
  assert.equal(b.noteWait('e1', 'swap'), true, 'a new reason is');
  assert.equal(b.waitingFor('e1'), 'swap');
  b.held.set('e1', { why: 'swap' } as never);
  b.read([stop('e2')], 0, nobody);
  assert.equal(b.waitingFor('e1'), undefined, 'a stop no longer listed forgets why it waited');
  assert.equal(b.held.has('e1'), false);
  b.noteWait('e2', 'disk');
  b.held.set('e2', { why: 'disk' } as never);
  b.clearWait('e2');
  assert.equal(b.waitingFor('e2'), undefined);
  assert.equal(b.held.has('e2'), false);
});

test('FD-310 (R1-U6): an unreadable recovery is degraded since its first failure, and a read clears it', () => {
  const b = new RecoveryBook();
  b.unreadable('error', 'no answer within 15 s', 100);
  b.unreadable('error', 'no answer within 15 s', 200);
  assert.equal(b.degraded?.since, 100);
  b.read([], 300, nobody);
  assert.equal(b.degraded, null);
});

test('FD-310 (F2 of FIX-2): what this launch did replaces the listed view at once, and the status says when it changed', () => {
  const b = new RecoveryBook();
  b.acted.set('e1', view('e1', 0, 'resumed'));
  const shown = b.withActed([view('e1'), view('e2')]);
  assert.deepEqual(shown.map((v) => [v.event, v.verdict]), [['e1', 'resumed'], ['e2', 'resume']]);
  assert.equal(b.set({ on: true, stops: shown, resumed: 1 }), true);
  assert.equal(b.set({ on: true, stops: shown, resumed: 1 }), false, 'the same status is not pushed again');
});
