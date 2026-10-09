// Child processes the app or the MCP server starts on a person's or an agent's behalf — a
// descriptor's `doctor` or `update` argv. Every one has an owner (this registry), a deadline and
// its own process group, so a timeout or our own exit ends the command AND whatever it started
// (lifecycle LC-02; LC-10 for the per-session MCP server). launchctl calls are not here: they are
// short, bounded by their own runner and start nothing that outlives them.
// #region owned-children — docs: AGENTS.md#lifecycle
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { descendantsOf, parseSnapshot, SNAPSHOT_SCRIPT } from './proctree';

/** Variables a descriptor's command must never inherit. The packaged MCP server runs Electron as
 *  Node (`ELECTRON_RUN_AS_NODE=1`): passed on, any Electron or `open`-based step inside the command
 *  would start in Node mode and silently do nothing. `NODE_OPTIONS` would inject flags into every
 *  Node program the command runs. */
export const STRIPPED_ENV = ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS'] as const;

export function commandEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  for (const name of STRIPPED_ENV) delete out[name];
  return out;
}

/** `started` is false only when the command never ran (no such file, no permission); `signal` names
 *  what ended one that did (T-6). */
export interface OwnedResult { code: number | null; output: string; timedOut: boolean; started?: boolean; signal?: NodeJS.Signals | null }
export interface OwnedOptions { timeoutMs: number; killGraceMs?: number; maxBuffer?: number; env?: NodeJS.ProcessEnv }

const owned = new Set<ChildProcess>();
/** T-12: groups a finished command left behind, until their SIGTERM/SIGKILL is done. Counted as
 *  owned, so a quit or an automatic install never leaves them running. */
const lingering = new Set<ChildProcess>();
const KILL_GRACE_MS = 2_000;
/** FD-37: Windows has no process groups or SIGTERM (platforms.md PL-07) — a tree is ended with
 *  `taskkill /T /F`, and what a finished command left behind is found by parent chain and creation time. */
const WIN = process.platform === 'win32';
/** When each owned command started (epoch ms), for the Windows identity check. */
const startedAt = new WeakMap<ChildProcess, number>();
/** How far a process's creation time may precede the moment we recorded its start (clock granularity). */
const CLOCK_ALLOWANCE_MS = 1_000;

function quiet(file: string, args: string[], timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (_error, stdout) => resolve(String(stdout ?? '')));
  });
}

/** Windows: the whole tree of a live command, at once (there is no gentler signal to send). */
async function killWindowsTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid || child.exitCode !== null || child.signalCode !== null) return;
  await quiet('taskkill', ['/PID', String(pid), '/T', '/F']);
}

/** Windows: what a finished command left running — its descendants created since it started. */
async function killWindowsLeftovers(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  const since = startedAt.get(child);
  if (!pid || since === undefined) return;
  const rows = parseSnapshot(await quiet('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SNAPSHOT_SCRIPT]));
  for (const left of descendantsOf(rows, pid, since - CLOCK_ALLOWANCE_MS)) await quiet('taskkill', ['/PID', String(left), '/T', '/F']);
}

/** The platform's way to end a command and everything it started. */
function killTree(child: ChildProcess, graceMs: number): Promise<void> {
  return WIN ? killWindowsTree(child) : killGroup(child, graceMs);
}
/** How long a finished command's output streams may stay open before it counts as done. */
const EXIT_STREAM_GRACE_MS = 1_000;

/** SIGTERM to the whole group, SIGKILL after `graceMs` if anything in it is still there. */
function killGroup(child: ChildProcess, graceMs: number): Promise<void> {
  const pid = child.pid;
  if (!pid) return Promise.resolve();
  const signal = (s: NodeJS.Signals) => { try { process.kill(-pid, s); } catch { /* the group is already gone */ } };
  const groupAlive = () => { try { process.kill(-pid, 0); return true; } catch { return false; } };
  signal('SIGTERM');
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      if (!groupAlive()) return resolve();
      if (Date.now() - started >= graceMs) { signal('SIGKILL'); return resolve(); }
      // Not unref'd: a kill in progress keeps the process alive until SIGKILL is sent, so an
      // exiting caller never abandons a group that ignored SIGTERM (seen in CI, 2026-10-05).
      setTimeout(poll, 25);
    };
    poll();
  });
}

