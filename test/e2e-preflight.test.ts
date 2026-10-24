// HV-02: the e2e suite refuses at once on a loaded Mac and runs its files one at a time unless asked otherwise.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MAX_LOAD, DEFAULT_MIN_FREE_GB, machineLimits, machineRefusal } from '../scripts/check-machine.mjs';
import { concurrencyArgs } from '../scripts/run-e2e.mjs';

const GB = 1024 ** 3;
const floors = { maxLoad: DEFAULT_MAX_LOAD, minFreeGb: DEFAULT_MIN_FREE_GB };

test('HV-02: a load above the floor or free disk under it refuses the run, with the reason and the override', () => {
  assert.equal(DEFAULT_MAX_LOAD, 150);
  assert.equal(DEFAULT_MIN_FREE_GB, 5);
  assert.equal(machineRefusal({ load1: 42, freeBytes: 80 * GB, ...floors }), null);
  assert.equal(machineRefusal({ load1: 150, freeBytes: 5 * GB, ...floors }), null, 'at the floor is allowed');
  assert.match(machineRefusal({ load1: 162.4, freeBytes: 80 * GB, ...floors })!, /load average is 162\.4, above 150.*FD_E2E_MAX_LOAD/);
  assert.match(machineRefusal({ load1: 3, freeBytes: 0.13 * GB, ...floors })!, /0\.1 GB of disk is free, under 5 GB.*FD_E2E_MIN_FREE_GB/);
  assert.equal(machineRefusal({ load1: Number.NaN, freeBytes: Number.NaN, ...floors }), null, 'a figure that cannot be read refuses nothing');
  assert.equal(machineRefusal({ load1: 162, freeBytes: 80 * GB, maxLoad: 400, minFreeGb: 5 }), null, 'an overridden floor runs');
});

test('HV-02: the floors come from the environment; a wrong value is an error, never a quiet default', () => {
  assert.deepEqual(machineLimits({}), floors);
  assert.deepEqual(machineLimits({ FD_E2E_MAX_LOAD: '300', FD_E2E_MIN_FREE_GB: '1.5' }), { maxLoad: 300, minFreeGb: 1.5 });
  assert.throws(() => machineLimits({ FD_E2E_MAX_LOAD: 'high' }), /FD_E2E_MAX_LOAD must be a non-negative number/);
  assert.throws(() => machineLimits({ FD_E2E_MIN_FREE_GB: '-1' }), /FD_E2E_MIN_FREE_GB/);
});

test('HV-02: the e2e files run one at a time unless --parallel or FD_E2E_CONCURRENCY asks for more', () => {
  assert.deepEqual(concurrencyArgs({}, []), ['--test-concurrency=1']);
  assert.deepEqual(concurrencyArgs({}, ['--parallel']), [], 'node\'s own default');
  assert.deepEqual(concurrencyArgs({ FD_E2E_CONCURRENCY: '3' }, []), ['--test-concurrency=3']);
  assert.throws(() => concurrencyArgs({ FD_E2E_CONCURRENCY: '0' }, []), /FD_E2E_CONCURRENCY must be a whole number/);
  assert.throws(() => concurrencyArgs({ FD_E2E_CONCURRENCY: 'all' }, []), /FD_E2E_CONCURRENCY/);
});
