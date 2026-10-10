// FD-37 / PL-07: on Windows a command's leftovers are found by parent chain and creation time.
import assert from 'node:assert/strict';
import test from 'node:test';
import { descendantsOf, parseSnapshot } from '../src/core/proctree';

test('FD-37: descendants follow parent links, created at or after the command started', () => {
  const rows = [
    { pid: 4, ppid: 0, created: 0 },
    { pid: 100, ppid: 4, created: 1_000 }, // the command
    { pid: 101, ppid: 100, created: 1_010 },
    { pid: 102, ppid: 101, created: 1_020 }, // a grandchild
    { pid: 200, ppid: 4, created: 1_030 }, // unrelated
  ];
  assert.deepEqual(descendantsOf(rows, 100, 1_000).sort(), [101, 102]);
});

test('FD-37: a reused pid that predates the command is not ours, and neither is its subtree', () => {
  // The command (100) exited; pid 100 was reused long before by nobody — but a process created
  // earlier still names 100 as its parent: it is someone else's.
  const rows = [
    { pid: 300, ppid: 100, created: 500 },
    { pid: 301, ppid: 300, created: 1_200 },
    { pid: 101, ppid: 100, created: 1_100 },
  ];
  assert.deepEqual(descendantsOf(rows, 100, 1_000), [101]);
});

test('FD-37: a process that is its own parent, or a cycle, never loops', () => {
  const rows = [{ pid: 0, ppid: 0, created: 2_000 }, { pid: 7, ppid: 8, created: 2_000 }, { pid: 8, ppid: 7, created: 2_000 }];
  assert.deepEqual(descendantsOf(rows, 7, 1_000), [8]);
});

test('FD-37: the snapshot parser takes PowerShell\'s array or single object and refuses anything else', () => {
  assert.deepEqual(parseSnapshot('[{"pid":1,"ppid":0,"created":5}]'), [{ pid: 1, ppid: 0, created: 5 }]);
  assert.deepEqual(parseSnapshot('{"pid":1,"ppid":0,"created":5}'), [{ pid: 1, ppid: 0, created: 5 }]);
  assert.deepEqual(parseSnapshot('Access denied'), []);
  assert.deepEqual(parseSnapshot('[{"pid":"x"}]'), []);
});
