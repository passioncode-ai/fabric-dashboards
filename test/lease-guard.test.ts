// FD-26: the pre-commit lease guard (scripts/lease-guard.mjs) and its installer
// (scripts/install-hooks.mjs). A real git repository in a temp folder, a fake agent_sync.py that
// allows or refuses, and real `git commit` runs through the installed hook.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
// @ts-expect-error plain ESM script without types
import { check, globToRegExp, guardedAmong } from '../scripts/lease-guard.mjs';
// @ts-expect-error plain ESM script without types
import { install } from '../scripts/install-hooks.mjs';

const ROOT = path.resolve(__dirname, '..');
const PY = process.platform === 'win32' ? 'python' : 'python3';
const hasPython = spawnSync(PY, ['--version']).status === 0;

function repo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-lease-'));
  const git = (...a: string[]) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, '.claude'));
  fs.writeFileSync(path.join(dir, '.claude', 'agent-sync.json'), JSON.stringify({ guardedFiles: ['docs/adr/*.md', 'CHANGELOG.md'] }));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(path.join(ROOT, 'scripts', 'lease-guard.mjs'), path.join(dir, 'scripts', 'lease-guard.mjs'));
  return dir;
}
/** A stand-in for agent_sync.py: `guard` allows the paths named in ALLOW, refuses the rest with exit 2. */
function fakeSync(dir: string): string {
  const file = path.join(dir, 'fake_agent_sync.py');
  fs.writeFileSync(file, [
    'import os, sys',
    'allow = set(filter(None, os.environ.get("ALLOW", "").split(",")))',
    'paths = sys.argv[2:]',
    'bad = [p for p in paths if p not in allow]',
    'if bad:',
    '    print("agent-sync: " + bad[0] + " is a guarded registry file and this run holds no lease.", file=sys.stderr)',
    '    sys.exit(2)',
    'print("allowed")',
  ].join('\n'));
  return file;
}

test('FD-26: guarded globs match one path segment per star, and only the listed paths are asked about', () => {
  assert.ok(globToRegExp('docs/adr/*.md').test('docs/adr/0019-windows-and-linux.md'));
  assert.ok(!globToRegExp('docs/adr/*.md').test('docs/adr/old/0001.md'), 'a star does not cross a slash');
  assert.ok(!globToRegExp('CHANGELOG.md').test('xCHANGELOG.md'));
  assert.deepEqual(guardedAmong(['src/a.ts', 'CHANGELOG.md', 'docs/adr/0001-x.md'], ['docs/adr/*.md', 'CHANGELOG.md']), ['CHANGELOG.md', 'docs/adr/0001-x.md']);
});

test('FD-26: no guarded path staged — the commit goes on without asking agent-sync', () => {
  const dir = repo();
  const notes: string[] = [];
  assert.equal(check({ root: dir, staged: ['src/a.ts'], agentSync: '/nonexistent/agent_sync.py', log: (s: string) => notes.push(s) }), 0);
  assert.deepEqual(notes, []);
});

test('FD-26: a guarded path without agent-sync installed is refused, naming how to install it', () => {
  const dir = repo();
  const notes: string[] = [];
  assert.equal(check({ root: dir, staged: ['CHANGELOG.md'], agentSync: null, log: (s: string) => notes.push(s) }), 1);
  assert.match(notes.join('\n'), /sshlg-skills@latest update/);
});

test('FD-26: a real commit through the installed hook is refused without the lease and goes through with it', { skip: !hasPython && 'no python on this runner' }, () => {
  const dir = repo();
  assert.equal(install(dir, () => {}), 'installed');
  assert.equal(install(dir, () => {}), 'current', 'a second install changes nothing');
  const sync = fakeSync(dir);
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), '# x\n');
  const git = (env: Record<string, string>, ...a: string[]) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: { ...process.env, AGENT_SYNC_PY: sync, ...env } });
  git({}, 'add', 'CHANGELOG.md', 'scripts', '.claude');
  const refused = git({ ALLOW: '' }, 'commit', '-q', '-m', 'unleased');
  assert.notEqual(refused.status, 0, 'the unleased commit went through');
  assert.match(refused.stderr, /lease-guard: refused/);
  assert.match(refused.stderr, /agent_sync\.py acquire CHANGELOG\.md/);
  const allowed = git({ ALLOW: 'CHANGELOG.md' }, 'commit', '-q', '-m', 'leased');
  assert.equal(allowed.status, 0, allowed.stderr);
});

test('FD-26: another tool\'s pre-commit hook is left alone and named', () => {
  const dir = repo();
  const hooks = path.join(dir, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  fs.writeFileSync(path.join(hooks, 'pre-commit'), '#!/bin/sh\necho theirs\n');
  const notes: string[] = [];
  assert.equal(install(dir, (s: string) => notes.push(s)), 'foreign');
  assert.equal(fs.readFileSync(path.join(hooks, 'pre-commit'), 'utf8'), '#!/bin/sh\necho theirs\n');
  assert.match(notes.join('\n'), /belongs to another tool/);
});

test('FD-26: outside a git checkout the installer does nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-nogit-'));
  assert.equal(install(dir, () => {}), 'not-a-checkout');
});
