// #region agent-console — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
// ADR-0017: one console per service — a PTY running a coding-agent runtime's own CLI in the
// service's folder. The app owns each process (LC-02): it ends when the person stops it, when its
// service is removed, and when the app quits. What it printed is kept in a bounded ring, so a hidden
// window receives nothing (LC-08) and showing the console again replays it. The PTY is injected:
// node-pty in the app, a fake in tests.
import { EventEmitter } from 'node:events';
import { commandEnv } from './children';
import { runtimeArgs, type Runtime } from './runtimes';
import { inPlaceArgv, type Binding } from './switchboard';

export interface PtyLike {
  pid: number;
  onData(cb: (data: string) => void): { dispose(): void };
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): { dispose(): void };
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
}

export type SpawnPty = (file: string, args: string[], opts: { cwd: string; env: Record<string, string>; cols: number; rows: number; name: string }) => PtyLike;

export interface ConsoleSnapshot {
  key: string;
  state: 'idle' | 'running' | 'exited';
  label: string;
  cwd: string;
  output: string;
  /** How many characters the session has printed in all: a reader that showed `output` up to here
   *  appends only the part of a later `data` event past it (no gap, no repeat). */
  end: number;
  exitCode: number | null;
  /** The signal that ended it (a Stop), or null. */
  signal: number | null;
  startedAt: number | null;
}

/** `env` is laid over the app's own environment: the login shell's PATH, above all (review R-1). */
export interface StartPlan { argv: string[]; cwd: string; label: string; env?: Record<string, string> }

/** What a press of New or Continue does, decided before anything is spawned. */
export type Plan =
  | { kind: 'run'; argv: string[]; cwd: string }
  | { kind: 'terminal-only'; project: string; pool: string } // a bound folder this Switchboard cannot run in place
  | { kind: 'refused'; reason: 'switchboard' | 'no-continue'; detail: string };

export function planStart(o: { runtime: Runtime; mode: 'new' | 'continue'; folder: string; binding: Binding; switchboard: string | null; inPlace: boolean }): Plan {
  let args: string[];
  try {
    args = runtimeArgs(o.runtime, o.mode);
  } catch (error) {
    return { kind: 'refused', reason: 'no-continue', detail: (error as Error).message };
  }
  // A folder Switchboard could not answer about is never started on a guess: it might be bound.
  if (o.binding.kind === 'error') return { kind: 'refused', reason: 'switchboard', detail: o.binding.detail };
  if (o.binding.kind === 'project' && o.runtime.provider) {
    if (o.switchboard && o.inPlace) return { kind: 'run', argv: inPlaceArgv(o.switchboard, o.runtime.provider, o.folder, args), cwd: o.folder };
    return { kind: 'terminal-only', project: o.binding.name, pool: o.binding.pool };
  }
  return { kind: 'run', argv: [o.runtime.path, ...args], cwd: o.folder };
}

/** POSIX single-quoting: the result is one word whatever it holds. */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** The line Terminal runs to continue a session: `cd` into the folder, then the runtime, all quoted. */
export function terminalScript(argv: string[], folder: string): string {
  return `cd ${shellQuote(folder)} && exec ${argv.map(shellQuote).join(' ')}`;
}

interface Session {
  pty: PtyLike | null;
  label: string;
  cwd: string;
  chunks: string[];
  size: number;
  emitted: number;
  exitCode: number | null;
  signal: number | null;
  startedAt: number;
  killTimer: NodeJS.Timeout | null;
  exited: Promise<void>;
  resolveExit: () => void;
}

export class ConsoleManager extends EventEmitter {
  private readonly sessions = new Map<string, Session>();
  /** Sessions of removed services, kept until they have exited, so quit still waits for them. */
  private readonly dying = new Set<Session>();
  private readonly ringChars: number;
  private readonly killGraceMs: number;

  constructor(private readonly o: { spawn: SpawnPty; env: () => NodeJS.ProcessEnv; ringChars?: number; killGraceMs?: number; now?: () => number;
    /** Signals a process group; default `process.kill(-pid)`. Tests pass a fake: a fake pid is not a real group. */
    killGroup?: (pid: number, signal: NodeJS.Signals) => void }) {
    super();
    this.ringChars = o.ringChars ?? 1_000_000;
    this.killGraceMs = o.killGraceMs ?? 2_000;
  }

