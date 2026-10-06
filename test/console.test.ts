// ADR-0017: the agent console — which runtimes are offered, which folder a service's code lives in,
// how Switchboard decides the account, and the console sessions themselves on a fake PTY.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { detectRuntimes, KNOWN_RUNTIMES, loginPathFrom, runtimeArgs, searchDirs, type RuntimeSpec } from '../src/core/runtimes';
import { tmp } from './helpers';

function bin(dir: string, name: string, mode = 0o755): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, '#!/bin/sh\n');
  fs.chmodSync(file, mode);
  return file;
}

// ── runtimes ─────────────────────────────────────────────────────────────────────────────

test('REQ-05: only installed, executable runtimes are offered — Claude Code and Codex first, then the rest in catalog order', () => {
  const base = tmp('fd-rt-');
  const a = path.join(base, 'a');
  const b = path.join(base, 'b');
  bin(a, 'codex');
  bin(b, 'claude');
  bin(b, 'gemini');
  bin(a, 'goose', 0o644); // not executable: not offered
  fs.mkdirSync(path.join(a, 'aider')); // a directory with the name: not offered
  const found = detectRuntimes([a, b, path.join(base, 'absent')], KNOWN_RUNTIMES);
  assert.deepEqual(found.map((r) => r.id), ['claude-code', 'codex', 'gemini-cli']);
  assert.equal(found[0]!.path, path.join(b, 'claude'));
  assert.equal(found[1]!.provider, 'codex');
  assert.equal(found[2]!.provider, null, 'Switchboard binds accounts for Claude Code and Codex only');
});

test('REQ-05: the first PATH entry wins, as in a shell', () => {
  const base = tmp('fd-rt-order-');
  bin(path.join(base, 'first'), 'claude');
  bin(path.join(base, 'second'), 'claude');
  assert.equal(detectRuntimes([path.join(base, 'first'), path.join(base, 'second')], KNOWN_RUNTIMES)[0]!.path, path.join(base, 'first', 'claude'));
});

test('REQ-05: a catalog from Switchboard extends the list; IDE-only entries and duplicates are left out', () => {
  const base = tmp('fd-rt-cat-');
  bin(base, 'claude');
  bin(base, 'hermes');
  bin(base, 'zed');
  const extra: RuntimeSpec[] = [
    { id: 'hermes', name: 'Hermes Agent', binary: 'hermes', provider: null, continueArgs: null },
  ];
  assert.deepEqual(detectRuntimes([base], [...KNOWN_RUNTIMES, ...extra, ...extra]).map((r) => r.id), ['claude-code', 'hermes']);
});

test('REQ-09: New starts fresh; Continue resumes the last conversation where the runtime can, and is refused where it cannot', () => {
  const claude = KNOWN_RUNTIMES.find((r) => r.id === 'claude-code')!;
  const codex = KNOWN_RUNTIMES.find((r) => r.id === 'codex')!;
  const gemini = KNOWN_RUNTIMES.find((r) => r.id === 'gemini-cli')!;
  assert.deepEqual(runtimeArgs(claude, 'new'), []);
  assert.deepEqual(runtimeArgs(claude, 'continue'), ['--continue']);
  assert.deepEqual(runtimeArgs(codex, 'continue'), ['resume', '--last']);
  assert.throws(() => runtimeArgs(gemini, 'continue'), /cannot continue/);
});

test('REQ-05: the login PATH is read from the shell\'s marked line; the known install folders are added once', () => {
  const home = '/Users/x';
  const out = 'motd noise\n__FD_PATH__/opt/homebrew/bin:/usr/bin:/Users/x/.local/bin\nmore noise\n';
  assert.deepEqual(loginPathFrom(out), ['/opt/homebrew/bin', '/usr/bin', '/Users/x/.local/bin']);
  assert.deepEqual(loginPathFrom('no marker here'), []);
  const dirs = searchDirs(['/opt/homebrew/bin', '/usr/bin', '/Users/x/.local/bin'], home);
  assert.equal(dirs[0], '/opt/homebrew/bin');
  assert.equal(dirs.filter((d) => d === '/Users/x/.local/bin').length, 1);
  for (const d of ['/Users/x/.cargo/bin', '/Users/x/.bun/bin', '/Users/x/.npm-global/bin', '/usr/local/bin', '/bin']) assert.ok(dirs.includes(d), d);
});
