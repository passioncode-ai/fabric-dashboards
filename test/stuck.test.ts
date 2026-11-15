// FD-275: a Claude Code console busy with no transcript write for 45 minutes is stuck, closed and saved like an idle one.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { claudeConfigDirs, lastTranscriptWrite, STUCK_MS, stuckKeys } from '../src/core/stuck';
import { merge } from '../src/core/settings';
import { tmp } from './helpers';

const NOW = Date.parse('2026-11-15T22:00:00Z');
const MIN = 60_000;

test('FD-275: stuck is Claude Code, running 45 minutes, its folder written last 45 minutes ago; unknown is never stuck', () => {
  const writes: Record<string, number | null> = { '/w/stuck': NOW - 50 * MIN, '/w/busy': NOW - 5 * MIN, '/w/none': null, '/w/young': NOW - 50 * MIN, '/w/codex': NOW - 90 * MIN };
  const running = [
    { key: 'a.default', runtime: 'claude-code', cwd: '/w/stuck', startedAt: NOW - 120 * MIN },
    { key: 'b.default', runtime: 'claude-code', cwd: '/w/busy', startedAt: NOW - 120 * MIN },
    { key: 'c.default', runtime: 'claude-code', cwd: '/w/none', startedAt: NOW - 120 * MIN },
    { key: 'd.default', runtime: 'claude-code', cwd: '/w/young', startedAt: NOW - 10 * MIN },
    { key: 'e.default', runtime: 'codex', cwd: '/w/codex', startedAt: NOW - 120 * MIN },
    { key: 'f.default', runtime: 'claude-code', cwd: '/w/stuck', startedAt: null },
  ];
  assert.deepEqual(stuckKeys(running, (cwd) => writes[cwd] ?? null, NOW), ['a.default']);
  assert.equal(STUCK_MS, 45 * MIN, 'the duty officer\'s threshold');
  assert.deepEqual(stuckKeys(running.slice(0, 1), () => NOW - 45 * MIN, NOW), ['a.default'], 'at the threshold');
});

test('FD-275: the newest transcript of a folder is read in the ordinary home and in each Switchboard home', () => {
  const home = tmp('fd-stuck-');
  const folder = '/work/projects/my-repo';
  const slug = folder.replace(/[^A-Za-z0-9]/g, '-');
  const own = path.join(home, '.claude', 'projects', slug);
  const sb = path.join(home, 'Library', 'Application Support', 'ai.passioncode.fabric-switchboard', 'homes', 'acc-1', 'projects', slug);
  fs.mkdirSync(own, { recursive: true });
  fs.mkdirSync(sb, { recursive: true });
  fs.writeFileSync(path.join(own, 'old.jsonl'), '{}');
  fs.utimesSync(path.join(own, 'old.jsonl'), new Date(NOW - 90 * MIN), new Date(NOW - 90 * MIN));
  fs.writeFileSync(path.join(sb, 'new.jsonl'), '{}');
  fs.utimesSync(path.join(sb, 'new.jsonl'), new Date(NOW - 10 * MIN), new Date(NOW - 10 * MIN));
  fs.writeFileSync(path.join(sb, 'notes.txt'), 'x');
  const dirs = claudeConfigDirs(home, 'darwin');
  assert.equal(dirs.length, 2);
  assert.equal(lastTranscriptWrite(folder, dirs), NOW - 10 * MIN, 'the Switchboard home holds the newer write');
  assert.equal(lastTranscriptWrite('/work/projects/other', dirs), null);
  assert.deepEqual(claudeConfigDirs(home, 'win32'), [path.join(home, '.claude')]);
});

test('FD-275: the saved close keeps why it was closed, and only the known reason', () => {
  const at = new Date(NOW).toISOString();
  const s = merge({ consoles: { 'a.default': { runtime: 'claude-code', folder: null, idle: { at, account: null, why: 'stuck' } }, 'b.default': { runtime: 'claude-code', folder: null, idle: { at, account: null, why: 'nope' } } } } as never);
  assert.equal(s.consoles['a.default']?.idle?.why, 'stuck');
  assert.equal(s.consoles['b.default']?.idle?.why, undefined);
});
