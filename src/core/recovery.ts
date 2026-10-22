// #region limit-recovery — docs: docs/ux/scenarios.md#scn-075-a-session-stopped-on-a-limit-continues-by-itself
// FD-83 (operator 2026-10-21, «лимиты прошли ... перезапускай агентов»): Switchboard registers every Claude Code session
// that stops on a usage limit (SB-115) and says which are ready to continue, but it owns no terminal: the host acts on
// `ready` rows, and this app's console is that host. A ready stop is continued here only when nothing else can be
// writing its transcript: no live claude or codex process in its folder and none running with its session id (two
// writers on one transcript is the failure SB-115 forbids). It is claimed once and continued with `--resume` by the
// agent's own CLI in its folder, in the home that holds its transcript (FD-84: a Switchboard managed launch runs in a
// home of its own where the transcript is not, and holds one session per pool); a folder bound to a Switchboard group
// routes that CLI through Switchboard by its own settings. Its outcome is recorded only once the session has lived
// RESUME_SETTLE_MS. A stop older than a day, a billing stop, or one whose session
// is still open stays for the person, listed on the Connections page. Ids, folders and times only: never a prompt or
// a token.
import type { Runner } from '@passioncode-ai/fabric-service-host';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { StopVerdict } from './types';

export type { RecoveryStatus, StopVerdict, StopView } from './types';

export interface SbStop {
  /** Switchboard's stop event (`cc-<session>-<unix>`): what `claim` and `finish` name. */
  event: string;
  session: string;
  dir: string;
  provider: 'claude' | 'codex';
  /** Compatible accounts with fresh capacity, Switchboard's order; the first is claimed. */
  candidates: string[];
  ready: boolean;
  /** `limit` waits for capacity; `billing` waits for a payment, never resumed here. */
  kind: 'limit' | 'billing';
  /** `waiting`, `claimed` or `resumed`, as Switchboard keeps it. */
  state: string;
  stoppedAt: number;
  attempt: number;
}

export type SbRecovery = { stops: SbStop[] } | { unavailable: 'old' | 'error'; detail: string };

/** A stop older than this is left for the person: its task may be finished or moved on (decision 2026-10-21). */
export const RESUME_MAX_AGE_MS = 24 * 60 * 60_000;
/** At most this many sessions start in one pass, so a reset never opens every console at once. */
export const RESUMES_PER_PASS = 2;
/** What the continued session is told: one line, the same for every agent. */
export const RESUME_BRIEF = 'The usage limit has reset. Continue your task from where it stopped.';
/** FD-84: a continued session counts as resumed only once it has run this long; one that exits sooner is cancelled. */
export const RESUME_SETTLE_MS = 15_000;

const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EVENT = /^[A-Za-z0-9._:-]{1,200}$/;

