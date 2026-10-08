// The e2e preflight: a locked macOS screen sends windows no show/hide events, so an e2e run there
// measures the lock, not the app (FD-05/FD-35, 2026-10-06 and 2026-10-08). The run refuses up front.
import assert from 'node:assert/strict';
import test from 'node:test';
import { screenLocked } from '../scripts/check-screen.mjs';

test('e2e preflight: the lock flag from ioreg decides, and its absence means unlocked', () => {
  assert.equal(screenLocked('    | |   "CGSSessionScreenIsLocked"=Yes\n'), true);
  assert.equal(screenLocked('"kCGSSessionOnConsoleKey"=Yes,"CGSSessionScreenIsLocked"=No'), false);
  assert.equal(screenLocked('"kCGSSessionOnConsoleKey"=Yes'), false, 'the key is present only while locked');
  assert.equal(screenLocked(''), false);
});
