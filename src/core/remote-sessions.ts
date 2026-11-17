// #region remote-sessions — docs: docs/design/2026-11-15-sessions-machines.md#remote-sessions
// FD-247 (step 4): the sessions of another machine, read from that machine's Switchboard over ssh until Switchboard
// reads them itself (`sessions --all --target`, SB-380). Only machines Switchboard's `targets` names, through a fixed
// argv: no option comes from the answer, host keys are checked as always, nothing prompts (BatchMode). Whatever the
// machine answers is untrusted: parsed by `parseAllSessions` with every field capped and at most REMOTE_MAX_ROWS rows.
import { shellQuote } from './consoles';
import { MACHINE } from './platform';
import type { RemoteMachineStatus, SbPageRow, SbSessionRecord } from './sessions';
import { isOldSwitchboard, parse, parseAllSessions, parsePageRows, switchboardStamp } from './switchboard';
import type { Runner } from '@passioncode-ai/fabric-service-host';

/** Where Switchboard's macOS app keeps its CLI: the one `launch --target` uses on a machine whose target names none. */
export const DEFAULT_REMOTE_SWITCHBOARD = '/Applications/Fabric Switchboard.app/Contents/MacOS/switchboard';
export const REMOTE_MAX_ROWS = 200;

/** One machine Switchboard knows, with the Switchboard there and its data folder (null: the defaults). */
export interface RemoteTarget { machine: string; aliases: string[]; program: string | null; dataDir: string | null }

/** An absolute POSIX path with nothing a shell could read as more than one word or a command. */
const SAFE_PATH = /^\/[A-Za-z0-9 ._@+\/-]{1,1023}$/;

/** `switchboard --json targets`, read strictly: a machine name ssh cannot take as an option, paths only when safe. */
export function parseTargets(stdout: string): RemoteTarget[] {
  let list: unknown;
  try { list = (JSON.parse(stdout) as { data?: { targets?: unknown } } | null)?.data?.targets; } catch { return []; } // as targetsOf reads it
  if (!Array.isArray(list)) return [];
  const out: RemoteTarget[] = [];
  for (const t of list as Record<string, unknown>[]) {
    const machine = t?.machine;
    if (typeof machine !== 'string' || !MACHINE.test(machine) || out.some((o) => o.machine === machine)) continue;
    const aliases = Array.isArray(t.aliases) ? (t.aliases as unknown[]).filter((a): a is string => typeof a === 'string' && MACHINE.test(a) && a !== machine) : [];
    const program = typeof t.program === 'string' && SAFE_PATH.test(t.program) && !t.program.includes('..') ? t.program : null;
    const dataDir = typeof t.data_dir === 'string' && SAFE_PATH.test(t.data_dir) && !t.data_dir.includes('..') ? t.data_dir : null;
    out.push({ machine, aliases, program, dataDir });
    if (out.length >= 20) break;
  }
  return out;
}

/** The argv that asks `target`'s Switchboard for its sessions. */
export function remoteSessionsArgv(target: RemoteTarget, ssh = '/usr/bin/ssh'): string[] {
  const program = target.program ?? DEFAULT_REMOTE_SWITCHBOARD;
  const remote = [shellQuote(program), '--json', 'sessions', '--all', ...(target.dataDir ? ['--data-dir', shellQuote(target.dataDir)] : [])].join(' ');
  return [ssh, '-T', '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', target.machine, remote];
}

/** FD-247 (step 10): the same read through this Mac's Switchboard (`sessions --all --target`, SB-380), which runs the
 *  ssh itself and answers as the machine's Switchboard does; an argv, never a shell line. */
export function targetSessionsArgv(switchboard: string, target: RemoteTarget, rows = false): string[] {
  return [switchboard, '--json', 'sessions', rows ? '--rows' : '--all', '--target', target.machine,
    ...(target.program ? ['--remote', target.program] : []), ...(target.dataDir ? ['--remote-data-dir', target.dataDir] : [])];
}

/** FD-247 (step 10): whether this Mac's Switchboard reads sessions on another machine (its `sessions --help`). */
export const sessionsTakeTarget = (help: string): boolean => /--target\b/.test(help) && /--remote-data-dir\b/.test(help);
/** FD-291 (step 1): whether that `sessions --help` also offers the sessions page (`--rows`, SB-395). */
export const sessionsTakeRows = (help: string): boolean => sessionsTakeTarget(help) && /--rows\b/.test(help);

