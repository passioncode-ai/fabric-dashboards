// FD-146: the check that keeps POSIX-only test lines off the Windows runners.
import assert from 'node:assert/strict';
import test from 'node:test';
// A plain ESM script: tests are run by tsx, not type-checked (tsconfig.main.json includes src only).
import { unguarded } from '../scripts/check-posix-tests.mjs';

const t = (body: string, header = "test('x', () => {") => `${header}\n${body}\n});\n`;

test('FD-146: a mode assertion or a POSIX shell run in a test Windows runs is named by its line', () => {
  assert.deepEqual(unguarded(t("  assert.equal(fs.statSync(f).mode & 0o777, 0o600);")), [2]);
  assert.deepEqual(unguarded(t("  const r = spawnSync('/bin/sh', ['-c', 'true']);")), [2]);
});

test('FD-146: a skipped test, a POSIX option, a guard on the line or just above, and a helper pass', () => {
  assert.deepEqual(unguarded(t("  assert.equal(fs.statSync(f).mode & 0o777, 0o600);", "test('x', { skip: process.platform === 'win32' && 'POSIX' }, () => {")), []);
  assert.deepEqual(unguarded(t("  assert.equal(fs.statSync(f).mode & 0o777, 0o600);", "test('x', POSIX, async () => {")), []);
  assert.deepEqual(unguarded(t("  if (process.platform !== 'win32') assert.equal(fs.statSync(f).mode & 0o777, 0o600);")), []);
  assert.deepEqual(unguarded(t("  if (process.platform !== 'win32') {\n    assert.equal(fs.statSync(f).mode & 0o777, 0o600);\n  }")), []);
  assert.deepEqual(unguarded("function fake() {\n  fs.writeFileSync(p, '#!/bin/sh\\nexit 0');\n}\n"), [], 'a shebang written by a helper is not a run');
});
