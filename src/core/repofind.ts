// #region repofind — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
// ADR-0017: the folder a service's code lives in — the local checkout whose git `origin` is the
// repository its descriptor names (`source.repository`). Read from `.git/config` only: no git
// process, nothing written. Searched where this Mac keeps code, at depths 1 and 2.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CODE_ROOTS = ['DATA', 'Code', 'Projects', 'Developer', 'src'] as const;

/** `host/owner/repo`, lower case, for any common form of a repository address; null when it is none. */
export function repoId(url: string | undefined | null): string | null {
  if (!url) return null;
  let s = url.trim().replace(/^git\+/, '');
  const scp = /^[\w.-]+@([\w.-]+):(.+)$/.exec(s); // git@host:owner/repo
  if (scp) s = `ssh://${scp[1]}/${scp[2]}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const parts = u.pathname.replace(/\.git\/?$/, '').split('/').filter(Boolean);
  if (parts.length < 2 || !u.hostname) return null;
  return `${u.hostname}/${parts.join('/')}`.toLowerCase();
}

/** The git directory holding the config of the checkout at `dir`: `.git` itself, or a worktree's common dir. */
function configDir(dir: string): { dir: string; worktree: boolean } | null {
  const dotgit = path.join(dir, '.git');
  let s: fs.Stats;
  try { s = fs.statSync(dotgit); } catch { return null; }
  if (s.isDirectory()) return { dir: dotgit, worktree: false };
  try {
    const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(dotgit, 'utf8'));
    if (!m) return null;
    const gitdir = path.resolve(dir, m[1]!.trim());
    let common = gitdir;
    try { common = path.resolve(gitdir, fs.readFileSync(path.join(gitdir, 'commondir'), 'utf8').trim()); } catch { /* not a linked worktree */ }
    return { dir: common, worktree: true };
  } catch {
    return null;
  }
}

/** The `remote "origin"` url of the checkout at `dir`, or null. */
export function originOf(dir: string): string | null {
  const c = configDir(dir);
  if (!c) return null;
  let text: string;
  try { text = fs.readFileSync(path.join(c.dir, 'config'), 'utf8'); } catch { return null; }
  let inOrigin = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) { inOrigin = /^\[remote\s+"origin"\]$/.test(line); continue; }
    const m = inOrigin ? /^url\s*=\s*(.+)$/.exec(line) : null;
    if (m) return m[1]!.trim();
  }
  return null;
}

function children(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => path.join(dir, e.name)).sort();
  } catch {
    return [];
  }
}

/** The nearest folder above `file`, inside `home`, that is a git checkout; null when there is none. */
function gitRootOf(file: string, home: string): string | null {
  for (let d = path.dirname(file); d !== path.dirname(d) && d.startsWith(home + path.sep); d = path.dirname(d)) if (configDir(d)) return d;
  return null;
}

/** The checkout of `repository`, or null: first a folder that holds one of the descriptor's own command
 *  paths, then the code roots at depths 1 and 2. A main checkout wins over a linked worktree. */
export function findCheckout(o: { repository: string | undefined; home?: string; commandPaths?: string[] }): string | null {
  const home = o.home ?? os.homedir();
  const want = repoId(o.repository);
  // No repository named: the checkout the descriptor's own command runs from, if it is in one.
  if (!want) return (o.commandPaths ?? []).map((file) => gitRootOf(file, home)).find((d): d is string => d !== null) ?? null;
  const matches = (dir: string) => repoId(originOf(dir)) === want;
  for (const file of o.commandPaths ?? []) {
    const root = gitRootOf(file, home);
    if (root && matches(root)) return root;
  }
  let worktree: string | null = null;
  for (const root of CODE_ROOTS.map((r) => path.join(home, r))) {
    for (const one of children(root)) {
      for (const dir of [one, ...(configDir(one) ? [] : children(one))]) {
        if (!matches(dir)) continue;
        if (!configDir(dir)!.worktree) return dir;
        worktree ??= dir;
      }
    }
  }
  return worktree;
}
// #endregion repofind
