// FD-310 step 1: the stop-claim state limit recovery and quit share, out of ConsoleHost (F2, F3 of FIX-2 and FIX-4).
import assert from 'node:assert/strict';
import test from 'node:test';
import type { SbStop } from '../src/core/recovery';
import { StopClaims } from '../src/core/stop-claims';

const stop = (event: string) => ({ event }) as SbStop;

test('FD-310: a stop is taken by one path until its work settles, and the quit sees the work in flight', async () => {
  const c = new StopClaims();
  let release!: () => void;
  const p = c.track('e1', () => new Promise<void>((r) => { release = r; }));
  assert.equal(c.isTaking('e1'), true);
  assert.equal(c.work(), 1);
  assert.deepEqual(c.running(), [p]);
  release();
  await p;
  await Promise.resolve();
  assert.equal(c.isTaking('e1'), false);
  assert.equal(c.work(), 0);
  const failed = c.track('e2', () => Promise.reject(new Error('no')));
  await failed.catch(() => undefined);
  await Promise.resolve();
  assert.equal(c.isTaking('e2'), false, 'a failed continue frees its stop too');
});

test('FD-310: a claim on the wire is open for the quit, and only while it is on the wire', async () => {
  const c = new StopClaims();
  let answer!: (ok: boolean) => void;
  const claim = c.claim(stop('e1'), '/sb', () => new Promise<boolean>((r) => { answer = r; }));
  assert.deepEqual(c.open().map((o) => o.stop.event), ['e1']);
  assert.equal(c.work(), 1);
  answer(false);
  assert.equal(await claim, false);
  assert.deepEqual(c.open(), [], 'a refused claim leaves nothing to finish');
  await assert.rejects(c.claim(stop('e2'), '/sb', () => Promise.reject(new Error('down'))));
  assert.deepEqual(c.open(), [], 'nor does a claim that threw');
});

test('FD-310: a claimed stop stays open until a finish is taken; a refused finish keeps the outcome it meant', () => {
  const c = new StopClaims();
  c.claimed(stop('e1'), '/sb');
  assert.deepEqual(c.open(), [{ stop: stop('e1'), sb: '/sb' }]);
  c.finished(stop('e1'), '/sb', 'resumed', false);
  assert.deepEqual(c.open(), [{ stop: stop('e1'), sb: '/sb', outcome: 'resumed' }], 'the quit tries the same outcome again');
  c.finished(stop('e1'), '/sb', 'resumed', true);
  assert.deepEqual(c.open(), []);
  assert.equal(c.work(), 0);
});

test('FD-310: a stop both on the wire and claimed is finished once by the quit', async () => {
  const c = new StopClaims();
  c.claimed(stop('e1'), '/sb');
  let answer!: () => void;
  const claim = c.claim(stop('e1'), '/sb', () => new Promise<void>((r) => { answer = r; }));
  assert.equal(c.open().length, 1);
  answer();
  await claim;
});
