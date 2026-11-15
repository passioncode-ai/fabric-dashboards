// Wave 4 of the 2026-11-15 quality plan: the main process's own costs per pass (P-01).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { repositoryKey } from '../src/core/organizations';
import { PEEK_FRESH_MS, SettingsStore } from '../src/core/settings';

test('Wave 4 P-01: peek() keeps one frozen copy while the settings stay the same, and a new one after a change', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-peek-'));
  const store = new SettingsStore(dir);
  const a = store.peek(1_000);
  assert.equal(store.peek(1_000 + PEEK_FRESH_MS - 1), a, 'the same object within the window');
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.layout) && Object.isFrozen(a.notifications), 'deeply frozen');
  const was = a.notifications.enabled;
  try { (a.notifications as { enabled: boolean }).enabled = !was; } catch { /* strict mode throws; sloppy mode ignores */ }
  assert.equal(a.notifications.enabled, was, 'a reader cannot change it');
  assert.deepEqual({ ...a }, { ...store.get() }, 'the same values as get()');
  store.update({ theme: 'light' });
  const b = store.peek(1_000);
  assert.notEqual(b, a, 'a change makes a new copy at once');
  assert.equal(b.theme, 'light');
  assert.notEqual(store.peek(1_000 + PEEK_FRESH_MS), b, 'the auto-update file is read again after the window');
  assert.equal(store.get().theme, 'light', 'get() still gives a copy a caller may change');
  const g = store.get(); g.theme = 'dark';
  assert.equal(store.peek(1_000 + PEEK_FRESH_MS).theme, 'light');
});

test('Wave 4 P-01: repositoryKey answers the same for a repeated string', () => {
  for (let i = 0; i < 3; i++) assert.equal(repositoryKey('https://github.com/Passioncode-AI/Fabric-Dashboards.git'), 'passioncode-ai/fabric-dashboards');
  assert.equal(repositoryKey('not a repo'), null);
  assert.equal(repositoryKey('not a repo'), null);
  assert.equal(repositoryKey(''), null);
});
