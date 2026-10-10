// FD-37 / PL-07 — the Windows twins of the POSIX process-group tests in lifecycle.test.ts (LC-02, T-12):
// the same rules, kept by `taskkill /T` and the parent-chain snapshot instead of groups and signals.
// Every script is Node, so nothing depends on a shell.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { killOwned, ownedCount, runOwned } from '../src/core/children';
import { tmp } from './helpers';

const WINDOWS_ONLY = { skip: process.platform !== 'win32' && 'Windows process trees; POSIX groups are tested in lifecycle.test.ts' };

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function until(what: string, ok: () => boolean, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!ok()) {
    assert.ok(Date.now() < end, `timed out waiting until ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}
/** A command that starts a grandchild (which writes its pid and lives on), then `then`s. */
function withGrandchild(pidFile: string, then: 'wait' | 'exit'): string[] {
  const grandchild = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000)`;
  const command = `const c = require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { detached: true, stdio: 'ignore' }); c.unref();`
    + (then === 'wait' ? ' setInterval(() => {}, 1000)' : ` const t = setInterval(() => { if (require('fs').existsSync(${JSON.stringify(pidFile)})) { clearInterval(t); console.log('started'); } }, 20)`);
  return ['-e', command];
}

test('FD-37 LC-02 (Windows): a command past its timeout loses its whole tree', WINDOWS_ONLY, async () => {
  const pidFile = path.join(tmp('fd-win-'), 'g.pid');
  const r = await runOwned(process.execPath, withGrandchild(pidFile, 'wait'), { timeoutMs: 3_000 });
  assert.equal(r.timedOut, true);
  const grandchild = Number(fs.readFileSync(pidFile, 'utf8'));
  await until('the grandchild went with the tree', () => !alive(grandchild), 10_000);
});

test('FD-37 LC-02 (Windows): killOwned ends a running command and leaves no child', WINDOWS_ONLY, async () => {
  await until('the previous test\'s leftovers are done', () => ownedCount() === 0, 60_000);
  const pending = runOwned(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 60_000 });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(ownedCount(), 1);
  await killOwned(200);
  const r = await pending;
  assert.notEqual(r.code, 0, 'ended, not finished');
  await until('nothing is owned', () => ownedCount() === 0, 60_000);
});

test('FD-37 T-12 (Windows): what a finished command left running counts as owned until it is gone', WINDOWS_ONLY, async () => {
  await until('the previous test\'s leftovers are done', () => ownedCount() === 0, 60_000);
  const pidFile = path.join(tmp('fd-win-'), 'g.pid');
  const r = await runOwned(process.execPath, withGrandchild(pidFile, 'exit'), { timeoutMs: 15_000 });
  assert.equal(r.code, 0);
  assert.match(r.output, /started/);
  const left = Number(fs.readFileSync(pidFile, 'utf8'));
  await until('the leftover is gone', () => !alive(left), 60_000); // WMI's first snapshot on a CI runner takes seconds
  await until('nothing is owned', () => ownedCount() === 0, 60_000);
});
