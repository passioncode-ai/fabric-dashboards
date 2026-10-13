// FD-63: the pre-commit private-data check (scripts/private-guard.mjs), run by scripts/lease-guard.mjs
// after the lease check. A fake check_private.py stands in for org-index's: it refuses (exit 1) when a
// tracked file holds the word PRIVATENAME, and its exit code can be forced with FAKE_EXIT.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
// @ts-expect-error plain ESM script without types
import { checkPrivate, findCheckPrivate } from '../scripts/private-guard.mjs';
// @ts-expect-error plain ESM script without types
import { install } from '../scripts/install-hooks.mjs';
import { tmp } from './helpers';

const ROOT = path.resolve(__dirname, '..');
const PY = process.platform === 'win32' ? 'python' : 'python3';
const hasPython = spawnSync(PY, ['--version']).status === 0;

function fakeChecker(dir: string): string {
  const file = path.join(dir, 'fake_check_private.py');
  fs.writeFileSync(file, [
    'import os, subprocess, sys',
    'forced = os.environ.get("FAKE_EXIT")',
    'if forced: sys.exit(int(forced))',
    'root = sys.argv[1]',
    'files = subprocess.run(["git", "ls-files"], cwd=root, capture_output=True, text=True).stdout.split()',
    'bad = [f for f in files if "PRIVATENAME" in open(os.path.join(root, f), encoding="utf-8", errors="replace").read()]',
    'for f in bad: print("FINDING P1 " + f + ":1 PRIVATENAME")',
    'print(str(len(bad)) + " finding(s)")',
    'sys.exit(1 if bad else 0)',
  ].join('\n'));
  return file;
}

function repo(): string {
  const dir = tmp('fd-private-');
  const git = (...a: string[]) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, 'scripts'));
  for (const s of ['lease-guard.mjs', 'private-guard.mjs']) fs.copyFileSync(path.join(ROOT, 'scripts', s), path.join(dir, 'scripts', s));
  return dir;
}

test('FD-63: the checker is found from $CHECK_PRIVATE_PY, an org-index clone beside the checkout, then ~/DATA; `none` turns it off', () => {
  const base = tmp('fd-find-');
  const own = path.join(base, 'own.py');
  fs.writeFileSync(own, '');
  const repoDir = path.join(base, 'work', 'fabric-dashboards');
  const sibling = path.join(base, 'work', 'org-index', 'scripts', 'check_private.py');
  const home = path.join(base, 'home');
  const inHome = path.join(home, 'DATA', 'org-index', 'scripts', 'check_private.py');
  fs.mkdirSync(repoDir, { recursive: true });
  assert.equal(findCheckPrivate(repoDir, {}, home), null, 'nothing installed');
  fs.mkdirSync(path.dirname(inHome), { recursive: true }); fs.writeFileSync(inHome, '');
  assert.equal(findCheckPrivate(repoDir, {}, home), inHome);
  fs.mkdirSync(path.dirname(sibling), { recursive: true }); fs.writeFileSync(sibling, '');
  assert.equal(findCheckPrivate(repoDir, {}, home), sibling, 'a clone beside the checkout wins over ~/DATA');
  assert.equal(findCheckPrivate(repoDir, { CHECK_PRIVATE_PY: own }, home), own);
  assert.equal(findCheckPrivate(repoDir, { CHECK_PRIVATE_PY: 'none' }, home), null);
});

test('FD-63: no checker, a clean tree or no local denylist (exit 2) — the commit goes on without a word', { skip: !hasPython && 'no python on this runner' }, () => {
  const dir = repo();
  const notes: string[] = [];
  const log = (s: string) => notes.push(s);
  assert.equal(checkPrivate({ root: dir, script: null, log }), 0);
  const fake = fakeChecker(dir);
  assert.equal(checkPrivate({ root: dir, script: fake, log }), 0);
  process.env.FAKE_EXIT = '2';
  try { assert.equal(checkPrivate({ root: dir, script: fake, log }), 0); } finally { delete process.env.FAKE_EXIT; }
  assert.deepEqual(notes, []);
});

test('FD-63: a checker that cannot run is named and the commit goes on (fail open)', { skip: !hasPython && 'no python on this runner' }, () => {
  const dir = repo();
  const notes: string[] = [];
  process.env.FAKE_EXIT = '3';
  try { assert.equal(checkPrivate({ root: dir, script: fakeChecker(dir), log: (s: string) => notes.push(s) }), 0); } finally { delete process.env.FAKE_EXIT; }
  assert.match(notes.join('\n'), /could not run \(3\)/);
});

test('FD-63: a real commit through the installed hook is refused while a tracked file holds a private term, and goes through once it is gone', { skip: !hasPython && 'no python on this runner' }, () => {
  const dir = repo();
  install(dir, () => {});
  const fake = fakeChecker(dir);
  const git = (...a: string[]) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: { ...process.env, CHECK_PRIVATE_PY: fake } });
  fs.writeFileSync(path.join(dir, 'notes.md'), 'ask PRIVATENAME about it\n');
  git('add', 'notes.md', 'scripts');
  const refused = git('commit', '-q', '-m', 'leaks');
  assert.notEqual(refused.status, 0, 'the commit carrying a private term went through');
  assert.match(refused.stderr, /FINDING P1 notes\.md:1 PRIVATENAME/);
  assert.match(refused.stderr, /private-guard: refused/);
  fs.writeFileSync(path.join(dir, 'notes.md'), 'ask the owner about it\n');
  git('add', 'notes.md');
  const allowed = git('commit', '-q', '-m', 'clean');
  assert.equal(allowed.status, 0, allowed.stderr);
});