const remoteFlags = (target: RemoteTarget) => [
  '--target', target.machine, ...(target.program ? ['--remote', target.program] : []), ...(target.dataDir ? ['--remote-data-dir', target.dataDir] : []),
];
/** FD-247 (step 10): Open here through this Mac's Switchboard (`attach --target`, SB-380), which runs `ssh -t` itself. */
export function targetAttachArgv(switchboard: string, target: RemoteTarget, launchId: string): string[] | null {
  return LAUNCH_ID.test(launchId) ? [switchboard, 'attach', launchId, ...remoteFlags(target)] : null;
}
/** FD-247 (step 10): End there through this Mac's Switchboard (`sessions end --target`, SB-380). */
export function targetEndArgv(switchboard: string, target: RemoteTarget, launchId: string): string[] | null {
  return LAUNCH_ID.test(launchId) ? [switchboard, '--json', 'sessions', 'end', launchId, ...remoteFlags(target)] : null;
}
/** What this Mac's Switchboard does on another machine itself, from its `--help` texts. */
export interface TargetDoors { sessions: boolean; attach: boolean; end: boolean; rows?: boolean }

/** How a machine's read went: its rows, or why there are none (each named on the machine's heading). */
export type RemoteRead =
  | { ok: true; rows: SbSessionRecord[]; page?: SbPageRow[] }
  | { ok: false; why: 'unreachable' | 'no-switchboard' | 'too-old' | 'bad-answer' | 'unknown-machine'; detail?: string };

/** FD-247 (step 7): a launch id as Switchboard writes it; only such an id reaches a command on another machine. */
export const LAUNCH_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** FD-247 (step 7): Open here for a session another machine's session host holds: a terminal (`-t`) that runs
 *  `attach` there; closing it leaves the session running (SCN-104 on that machine). */
export function remoteAttachArgv(target: RemoteTarget, launchId: string, ssh = '/usr/bin/ssh'): string[] | null {
  if (!LAUNCH_ID.test(launchId)) return null;
  return [ssh, '-t', '-o', 'ConnectTimeout=5', target.machine, [shellQuote(target.program ?? DEFAULT_REMOTE_SWITCHBOARD), 'attach', shellQuote(launchId), ...(target.dataDir ? ['--data-dir', shellQuote(target.dataDir)] : [])].join(' ')];
}