/** Run `command args` in its own process group, with the descriptor-safe environment. */
export function runOwned(command: string, args: string[], o: OwnedOptions): Promise<OwnedResult> {
  const maxBuffer = o.maxBuffer ?? 8 * 1024 * 1024;
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      // POSIX: its own process group (detached). Windows: `detached` would open a console window; the
      // tree is followed by parent chain instead (killWindowsTree, killWindowsLeftovers).
      child = spawn(command, args, WIN
        ? { stdio: ['ignore', 'pipe', 'pipe'], env: o.env ?? commandEnv(), windowsHide: true }
        : { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: o.env ?? commandEnv() });
    } catch (error) {
      resolve({ code: null, output: (error as Error).message, timedOut: false, started: false, signal: null });
      return;
    }
    owned.add(child);
    startedAt.set(child, Date.now());
    let stdout = '';
    let stderr = '';
    const take = (which: 'out' | 'err') => (chunk: Buffer) => {
      if (stdout.length + stderr.length > maxBuffer) return;
      if (which === 'out') stdout += String(chunk); else stderr += String(chunk);
    };
    child.stdout?.on('data', take('out'));
    child.stderr?.on('data', take('err'));
    let timedOut = false;
    let started = false;
    child.once('spawn', () => { started = true; });
    const timer = setTimeout(() => { timedOut = true; void killTree(child, o.killGraceMs ?? KILL_GRACE_MS); }, o.timeoutMs);
    timer.unref();
    const finish = (code: number | null, signal: NodeJS.Signals | null, extra = '') => {
      clearTimeout(timer);
      owned.delete(child);
      // R-17 (LC-02): what the command left running in its own group ends with it — nothing
      // outlives the command's deadline or the app's quit. One that left the group (setsid) is not ours.
      if (child.pid && WIN) {
        lingering.add(child);
        void killWindowsLeftovers(child).finally(() => lingering.delete(child));
      } else if (child.pid) {
        try {
          process.kill(-child.pid, 0);
          lingering.add(child);
          void killGroup(child, o.killGraceMs ?? KILL_GRACE_MS).finally(() => lingering.delete(child));
        } catch { /* the group is gone */ }
      }
      resolve({ code, output: `${stdout}${stderr ? `\n${stderr}` : ''}${extra}`.trim(), timedOut, started, signal });
    };
    let done = false;
    const settle = (code: number | null, signal: NodeJS.Signals | null, extra = '') => { if (!done) { done = true; finish(code, signal, extra); } };
    child.once('error', (error) => settle(null, null, `\n${error.message}`));
    child.once('close', (code, signal) => settle(timedOut ? null : code, timedOut ? null : signal));
    // 'close' waits for stdout and stderr to end; a descendant that left the group can hold them
    // open forever. Once the command itself has exited, give its streams a second, then stop
    // reading them and finish — the command is over either way.
    child.once('exit', (code, signal) => {
      setTimeout(() => {
        if (done) return;
        child.stdout?.destroy();
        child.stderr?.destroy();
        settle(timedOut ? null : code, timedOut ? null : signal);
      }, EXIT_STREAM_GRACE_MS);
    });
  });
}

/** End every owned command and its group — on quit, on stdin EOF, on SIGTERM. */
export async function killOwned(graceMs = 300): Promise<void> {
  if (WIN) {
    await Promise.all([...owned].map((child) => killWindowsTree(child)));
    await Promise.all([...owned, ...lingering].map((child) => killWindowsLeftovers(child)));
    return;
  }
  await Promise.all([...owned, ...lingering].map((child) => killGroup(child, graceMs)));
}

export function ownedCount(): number {
  return owned.size + lingering.size;
}
// #endregion owned-children
