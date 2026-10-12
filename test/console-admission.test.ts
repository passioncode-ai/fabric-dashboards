// FD-49 (LC-17) on the real start path: ConsoleHost.start asks the machine before it spawns anything.
// Electron's ipcMain/dialog are not touched by start(); the PTY and the machine are stubs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost } from '../src/electron/console';
import { tmp } from './helpers';

const GB = 1024 ** 3;

function rig(machine: { freeDisk: number | null; swap: null; running: number }) {
  const base = tmp('fd-admit-');
  const bin = path.join(base, 'bin');
  const folder = path.join(base, 'agent');
  fs.mkdirSync(bin); fs.mkdirSync(folder);
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  let settings = { consoles: { 'example-agent.default': { runtime: 'claude-code', folder } } } as Record<string, unknown>;
  const spawned: string[] = [];
  const host = new ConsoleHost({
    settings: { get: () => settings, update: (p: Record<string, unknown>) => { settings = { ...settings, ...p }; } } as never,
    snapshot: () => null, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: async () => ({ code: 1, stdout: '', stderr: '' }),
    spawn: (file) => { spawned.push(file); return { pid: 999_999_999, onData: () => ({ dispose() {} }), onExit: () => ({ dispose() {} }), write() {}, resize() {}, kill() {} }; },
    killGroup: () => {},
    machine: async () => machine,
  });
  return { host, spawned };
}

test('FD-49 (LC-17): a start on a disk with less than 5 GB free is deferred before anything spawns', { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtime is a shell script; Windows lookup is tested by the PATHEXT test' }, async () => {
  const { host, spawned } = rig({ freeDisk: 2.4 * GB, swap: null, running: 0 });
  const r = await host.start('example-agent.default', 'new', { cols: 80, rows: 24 });
  assert.deepEqual(r, { ok: false, reason: 'admission', why: 'disk', freeGb: 2.4 });
  assert.deepEqual(spawned, []);
});

test('FD-49 (LC-17): at the session cap the start is deferred and names the cap', { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtime is a shell script; Windows lookup is tested by the PATHEXT test' }, async () => {
  const { host, spawned } = rig({ freeDisk: 50 * GB, swap: null, running: 6 });
  const r = await host.start('example-agent.default', 'new', { cols: 80, rows: 24 });
  assert.deepEqual(r, { ok: false, reason: 'admission', why: 'cap', running: 6, cap: 6 });
  assert.deepEqual(spawned, []);
});

test('FD-49 (LC-17): a machine with room starts the session', { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtime is a shell script; Windows lookup is tested by the PATHEXT test' }, async () => {
  const { host, spawned } = rig({ freeDisk: 50 * GB, swap: null, running: 0 });
  const r = await host.start('example-agent.default', 'new', { cols: 80, rows: 24 });
  assert.deepEqual(r, { ok: true });
  assert.equal(spawned.length, 1);
});
