// #region remote-sessions — docs: docs/design/2026-11-15-sessions-machines.md#remote-sessions
// FD-247 (step 4): the sessions of another machine, read from that machine's Switchboard over ssh until Switchboard
// reads them itself (`sessions --all --target`, SB-380). Only machines Switchboard's `targets` names, through a fixed
// argv: no option comes from the answer, host keys are checked as always, nothing prompts (BatchMode). Whatever the
// machine answers is untrusted: parsed by `parseAllSessions` with every field capped and at most REMOTE_MAX_ROWS rows.
import { shellQuote } from './consoles';
import { MACHINE } from './platform';
import type { SbSessionRecord } from './sessions';
import { parse, parseAllSessions } from './switchboard';
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

/** How a machine's read went: its rows, or why there are none (each named on the machine's heading). */
export type RemoteRead =
  | { ok: true; rows: SbSessionRecord[] }
  | { ok: false; why: 'unreachable' | 'no-switchboard' | 'too-old' | 'bad-answer' | 'unknown-machine'; detail?: string };

/** Reads one machine's sessions; a machine `targets` does not name is refused before any ssh. */
export async function readRemoteSessions(run: Runner, known: readonly RemoteTarget[], machine: string, ssh = '/usr/bin/ssh'): Promise<RemoteRead> {
  const target = known.find((t) => t.machine === machine || t.aliases.includes(machine));
  if (!target) return { ok: false, why: 'unknown-machine' };
  const [file, ...args] = remoteSessionsArgv(target, ssh);
  const r = await run(file!, args, 15_000);
  if (r.code === 255) return { ok: false, why: 'unreachable', detail: r.stderr.trim().slice(0, 300) };
  if (r.code === 127) return { ok: false, why: 'no-switchboard' };
  const data = r.code === 0 ? parse(r.stdout) : null;
  if (!data) {
    if (/unrecognized subcommand|unexpected argument|earlier version than this command/i.test(`${r.stdout}\n${r.stderr}`)) return { ok: false, why: 'too-old' };
    return { ok: false, why: 'bad-answer', detail: (r.stderr || r.stdout).trim().slice(0, 300) };
  }
  return { ok: true, rows: parseAllSessions(data, REMOTE_MAX_ROWS) };
}
// #endregion remote-sessions
