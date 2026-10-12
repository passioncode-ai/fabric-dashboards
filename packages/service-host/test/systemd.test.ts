// FD-55 (contract DEC-0057): systemd's MainPID is the supervisor pid a waiting copy is compared with.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSystemdShow, SystemdReader } from '../src/systemd';

test('FD-55: systemctl show is read into the status launchd gives', () => {
  assert.deepEqual(parseSystemdShow('LoadState=loaded\nActiveState=active\nMainPID=4242\nUnitFileState=enabled\n'), { loaded: true, pid: 4242, disabled: false });
  assert.deepEqual(parseSystemdShow('LoadState=loaded\nActiveState=inactive\nMainPID=0\nUnitFileState=disabled\n'), { loaded: false, pid: null, disabled: true });
  assert.deepEqual(parseSystemdShow('LoadState=not-found\nActiveState=inactive\nMainPID=0\nUnitFileState=\n'), { loaded: false, pid: null, disabled: false });
  assert.equal(parseSystemdShow('LoadState=loaded\nActiveState=activating\nMainPID=7\nUnitFileState=masked\n').disabled, true);
});

test('FD-55: the reader asks systemd --user for exactly those four properties, and a failure is "not loaded"', async () => {
  const calls: string[][] = [];
  const reader = new SystemdReader(async (cmd, args) => { calls.push([cmd, ...args]); return { code: 0, stdout: 'LoadState=loaded\nActiveState=active\nMainPID=9\nUnitFileState=enabled\n', stderr: '' }; });
  assert.deepEqual(await reader.status('example-agent.service'), { loaded: true, pid: 9, disabled: false });
  assert.deepEqual(calls, [['systemctl', '--user', 'show', 'example-agent.service', '-p', 'LoadState,ActiveState,MainPID,UnitFileState']]);
  const failing = new SystemdReader(async () => ({ code: 1, stdout: '', stderr: 'Failed to connect to bus' }));
  assert.deepEqual(await failing.status('x.service'), { loaded: false, pid: null, disabled: false });
});
