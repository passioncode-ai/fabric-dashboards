// FD-49, lifecycle LC-17: a console session starts only when the machine can carry it.
import assert from 'node:assert/strict';
import os from 'node:os';
import test from 'node:test';
import { admit, CONSOLE_SESSION_CAP, machineProbe, MIN_FREE_DISK_BYTES, parseMeminfo, parseSwapUsage } from '../src/core/admission';

const GB = 1024 ** 3;
const roomy = { freeDisk: 50 * GB, swap: { total: 4 * GB, free: 3 * GB }, running: 0 };

test('LC-17: a machine with room admits the start', () => {
  assert.deepEqual(admit(roomy), { ok: true });
});

test('LC-17: below 5 GB free the start is deferred, with the free space it saw', () => {
  const out = admit({ ...roomy, freeDisk: MIN_FREE_DISK_BYTES - 1 });
  assert.deepEqual(out, { ok: false, why: 'disk', freeDisk: MIN_FREE_DISK_BYTES - 1 });
  assert.deepEqual(admit({ ...roomy, freeDisk: MIN_FREE_DISK_BYTES }), { ok: true }, '5 GB exactly is enough');
});

test('LC-17: exhausted swap defers the start; no swap at all, or a system that does not say, does not', () => {
  assert.equal(admit({ ...roomy, swap: { total: 4 * GB, free: 0.04 * 4 * GB } }).ok, false);
  assert.equal(admit({ ...roomy, swap: { total: 0, free: 0 } }).ok, true, 'no swap configured is not exhausted swap');
  assert.equal(admit({ ...roomy, swap: null }).ok, true);
  assert.equal(admit({ ...roomy, swap: { total: 8 * GB, free: 0.04 * 8 * GB, growable: true } }).ok, true, 'macOS grows its swap while the disk has room: the disk floor decides');
});

test('LC-17: the live-session cap comes first, and an unreadable disk is not a refusal', () => {
  assert.deepEqual(admit({ ...roomy, running: CONSOLE_SESSION_CAP, freeDisk: 1 }), { ok: false, why: 'cap', running: CONSOLE_SESSION_CAP, cap: CONSOLE_SESSION_CAP });
  assert.deepEqual(admit({ ...roomy, freeDisk: null }), { ok: true });
});

test('LC-17: macOS and Linux swap answers are read in bytes', () => {
  assert.deepEqual(parseSwapUsage('total = 4096.00M  used = 3500.00M  free = 596.00M  (encrypted)'), { total: 4096 * 1024 ** 2, free: 596 * 1024 ** 2 });
  assert.deepEqual(parseSwapUsage('total = 0.00M  used = 0.00M  free = 0.00M  (encrypted)'), { total: 0, free: 0 });
  assert.equal(parseSwapUsage('garbage'), null);
  assert.deepEqual(parseMeminfo('MemTotal: 1 kB\nSwapTotal:       2097148 kB\nSwapFree:        1048576 kB\n'), { total: 2097148 * 1024, free: 1048576 * 1024 });
});

test('LC-17: the real probe reads this machine without throwing', async () => {
  const m = await machineProbe(os.tmpdir(), 0);
  assert.ok(m.freeDisk === null || m.freeDisk > 0);
  assert.equal(m.running, 0);
});