function parseData(stdout: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(stdout) as { ok?: boolean; data?: unknown };
    return v && v.ok === true && v.data && typeof v.data === 'object' ? (v.data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function failure(r: { code: number | null; stdout: string; stderr: string }): { unavailable: 'old' | 'error'; detail: string } {
  const text = `${r.stdout}\n${r.stderr}`;
  const old = /unrecognized subcommand|unexpected argument|earlier version than this command/i.test(text);
  return { unavailable: old ? 'old' : 'error', detail: text.trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}` };
}

/** Every registered stop, as Switchboard reports it; a malformed row is skipped, never guessed at. */
export function parseRecovery(stdout: string): SbStop[] | null {
  const data = parseData(stdout);
  if (!data) return null;
  const out: SbStop[] = [];
  for (const row of Array.isArray(data.sessions) ? (data.sessions as Record<string, unknown>[]) : []) {
    const s = (row?.stop ?? null) as Record<string, unknown> | null;
    if (!s || typeof s !== 'object') continue;
    const { event, session, directory, provider } = s;
    if (typeof event !== 'string' || !EVENT.test(event) || typeof session !== 'string' || !SESSION.test(session)) continue;
    if (typeof directory !== 'string' || !path.isAbsolute(directory) || (provider !== 'claude' && provider !== 'codex')) continue;
    const stopped = typeof s.stopped_at === 'number' && Number.isFinite(s.stopped_at) ? s.stopped_at * 1000 : 0;
    out.push({
      event, session, dir: directory, provider,
      candidates: Array.isArray(row.candidates) ? (row.candidates as unknown[]).filter((c): c is string => typeof c === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(c)) : [],
      ready: row.ready === true,
      kind: s.kind === 'billing' ? 'billing' : 'limit',
      state: typeof s.state === 'string' ? s.state.slice(0, 32) : 'waiting',
      stoppedAt: stopped,
      attempt: typeof s.attempt === 'number' ? s.attempt : 1,
    });
  }
  return out;
}

export async function recoveryOf(run: Runner, sb: string): Promise<SbRecovery> {
  const r = await run(sb, ['--json', 'recovery'], 10_000);
  const stops = r.code === 0 ? parseRecovery(r.stdout) : null;
  return stops ? { stops } : failure(r);
}

/** Claims a ready stop once on one of its candidates. Switchboard persists the claim before it answers. */
export async function claimStop(run: Runner, sb: string, stop: SbStop, account: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const r = await run(sb, ['--json', 'recovery', 'claim', '--account', account, stop.event], 10_000);
  return r.code === 0 && parseData(r.stdout) ? { ok: true } : { ok: false, detail: failure(r).detail };
}

/** Records what the host saw: `resumed` once the session runs again, `cancelled` when it could not start. */
export async function finishStop(run: Runner, sb: string, stop: SbStop, outcome: 'resumed' | 'cancelled'): Promise<boolean> {
  const r = await run(sb, ['--json', 'recovery', 'finish', stop.event, outcome], 10_000);
  return r.code === 0;
}

/** The arguments the agent CLI gets to continue the session. */
export function resumeArgs(stop: SbStop): string[] {
  return stop.provider === 'codex' ? ['resume', stop.session, RESUME_BRIEF] : ['--resume', stop.session, RESUME_BRIEF];
}

/** FD-84: where the stopped session's transcript is in the person's own home, or null. Only a session found there is
 *  continued here: that is the home a plain `claude` or `codex` in its folder reads. */
export function transcriptOf(stop: SbStop, home: string): string | null {
  const name = stop.provider === 'codex' ? null : `${stop.session}.jsonl`;
  if (name) {
    const root = path.join(home, '.claude', 'projects');
    let dirs: string[] = [];
    try { dirs = fs.readdirSync(root); } catch { return null; }
    for (const d of dirs) {
      const file = path.join(root, d, name);
      if (fs.existsSync(file)) return file;
    }
    return null;
  }
  // Codex keeps sessions under ~/.codex/sessions/<yyyy>/<mm>/<dd>/rollout-<time>-<id>.jsonl.
  const walk = (dir: string, depth: number): string | null => {
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name.endsWith(`${stop.session}.jsonl`)) return full;
      if (e.isDirectory() && depth > 0) { const hit = walk(full, depth - 1); if (hit) return hit; }
    }
    return null;
  };
  return walk(path.join(home, '.codex', 'sessions'), 3);
}

/** The console key a continued session gets when no agent's console owns its folder: `handover.rs-<12 hex>`. */
export const resumeOwnKey = (stop: SbStop) => `handover.rs-${crypto.createHash('sha256').update(stop.event).digest('hex').slice(0, 12)}`;

/** What is alive now: the folders a claude or codex process works in, and every process's arguments. */
export interface Live { dirs: string[]; args: string }

/** Reads the live agent processes. Null when it cannot be read: then nothing is resumed (unknown is not "none"). */
export async function liveAgents(run: Runner, platform: NodeJS.Platform = process.platform): Promise<Live | null> {
  if (platform === 'win32') return null;
  const [cwd, ps] = await Promise.all([
    run('lsof', ['-a', '-d', 'cwd', '-c', 'claude', '-c', 'codex', '-Fn'], 10_000),
    run('ps', ['-axo', 'args='], 10_000),
  ]);
  // lsof exits 1 when no process matched, and also when some process could not be read while others were listed:
  // both are an answer. Anything else (not installed, timed out) is unknown.
  if ((cwd.code !== 0 && cwd.code !== 1) || ps.code !== 0) return null;
  return { dirs: cwd.stdout.split('\n').filter((l) => l.startsWith('n/')).map((l) => l.slice(1)), args: ps.stdout };
}

const real = (p: string) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };

/** Whether something may still be writing this session: its folder has a live agent, or a process names its id. */
export function sessionOpen(stop: SbStop, live: Live): boolean {
  if (live.args.includes(stop.session)) return true;
  const dir = real(stop.dir);
  return live.dirs.some((d) => real(d) === dir);
}

export function verdictOf(stop: SbStop, live: Live | null, now: number, exists: (dir: string) => boolean, transcript: (stop: SbStop) => string | null = () => 'unchecked'): StopVerdict {
  if (stop.state === 'claimed') return 'claimed';
  if (stop.kind === 'billing') return 'billing';
  if (!stop.ready || !stop.candidates.length) return 'waiting';
  if (!exists(stop.dir)) return 'no-folder';
  if (!transcript(stop)) return 'no-transcript';
  if (!live || sessionOpen(stop, live)) return 'open';
  if (now - stop.stoppedAt > RESUME_MAX_AGE_MS) return 'old';
  return 'resume';
}

// #endregion limit-recovery
