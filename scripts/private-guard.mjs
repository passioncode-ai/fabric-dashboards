#!/usr/bin/env node
// #region private-guard — docs: CONTRIBUTING.md#private-data
// FD-63: the pre-commit check that keeps private data out of this public tree. scripts/lease-guard.mjs
// runs it after the lease check. It runs org-index `scripts/check_private.py` (Fabric ADR-0092) over the
// tracked files when that script is found. The checker's denylist is private and lives only on the
// operator's machines, so this cannot run in CI.
//
// Exit 1 from the checker (a finding) refuses the commit and passes its findings on. Exit 2 (no local
// denylist) and a missing checker let the commit go on silently. A checker that cannot run is named and
// the commit goes on: a broken tool in another repository must not stop every commit here.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where check_private.py is: $CHECK_PRIVATE_PY (`none` turns the check off), an org-index clone beside
 * this checkout, then ~/DATA/org-index. */
export function findCheckPrivate(root, env = process.env, home = os.homedir()) {
  if (env.CHECK_PRIVATE_PY === 'none') return null;
  const candidates = [
    env.CHECK_PRIVATE_PY,
    path.join(root, '..', 'org-index', 'scripts', 'check_private.py'),
    path.join(home, 'DATA', 'org-index', 'scripts', 'check_private.py'),
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

/** 0 = the commit may go on; 1 = refused, with the findings on stderr. */
export function checkPrivate({ root, script, python = process.platform === 'win32' ? 'python' : 'python3', log = (s) => process.stderr.write(`${s}\n`) }) {
  if (!script) return 0;
  const r = spawnSync(python, [script, root], { cwd: root, encoding: 'utf8' });
  if (r.status === 0 || r.status === 2) return 0;
  if (r.status === 1) {
    const said = `${r.stdout || ''}${r.stderr || ''}`.trim();
    if (said) log(said);
    log('private-guard: refused — this public tree would carry private data (FD-63). Replace the term, address or home path;');
    log('private-guard: a reviewed synthetic P2–P4 finding goes into .check-private-allow by its fingerprint (P1 never does).');
    return 1;
  }
  log(`private-guard: check_private.py could not run (${r.status ?? r.error?.message}); the commit goes on unchecked.`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();
  process.exit(checkPrivate({ root, script: findCheckPrivate(root) }));
}
// #endregion private-guard
