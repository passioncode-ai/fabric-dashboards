// FD-109 (4): an app update used to end every agent session's MCP server (LC-10: it answered `stale`
// and exited), and Claude Code does not start a server again by itself, so the agent lost `open`
// and `link` until its session restarted, and went to a browser. Now the stale server hands its
// session to the server of the installed copy: it starts that copy's launcher, repeats the
// session's `initialize` to it, and from then on only passes lines both ways. The agent keeps one
// connection and the new version answers it.
// #region mcp-handover — docs: AGENTS.md#lifecycle
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';

const MAC = /[\\/]Contents[\\/]Resources[\\/]app\.asar[\\/]/;
const OTHER = /[\\/]resources[\\/]app\.asar[\\/]/i;
export const HANDOVER_ID = 'fabric-dashboards-handover';
export const HANDOVER_TIMEOUT_MS = 15_000;
/** FD-133: set in the environment of a server another one started to take its session. Such a server never hands its
 *  session on: one hand-over per update, never a chain of servers starting each other. */
export const HANDED_ENV = 'FABRIC_DASHBOARDS_MCP_HANDED';

/** FD-150: set beside HANDED_ENV by a server that can start the next copy itself. A handed server that goes stale
 *  then exits with REHAND_EXIT and leaves its unanswered calls unanswered; the server that started it starts the newly
 *  installed copy, repeats initialize and sends those calls again. A session outlives any number of updates, and there
 *  is still never more than one relay and one server behind it. Without this mark (a relay from before FD-150) the
 *  handed server answers stale and leaves, as before. */
export const REHAND_ENV = 'FABRIC_DASHBOARDS_MCP_REHAND';
export const REHAND_EXIT = 75;
/** At most this many fresh copies within REHAND_WINDOW_MS; a copy that keeps going stale at once is a fault, not updates. */
export const REHAND_MAX = 3;
export const REHAND_WINDOW_MS = 60_000;

/** The environment a hand-over starts the installed copy's server with. */
export function handedEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...env, [HANDED_ENV]: '1', [REHAND_ENV]: '1' };
}

/** The MCP launcher of the installed copy this server file belongs to; null outside a packaged app. */
export function launcherOf(from: string, platform: NodeJS.Platform = process.platform): string | null {
  const m = MAC.exec(from) ?? OTHER.exec(from);
  if (!m) return null;
  const sep = m[0][0]!;
  const resources = from.slice(0, m.index + m[0].toLowerCase().indexOf('app.asar') - 1);
  return [resources, 'bin', platform === 'win32' ? 'fabric-dashboards-mcp.cmd' : 'fabric-dashboards-mcp'].join(sep);
}

/** Starts the installed copy's server, as Claude Code would: the launcher, or cmd.exe running it on Windows. */
export function spawnLauncher(launcher: string, platform: NodeJS.Platform = process.platform): ChildProcess {
  // cmd /s strips one pair of outer quotes, so the path (it has a space) is quoted twice (scripts/dist-other.mjs).
  const [cmd, args] = platform === 'win32' ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `""${launcher}""`]] : [launcher, []];
  return spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'], env: handedEnv(), windowsHide: true, windowsVerbatimArguments: platform === 'win32' });
}

export interface Relay {
  /** One line from the client: queued until the new server has answered the repeated initialize. */
  send(line: string): void;
  /** The client went away: close the new server's input, give it 1.5 s, then end it. */
  end(): void;
}

export interface RelayOptions {
  child: ChildProcess;
  /** The params of the client's own initialize, repeated to the new server. */
  init: unknown;
  output: NodeJS.WritableStream;
  /** The new server did not take the session (it did not start or did not answer): these lines are the caller's again. */
  failed(why: string, queued: string[]): void;
  /** The relay is over (the new server exited, or the client went away): the old process exits with this code. */
  done(code: number): void;
  /** FD-150: the new server went stale itself (it exited with REHAND_EXIT); these calls it took are unanswered. */
  rehand?(pending: string[]): void;
  timeoutMs?: number;
}

export function startRelay(o: RelayOptions): Relay {
  const { child, output } = o;
  let state: 'handshake' | 'open' | 'over' = 'handshake';
  let queued: string[] = [];
  let ending = false;
  // FD-150: the calls the new server took and has not answered, by id, so a fresh copy can be sent them again.
  const pending = new Map<string, string>();
  const keyOf = (id: unknown) => JSON.stringify(id);
  const fail = (why: string) => {
    if (state !== 'handshake') return;
    state = 'over';
    clearTimeout(timer);
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
    o.failed(why, queued);
    queued = [];
  };
  const timer = setTimeout(() => fail('the new server did not answer initialize in time'), o.timeoutMs ?? HANDOVER_TIMEOUT_MS);
  timer.unref?.();
  const toChild = (line: string) => { try { child.stdin?.write(`${line}\n`); } catch { /* its exit ends the relay */ } };
  const track = (line: string) => {
    try {
      const m = JSON.parse(line) as { id?: unknown; method?: unknown };
      if (m && m.id !== undefined && m.id !== null && typeof m.method === 'string') pending.set(keyOf(m.id), line);
    } catch { /* not a call */ }
  };
  child.once('error', (error) => fail(`the new server did not start: ${error.message}`));
  child.stdin?.on('error', () => { /* a closed pipe: the exit below ends the relay */ });
  child.once('exit', (code) => {
    if (state === 'handshake') return fail(`the new server exited before it answered (code ${code})`);
    if (state === 'over') return;
    state = 'over';
    if (code === REHAND_EXIT && !ending && o.rehand) return o.rehand([...pending.values()]);
    o.done(ending ? 0 : code ?? 0);
  });
  if (child.stdout) {
    readline.createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line) => {
      if (state === 'open') {
        try {
          const m = JSON.parse(line) as { id?: unknown; method?: unknown };
          if (m && m.id !== undefined && m.id !== null && m.method === undefined) pending.delete(keyOf(m.id));
        } catch { /* passed on as it is */ }
        output.write(`${line}\n`);
        return;
      }
      if (state !== 'handshake') return;
      let answer: { id?: unknown; result?: unknown };
      try { answer = JSON.parse(line) as typeof answer; } catch { return; }
      if (answer.id !== HANDOVER_ID) return;
      if (!answer.result) return fail('the new server refused initialize');
      clearTimeout(timer);
      state = 'open';
      toChild(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
      for (const q of queued.splice(0)) { track(q); toChild(q); }
      if (ending) child.stdin?.end();
    });
  }
  toChild(JSON.stringify({ jsonrpc: '2.0', id: HANDOVER_ID, method: 'initialize', params: o.init ?? {} }));
  return {
    send(line) {
      if (state === 'open') { track(line); toChild(line); }
      else if (state === 'handshake') queued.push(line);
    },
    end() {
      if (ending) return;
      ending = true;
      if (state === 'open') child.stdin?.end();
      const kill = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, 1500);
      kill.unref?.();
      if (state === 'handshake') fail('the client went away during the hand-over');
    },
  };
}

/** The live hand-over for a server started from `from`: the installed copy's server, or null when no launcher is
 *  there to take the session (a checkout, or the app was removed rather than updated). Looked up at hand-over time. */
export function liveHandover(from: string, env: NodeJS.ProcessEnv = process.env, start: (launcher: string) => ChildProcess = spawnLauncher): () => ChildProcess | null {
  return () => {
    if (env[HANDED_ENV] === '1') return null; // FD-133: it was handed a session itself; it answers stale and leaves instead
    const launcher = launcherOf(from);
    return launcher && fs.existsSync(launcher) ? start(launcher) : null;
  };
}
// #endregion mcp-handover
