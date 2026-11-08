// FD-178: LC-16's one retry after a failed update check never doubles the regular 5-minute check.
import assert from 'node:assert/strict';
import test from 'node:test';
import { RetryOnce } from '../src/core/retry-once';

const EVERY = 5 * 60_000;

test('FD-178: with a feed that keeps failing, the regular check and the retry read it once per 5 minutes, not twice', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let reads = 0;
  let state: 'idle' | 'checking' | 'error' = 'idle';
  // The updater's wiring: a check cancels the waiting retry; its failure arms one. The feed answers 504 after 300 ms
  // the first time and 100 ms after that, as `main.log` showed on 2026-11-08 (09:02:35.995, then 09:02:36.310): the
  // regular check fails before the retry armed by the previous failure is due.
  const check = () => {
    if (state === 'checking') return;
    retry.cancel();
    state = 'checking';
    reads++;
    setTimeout(() => { state = 'error'; retry.arm(); }, reads === 1 ? 300 : 100);
  };
  const retry = new RetryOnce(EVERY, () => { if (state === 'error') check(); });
  const interval = setInterval(check, EVERY);
  // In 50 ms steps: a timer set while the mock clock moves runs only at a later tick.
  for (let at = 0; at < 13 * EVERY + 1000; at += 50) t.mock.timers.tick(50);
  clearInterval(interval);
  assert.equal(reads, 13, `one read per 5 minutes over an hour (${reads})`);
});

test('FD-178: a failure with no check after it is retried once, and only once', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fired = 0;
  const retry = new RetryOnce(EVERY, () => { fired++; });
  retry.arm();
  retry.arm();
  assert.equal(retry.armed, true);
  t.mock.timers.tick(EVERY);
  assert.equal(fired, 1, 'two failures before it fired arm one retry');
  assert.equal(retry.armed, false);
  t.mock.timers.tick(EVERY * 3);
  assert.equal(fired, 1, 'the retry does not repeat by itself');
  retry.arm();
  retry.cancel();
  t.mock.timers.tick(EVERY);
  assert.equal(fired, 1, 'a check that started cancelled it');
});
