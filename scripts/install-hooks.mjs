#!/usr/bin/env node
// #region lease-guard — docs: CONTRIBUTING.md#leases
// FD-26: `npm ci` / `npm install` run this (`prepare`). It writes `.git/hooks/pre-commit` (the
// common hooks directory, so every worktree shares it) to run scripts/lease-guard.mjs — only when
// no pre-commit hook is there yet or the one there is ours; another tool's hook is left alone and
// named. A `core.hooksPath` set by someone else is respected the same way. Outside a git checkout
// (an npm tarball, a CI cache) it does nothing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARK = '# fabric-dashboards lease-guard (FD-26)';
const HOOK = `#!/bin/sh\n${MARK}\nexec node "$(git rev-parse --show-toplevel)/scripts/lease-guard.mjs"\n`;

export function install(cwd = process.cwd(), log = (s) => console.log(s)) {
  const git = (...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
  const common = git('rev-parse', '--git-common-dir');
  if (common.status !== 0) return 'not-a-checkout';
  const custom = git('config', '--get', 'core.hooksPath').stdout.trim();
  const dir = custom ? path.resolve(cwd, custom) : path.resolve(cwd, common.stdout.trim(), 'hooks');
  const file = path.join(dir, 'pre-commit');
  let existing = null;
  try { existing = fs.readFileSync(file, 'utf8'); } catch { /* none yet */ }
  if (existing !== null && !existing.includes(MARK)) {
    log(`install-hooks: ${file} belongs to another tool; the lease guard was not installed (run scripts/lease-guard.mjs from it to add it)`);
    return 'foreign';
  }
  if (existing === HOOK) return 'current';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, HOOK, { mode: 0o755 });
  return 'installed';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = install();
  if (r === 'installed') console.log('install-hooks: pre-commit lease guard installed (FD-26)');
}
// #endregion lease-guard
