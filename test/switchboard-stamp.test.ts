import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { switchboardStamp } from '../src/core/switchboard';

// FD-305 (decision D-3): every Switchboard feature probe is cached by path and modification time.
test('FD-305: a Switchboard updated in place gets a new stamp; an unchanged one keeps it; a missing path is its own', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-305-'));
  const sb = path.join(dir, 'switchboard');
  fs.writeFileSync(sb, 'v1');
  fs.utimesSync(sb, 1_700_000_000, 1_700_000_000);
  const first = switchboardStamp(sb);
  assert.equal(switchboardStamp(sb), first, 'unchanged: the cached answer holds');
  fs.writeFileSync(sb, 'v2');
  fs.utimesSync(sb, 1_700_000_100, 1_700_000_100);
  assert.notEqual(switchboardStamp(sb), first, 'updated in place: asked again');
  assert.ok(switchboardStamp(sb).startsWith(`${sb}:`));
  assert.equal(switchboardStamp(path.join(dir, 'gone')), path.join(dir, 'gone'));
  fs.rmSync(dir, { recursive: true, force: true });
});
