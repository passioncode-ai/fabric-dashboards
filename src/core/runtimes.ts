// #region runtimes — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
// ADR-0017: the coding-agent runtimes the console can start — the ones installed and executable on
// this Mac. A runtime is offered only when its binary is found on the login shell's PATH (or one of
// the folders installers put CLIs in); it is started as its own unchanged CLI.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface RuntimeSpec {
  /** Stable id, the same as Switchboard's catalog where it has one. */
  id: string;
  name: string;
  /** The executable's name on PATH. */
  binary: string;
  /** The Switchboard provider whose accounts this runtime signs in with; null: Switchboard binds no account for it. */
  provider: 'claude' | 'codex' | null;
  /** Arguments that resume the last conversation in the folder; null when the runtime has none. */
  continueArgs: string[] | null;
}

export interface Runtime extends RuntimeSpec {
  /** Absolute path of the executable found. */
  path: string;
}

/** Built in, verified against the installed CLIs (2026-10-06): `claude --continue`, `codex resume --last`.
 *  The others resume nothing here until a flag is verified for them. */
export const KNOWN_RUNTIMES: readonly RuntimeSpec[] = [
  { id: 'claude-code', name: 'Claude Code', binary: 'claude', provider: 'claude', continueArgs: ['--continue'] },
  { id: 'codex', name: 'Codex', binary: 'codex', provider: 'codex', continueArgs: ['resume', '--last'] },
  { id: 'gemini-cli', name: 'Gemini CLI', binary: 'gemini', provider: null, continueArgs: null },
  { id: 'opencode', name: 'OpenCode', binary: 'opencode', provider: null, continueArgs: null },
  { id: 'qwen-code', name: 'Qwen Code', binary: 'qwen', provider: null, continueArgs: null },
  { id: 'goose', name: 'Goose', binary: 'goose', provider: null, continueArgs: null },
  { id: 'aider', name: 'Aider', binary: 'aider', provider: null, continueArgs: null },
  { id: 'cursor-cli', name: 'Cursor CLI', binary: 'agent', provider: null, continueArgs: null },
  { id: 'copilot-cli', name: 'GitHub Copilot CLI', binary: 'copilot', provider: null, continueArgs: null },
  { id: 'amp', name: 'Amp', binary: 'amp', provider: null, continueArgs: null },
];

/** Where installers put CLIs, after the login PATH (Switchboard's `find_program` looks in the same places). */
export function searchDirs(loginPath: string[], home = os.homedir()): string[] {
  const extra = ['.local/bin', '.cargo/bin', '.bun/bin', '.npm-global/bin'].map((d) => path.join(home, d))
    .concat(['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']);
  return [...new Set([...loginPath.filter((d) => path.isAbsolute(d)), ...extra])];
}

function executable(file: string): boolean {
  try {
    const s = fs.statSync(file);
    if (!s.isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The runtimes found in `dirs`, Claude Code and Codex first, then in catalog order; duplicates by id dropped. */
export function detectRuntimes(dirs: string[], catalog: readonly RuntimeSpec[]): Runtime[] {
  const seen = new Set<string>();
  const found: Runtime[] = [];
  for (const spec of catalog) {
    if (seen.has(spec.id)) continue;
    seen.add(spec.id);
    const dir = dirs.find((d) => executable(path.join(d, spec.binary)));
    if (dir) found.push({ ...spec, path: path.join(dir, spec.binary) });
  }
  const rank = (r: Runtime) => (r.id === 'claude-code' ? 0 : r.id === 'codex' ? 1 : 2);
  return found.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r);
}

/** The arguments for a fresh session or for resuming the last one in the folder. */
export function runtimeArgs(spec: RuntimeSpec, mode: 'new' | 'continue'): string[] {
  if (mode === 'new') return [];
  if (!spec.continueArgs) throw new Error(`${spec.name} cannot continue a previous conversation`);
  return [...spec.continueArgs];
}

const MARK = '__FD_PATH__';

/** The PATH entries printed by the login shell after the marker (anything the shell's rc files print is ignored). */
export function loginPathFrom(output: string): string[] {
  const line = output.split('\n').find((l) => l.startsWith(MARK));
  return line ? line.slice(MARK.length).trim().split(':').filter(Boolean) : [];
}

/** The operator's interactive login shell's PATH: an app opened from Finder gets only the system one.
 *  Read once, with a deadline; a shell that fails or hangs leaves the known install folders. */
export function readLoginPath(timeoutMs = 5000, shell = process.env.SHELL || '/bin/zsh'): Promise<string[]> {
  return new Promise((resolve) => {
    // Its own process group: a deadline ends whatever the rc files started too, not only the shell (audit 2026-10-07).
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(shell, ['-ilc', `printf '\\n${MARK}%s\\n' "$PATH"`], { detached: true, stdio: ['ignore', 'pipe', 'ignore'], env: { HOME: os.homedir(), USER: os.userInfo().username, SHELL: shell, TERM: 'dumb' } });
    } catch {
      resolve([]);
      return;
    }
    let out = '';
    let settled = false;
    const finish = () => { if (settled) return; settled = true; clearTimeout(timer); child.stdout?.destroy(); resolve(loginPathFrom(out)); };
    const timer = setTimeout(() => {
      try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* already gone */ }
      // What the shell printed before the deadline may still sit in the pipe: `close` delivers it
      // once the killed group lets go; this bound covers a descendant that left the group.
      setTimeout(finish, 500).unref();
    }, timeoutMs);
    child.stdout?.on('data', (c: Buffer) => { if (out.length < 256 * 1024) out += c.toString('utf8'); });
    child.on('error', finish);
    child.on('close', finish);
  });
}

/** Switchboard's catalog (`switchboard --json agents list`) as runtime specs: CLI kinds only, its binary name. */
export function specsFromSwitchboard(json: unknown): RuntimeSpec[] {
  const agents = (json as { data?: { agents?: unknown } })?.data?.agents;
  if (!Array.isArray(agents)) return [];
  const out: RuntimeSpec[] = [];
  for (const a of agents as Record<string, unknown>[]) {
    if (typeof a.id !== 'string' || typeof a.binary !== 'string' || typeof a.name !== 'string') continue;
    if (typeof a.kind !== 'string' || !a.kind.split('+').includes('cli')) continue;
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(a.id) || !/^[A-Za-z0-9._-]+$/.test(a.binary)) continue;
    const known = KNOWN_RUNTIMES.find((k) => k.id === a.id || k.binary === a.binary);
    out.push(known ?? { id: a.id, name: a.name, binary: a.binary, provider: null, continueArgs: null });
  }
  return out;
}
// #endregion runtimes