/** FD-247 (step 7): End for a session another machine's session host holds: `sessions end` there, without a prompt. */
export function remoteEndArgv(target: RemoteTarget, launchId: string, ssh = '/usr/bin/ssh'): string[] | null {
  if (!LAUNCH_ID.test(launchId)) return null;
  return [ssh, '-T', '-n', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', target.machine, [shellQuote(target.program ?? DEFAULT_REMOTE_SWITCHBOARD), '--json', 'sessions', 'end', shellQuote(launchId), ...(target.dataDir ? ['--data-dir', shellQuote(target.dataDir)] : [])].join(' ')];
}

/** FD-291: Continue for a stop another machine's Switchboard reads as ready: a terminal (`-t`) that runs `sessions
 *  continue <session> --in-place --hosted` there, which starts it in that machine's session host under a launch of its
 *  own and attaches to it (SB-400); closing the view leaves it running. `sessions continue` takes no `--target`
 *  (Switchboard 0.7.111), so it is always our ssh. */
export function remoteContinueArgv(target: RemoteTarget, sessionId: string, ssh = '/usr/bin/ssh'): string[] | null {
  if (!LAUNCH_ID.test(sessionId)) return null;
  return [ssh, '-t', '-o', 'ConnectTimeout=5', target.machine, [shellQuote(target.program ?? DEFAULT_REMOTE_SWITCHBOARD), 'sessions', 'continue', shellQuote(sessionId), '--in-place', '--hosted', '--surface', 'dashboards', ...(target.dataDir ? ['--data-dir', shellQuote(target.dataDir)] : [])].join(' ')];
}

/** Reads one machine's sessions; a machine `targets` does not name is refused before any ssh. */
export async function readRemoteSessions(run: Runner, known: readonly RemoteTarget[], machine: string, ssh = '/usr/bin/ssh', via: string | null = null, rows = false): Promise<RemoteRead> {
  const target = known.find((t) => t.machine === machine || t.aliases.includes(machine));
  if (!target) return { ok: false, why: 'unknown-machine' };
  // FD-291 (step 1): the sessions page there (SB-395), with its live processes and stops; a Switchboard there without it
  // answers too old, and the launches are read as before.
  if (via && rows) {
    const [f, ...a] = targetSessionsArgv(via, target, true);
    const r = await run(f!, a, 20_000);
    const data = r.code === 0 ? parse(r.stdout) : null;
    if (data && Array.isArray(data.rows)) return { ok: true, rows: [], page: parsePageRows(data, REMOTE_MAX_ROWS) };
    if (r.code === 255) return { ok: false, why: 'unreachable', detail: r.stderr.trim().slice(0, 300) };
    if (r.code === 127) return { ok: false, why: 'no-switchboard' };
  }
  // FD-247 (step 10): through this Mac's Switchboard when it reads other machines (its ssh's exit code and stderr pass
  // through, so the states below hold); our own ssh otherwise.
  const [file, ...args] = via ? targetSessionsArgv(via, target) : remoteSessionsArgv(target, ssh);
  const r = await run(file!, args, 15_000);
  if (r.code === 255) return { ok: false, why: 'unreachable', detail: r.stderr.trim().slice(0, 300) };
  if (r.code === 127) return { ok: false, why: 'no-switchboard' };
  const data = r.code === 0 ? parse(r.stdout) : null;
  if (!data) {
    if (isOldSwitchboard(`${r.stdout}\n${r.stderr}`)) return { ok: false, why: 'too-old' };
    return { ok: false, why: 'bad-answer', detail: (r.stderr || r.stdout).trim().slice(0, 300) };
  }
  return { ok: true, rows: parseAllSessions(data, REMOTE_MAX_ROWS) };
}
/** FD-247 (step 5): how often each machine is read while the Sessions mode is shown, the waits after failures in a row,
 *  how long a machine's last rows stay, how often `targets` is asked again, and how many ssh run at once. */
export const REMOTE_POLL_MS = 60_000;
export const REMOTE_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000] as const;
export const REMOTE_KEEP_MS = 24 * 60 * 60_000;
export const REMOTE_TARGETS_MS = 10 * 60_000;
export const REMOTE_CONCURRENCY = 2;

interface MachineRead { rows: SbSessionRecord[]; page?: SbPageRow[]; state: RemoteMachineStatus['state']; at: number | null; since: number | null; failures: number; nextAt: number }

/** FD-247 (step 5): the other machines' session lists, read on the caller's tick. Each machine is read at most once a
 *  minute, after a failure only once its backoff has passed, two at a time; a failure keeps the last rows, which go
 *  24 h after the last good read. The caller decides when to tick (only while the Sessions mode is shown). */
export class RemoteSessions {
  private targets: RemoteTarget[] = [];
  private targetsAt = -Infinity;
  private targetsOf: string | null = null;
  /** FD-305: the switchboardStamp the doors were read for. */
  private doorsOf: string | null = null;
  /** FD-247 (step 10): what `targetsOf`'s Switchboard does on another machine itself, asked with `targets`. */
  private doors: TargetDoors = { sessions: false, attach: false, end: false };
  private readonly machines = new Map<string, MachineRead>();
  private inFlight: Promise<boolean> | null = null;

  constructor(private readonly run: Runner, private readonly now: () => number = Date.now, private readonly ssh = '/usr/bin/ssh') {}

