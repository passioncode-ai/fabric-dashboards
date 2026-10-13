#!/usr/bin/env node
// #region lease-guard — docs: CONTRIBUTING.md#leases
// FD-26: the pre-commit check that retires retro standing instruction 4 ("guarded files take the
// lease before the edit"). A commit that stages a path listed in `.claude/agent-sync.json`
// `guardedFiles` is refused unless agent-sync says this run may write it (`agent_sync.py guard`,
// exit 0 = allowed, 2 = refused). Paths outside the list are never asked about.
//
// Where agent-sync is not installed, a guarded commit is refused too, with the command that
// installs it: a contributor without the tool is exactly the case the rule exists for. The way
// past it, as for any hook, is the person's own `git commit --no-verify`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** `docs/adr/*.md` style globs: `*` stays inside one path segment, nothing else is special. */
export function globToRegExp(glob) {
  const body = glob.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
  return new RegExp(`^${body}$`);
}

/** The staged paths a guard must be asked about. */
export function guardedAmong(paths, globs) {
  const res = globs.map(globToRegExp);
  return paths.filter((p) => res.some((re) => re.test(p)));
}

/** Where agent_sync.py is: $AGENT_SYNC_PY, the skills hub, then Claude Code's plugin cache. */
export function findAgentSync(env = process.env, home = os.homedir()) {
  const candidates = [
    env.AGENT_SYNC_PY,
    path.join(home, '.agents', 'skills', 'agent-sync', 'scripts', 'agent_sync.py'),
  ].filter(Boolean);
  const cache = path.join(home, '.claude', 'plugins', 'cache');
  try {
    for (const market of fs.readdirSync(cache)) {
      const base = path.join(cache, market, 'agent-sync');
      for (const version of fs.readdirSync(base).sort().reverse()) {
        candidates.push(path.join(base, version, 'skills', 'agent-sync', 'scripts', 'agent_sync.py'));
      }
    }
  } catch { /* no plugin cache */ }
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

/** 0 = the commit may go on; 1 = refused, with the reason on stderr. */
export function check({ root, staged, agentSync, python = process.platform === 'win32' ? 'python' : 'python3', log = (s) => process.stderr.write(`${s}\n`) }) {
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'agent-sync.json'), 'utf8')); } catch { return 0; }
  const guarded = guardedAmong(staged, Array.isArray(config.guardedFiles) ? config.guardedFiles : []);
  if (!guarded.length) return 0;
  if (!agentSync) {
    log(`lease-guard: this commit stages guarded files (${guarded.join(', ')}) and agent-sync is not installed, so no lease can be checked.`);
    log('lease-guard: install it (`npx --yes sshlg-skills@latest update`), take the lease (`agent_sync.py acquire <file>`), then commit again.');
    return 1;
  }
  const r = spawnSync(python, [agentSync, 'guard', ...guarded], { cwd: root, encoding: 'utf8' });
  if (r.status === 0) return 0;
  const said = `${r.stderr || ''}${r.stdout || ''}`.trim();
  log(`lease-guard: refused — ${said || `agent_sync.py guard exited ${r.status ?? r.error?.message}`}`);
  log(`lease-guard: take the lease before the edit: agent_sync.py acquire ${guarded[0]}`);
  return 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();
  const staged = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRD'], { cwd: root, encoding: 'utf8' })
    .stdout.split('\n').filter(Boolean);
  const lease = check({ root, staged, agentSync: findAgentSync() });
  if (lease !== 0) process.exit(lease);
  // FD-63: the private-data check runs next. A checkout that predates it has no private-guard.mjs and commits as before.
  const guard = path.join(path.dirname(fileURLToPath(import.meta.url)), 'private-guard.mjs');
  // A promise, not a top-level await: tests load this file through tsx, which compiles it to CommonJS.
  if (!fs.existsSync(guard)) process.exit(0);
  import(pathToFileURL(guard).href).then(
    ({ checkPrivate, findCheckPrivate }) => process.exit(checkPrivate({ root, script: findCheckPrivate(root) })),
    (e) => { process.stderr.write(`private-guard: could not load (${e.message}); the commit goes on unchecked.\n`); process.exit(0); },
  );
}
// #endregion lease-guard