  start(key: string, plan: StartPlan, size: { cols: number; rows: number }): { ok: true } | { ok: false; error: string } {
    if (this.sessions.get(key)?.pty) return { ok: false, error: 'running' };
    const [file, ...args] = plan.argv;
    if (!file) return { ok: false, error: 'nothing to run' };
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(commandEnv(this.o.env()))) if (typeof v === 'string') env[k] = v;
    Object.assign(env, { TERM: 'xterm-256color', COLORTERM: 'truecolor', FABRIC_DASHBOARDS_SERVICE: key });
    if (!env.LANG) env.LANG = 'en_US.UTF-8';
    Object.assign(env, plan.env ?? {});
    let pty: PtyLike;
    try {
      pty = this.o.spawn(file, args, { cwd: plan.cwd, env, cols: Math.max(2, size.cols), rows: Math.max(1, size.rows), name: 'xterm-256color' });
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
    let resolveExit: () => void = () => undefined;
    const exited = new Promise<void>((r) => { resolveExit = r; });
    const s: Session = { pty, label: plan.label, cwd: plan.cwd, chunks: [], size: 0, emitted: 0, exitCode: null, signal: null, startedAt: (this.o.now ?? Date.now)(), killTimer: null, exited, resolveExit };
    this.sessions.set(key, s);
    pty.onData((data) => {
      if (this.sessions.get(key) !== s) return;
      this.keep(s, data);
      s.emitted += data.length;
      this.emit('data', { key, data, end: s.emitted });
    });
    pty.onExit(({ exitCode, signal }) => {
      if (s.killTimer) clearTimeout(s.killTimer);
      s.pty = null;
      s.exitCode = exitCode;
      s.signal = signal ? signal : null;
      s.resolveExit();
      this.dying.delete(s);
      if (this.sessions.get(key) === s) this.emit('exit', { key, code: exitCode, signal: s.signal });
    });
    this.emit('state', { key });
    return { ok: true };
  }

  private keep(s: Session, data: string): void {
    s.chunks.push(data);
    s.size += data.length;
    while (s.size > this.ringChars && s.chunks.length) {
      const over = s.size - this.ringChars;
      const first = s.chunks[0]!;
      if (first.length <= over) { s.chunks.shift(); s.size -= first.length; } else { s.chunks[0] = first.slice(over); s.size -= over; }
    }
  }

  input(key: string, data: string): void {
    this.sessions.get(key)?.pty?.write(data);
  }

  resize(key: string, cols: number, rows: number): void {
    const pty = this.sessions.get(key)?.pty;
    if (pty && cols > 1 && rows > 0) { try { pty.resize(Math.floor(cols), Math.floor(rows)); } catch { /* exited between the check and the call */ } }
  }

  /** Hang up the whole process group (node-pty's helper makes the runtime a session leader, so its
   *  pid is the group); whatever ignores it is killed after the grace (LC-02, as children.ts does). */
  stop(key: string): void {
    const s = this.sessions.get(key);
    if (s) this.end(s);
  }

  private end(s: Session): void {
    if (!s.pty || s.killTimer) return;
    const pty = s.pty;
    const signal = (sig: NodeJS.Signals) => {
      try { (this.o.killGroup ?? ((pid, sg) => process.kill(-pid, sg)))(pty.pid, sig); } catch { try { pty.kill(sig); } catch { /* already gone */ } }
    };
    signal('SIGHUP');
    s.killTimer = setTimeout(() => { if (s.pty === pty) signal('SIGKILL'); }, this.killGraceMs);
  }

  /** The service is gone: its session ends, and nothing of it is shown again; quit still waits for it. */
  forget(key: string): void {
    const s = this.sessions.get(key);
    if (!s) return;
    this.sessions.delete(key);
    if (s.pty) { this.dying.add(s); this.end(s); }
    this.emit('state', { key });
  }

  snapshot(key: string): ConsoleSnapshot {
    const s = this.sessions.get(key);
    if (!s) return { key, state: 'idle', label: '', cwd: '', output: '', end: 0, exitCode: null, signal: null, startedAt: null };
    return { key, state: s.pty ? 'running' : 'exited', label: s.label, cwd: s.cwd, output: s.chunks.join(''), end: s.emitted, exitCode: s.exitCode, signal: s.signal, startedAt: s.startedAt };
  }

  runningCount(): number {
    return [...this.sessions.values(), ...this.dying].filter((s) => s.pty).length;
  }

  /** Quit (LC-02): every session ends, a removed service's too; resolves once each has exited or been killed. */
  async stopAll(): Promise<void> {
    const running = [...this.sessions.values(), ...this.dying].filter((s) => s.pty);
    for (const s of running) this.end(s);
    await Promise.all(running.map((s) => Promise.race([s.exited, new Promise<void>((r) => setTimeout(r, this.killGraceMs + 200))])));
  }
}
// #endregion agent-console