  /** One tick; resolves true when what `input` or `status` answer changed. A tick while one runs joins it. */
  poll(switchboard: string | null): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    const p = this.tick(switchboard).finally(() => { this.inFlight = null; });
    this.inFlight = p;
    return p;
  }

  private async tick(switchboard: string | null): Promise<boolean> {
    if (!switchboard) return this.clear();
    let changed = false;
    const now = this.now();
    if (switchboard !== this.targetsOf || now - this.targetsAt >= REMOTE_TARGETS_MS) {
      const r = await this.run(switchboard, ['--json', 'targets'], 10_000).catch(() => null);
      // A failed `targets` keeps the machines known, so one slow answer does not empty the list.
      if (r && r.code === 0) {
        if (switchboardStamp(switchboard) !== this.doorsOf) {
          this.doorsOf = switchboardStamp(switchboard); // FD-305: an in-place update is asked again
          const takes = async (args: string[]) => { const h = await this.run(switchboard, args, 10_000).catch(() => null); return Boolean(h && h.code === 0 && sessionsTakeTarget(h.stdout)); };
          const help = await this.run(switchboard, ['sessions', '--help'], 10_000).catch(() => null);
          const text = help && help.code === 0 ? help.stdout : '';
          this.doors = { sessions: sessionsTakeTarget(text), rows: sessionsTakeRows(text), attach: await takes(['attach', '--help']), end: await takes(['sessions', 'end', '--help']) };
        }
        this.targets = parseTargets(r.stdout); this.targetsOf = switchboard;
      }
      this.targetsAt = now;
      for (const m of [...this.machines.keys()]) if (!this.targets.some((t) => t.machine === m)) { this.machines.delete(m); changed = true; }
    }
    for (const t of this.targets) if (!this.machines.has(t.machine)) { this.machines.set(t.machine, { rows: [], state: 'reading', at: null, since: null, failures: 0, nextAt: now }); changed = true; }
    const due = this.targets.filter((t) => (this.machines.get(t.machine)?.nextAt ?? 0) <= now);
    let next = 0;
    const worker = async () => {
      while (next < due.length) {
        const t = due[next++]!;
        const read = await readRemoteSessions(this.run, this.targets, t.machine, this.ssh, this.doors.sessions ? switchboard : null, this.doors.rows === true).catch((): RemoteRead => ({ ok: false, why: 'bad-answer' }));
        const m = this.machines.get(t.machine);
        if (!m) continue;
        const at = this.now();
        if (read.ok) {
          if (m.state !== 'ok' || JSON.stringify(m.rows) !== JSON.stringify(read.rows) || JSON.stringify(m.page) !== JSON.stringify(read.page)) changed = true;
          Object.assign(m, { rows: read.rows, page: read.page, state: 'ok', at, since: null, failures: 0, nextAt: at + REMOTE_POLL_MS });
        } else {
          const state: RemoteMachineStatus['state'] = read.why === 'unknown-machine' ? 'bad-answer' : read.why;
          if (m.state !== state) changed = true;
          m.failures += 1;
          Object.assign(m, { state, since: m.since ?? at, nextAt: at + REMOTE_BACKOFF_MS[Math.min(m.failures, REMOTE_BACKOFF_MS.length) - 1]! });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(REMOTE_CONCURRENCY, due.length) }, worker));
    return changed;
  }

  /** FD-247 (step 10): the Switchboard last asked and what it does on another machine itself; null before a good read. */
  via(): { switchboard: string; doors: TargetDoors } | null {
    return this.targetsOf ? { switchboard: this.targetsOf, doors: this.doors } : null;
  }

  /** FD-247 (step 7): read this machine again at the next tick (after an act there). */
  invalidate(machine: string): void {
    const m = this.machines.get(machine);
    if (m) m.nextAt = 0;
  }

  /** FD-247 (step 7): the machine as `targets` names it (an alias finds it too), or null. */
  target(machine: string): RemoteTarget | null {
    return this.targets.find((t) => t.machine === machine || t.aliases.includes(machine)) ?? null;
  }

  /** The rows to merge: each machine's last good read, while it is under REMOTE_KEEP_MS old. */
  input(now = this.now()): { machine: string; rows: SbSessionRecord[]; page?: SbPageRow[] }[] {
    return [...this.machines].filter(([, m]) => m.at !== null && now - m.at <= REMOTE_KEEP_MS && m.rows.length + (m.page?.length ?? 0) > 0)
      .map(([machine, m]) => (m.page ? { machine, rows: m.rows, page: m.page } : { machine, rows: m.rows }));
  }

  status(now = this.now()): RemoteMachineStatus[] {
    return [...this.machines].map(([machine, m]) => ({ machine, state: m.state, at: m.at, since: m.since, rows: m.at !== null && now - m.at <= REMOTE_KEEP_MS ? m.rows.length + (m.page?.length ?? 0) : 0 }));
  }

  /** Forget every machine (the switch turned off, Switchboard gone); true when something was listed. */
  clear(): boolean {
    const had = this.machines.size > 0;
    this.machines.clear();
    this.targets = [];
    this.targetsAt = -Infinity;
    this.targetsOf = null;
    this.doorsOf = null;
    return had;
  }
}
// #endregion remote-sessions
