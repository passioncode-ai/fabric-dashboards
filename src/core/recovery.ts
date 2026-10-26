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
  /** `waiting` or `claimed`, as Switchboard keeps it; a finished stop (`resumed`, `cancelled`) is never parsed (R1-S2). */
  state: string;
  stoppedAt: number;
  attempt: number;
  /** When Switchboard will probe it (its `probe_at`, SB-115), in ms; null when it names none (R1-S3). */
  probeAt: number | null;
  /** V-1 of FIX-2: the account the session stopped on (recovery.rs `Wait.account`), an id; null when absent. */
  account: string | null;
  /** FD-118 (Switchboard 0.6.83, SB-205): why a waiting stop is not ready; null when it names none or one this app
   *  does not know. Read only from Switchboard, never inferred. */
  waitReason: WaitReason | null;
}

export type WaitReason = 'billing' | 'account_removed' | 'no_account' | 'backoff';
const WAIT_REASONS: readonly string[] = ['billing', 'account_removed', 'no_account', 'backoff'];

/** The stop states that are still open in Switchboard; `resumed` and `cancelled` are finished and listed nowhere. */
const OPEN_STATES = new Set(['waiting', 'claimed']);

export type SbRecovery = { stops: SbStop[] } | { unavailable: 'old' | 'error'; detail: string };

/** A stop older than this is left for the person: its task may be finished or moved on (decision 2026-10-21). */
export const RESUME_MAX_AGE_MS = 24 * 60 * 60_000;
/** At most this many sessions start in one pass, so a reset never opens every console at once. */
export const RESUMES_PER_PASS = 2;
/** What the continued session is told: one line, the same for every agent. */
export const RESUME_BRIEF = 'The usage limit has reset. Continue your task from where it stopped.';
/** FD-84: how long a continued session has to prove it continues: still running AND its own transcript written to
 *  (the brief is the first thing it appends). Alive but silent, or gone, by then is recorded as cancelled. */
export const RESUME_SETTLE_MS = 30_000;

/** The transcript's last write, or null when it cannot be read. */
export function writtenAt(file: string): number | null {
  try { return fs.statSync(file).mtimeMs; } catch { return null; }
}

/** `switchboard --json recovery` answered in 12 to 15 s in 2 of 5 reads on 2026-10-22 (its own probes), so the read
 *  and the claim get 30 s; they run on the background tick, never in front of the person. */
export const RECOVERY_DEADLINE_MS = 30_000;

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

/** Every open stop (waiting or claimed), as Switchboard reports it; a malformed row is skipped, never guessed at, and a
 *  finished one (resumed, cancelled) is not a stop any more: one place decides it for the Sessions list and MCP `audit`. */
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
    const state = typeof s.state === 'string' ? s.state.slice(0, 32) : 'waiting';
    if (!OPEN_STATES.has(state)) continue;
    const stopped = typeof s.stopped_at === 'number' && Number.isFinite(s.stopped_at) ? s.stopped_at * 1000 : 0;
    out.push({
      event, session, dir: directory, provider,
      candidates: Array.isArray(row.candidates) ? (row.candidates as unknown[]).filter((c): c is string => typeof c === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(c)) : [],
      ready: row.ready === true,
      kind: s.kind === 'billing' ? 'billing' : 'limit',
      state,
      stoppedAt: stopped,
      attempt: typeof s.attempt === 'number' ? s.attempt : 1,
      probeAt: typeof row.probe_at === 'number' && Number.isFinite(row.probe_at) ? row.probe_at * 1000 : null,
      account: typeof s.account === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(s.account) ? s.account : null,
      waitReason: typeof row.reason === 'string' && WAIT_REASONS.includes(row.reason) ? row.reason as WaitReason : null,
    });
  }
  return out;
}

export async function recoveryOf(run: Runner, sb: string): Promise<SbRecovery> {
  const r = await run(sb, ['--json', 'recovery'], RECOVERY_DEADLINE_MS);
  const stops = r.code === 0 ? parseRecovery(r.stdout) : null;
  return stops ? { stops } : failure(r);
}

/** Claims a ready stop once on one of its candidates. Switchboard persists the claim before it answers. */
export async function claimStop(run: Runner, sb: string, stop: SbStop, account: string): Promise<{ ok: true } | { ok: false; detail: string }> {
  const r = await run(sb, ['--json', 'recovery', 'claim', '--account', account, stop.event], RECOVERY_DEADLINE_MS);
  return r.code === 0 && parseData(r.stdout) ? { ok: true } : { ok: false, detail: failure(r).detail };
}

/** Records what the host saw: `resumed` once the session runs again, `cancelled` when it could not start. */
export async function finishStop(run: Runner, sb: string, stop: SbStop, outcome: 'resumed' | 'cancelled'): Promise<boolean> {
  const r = await run(sb, ['--json', 'recovery', 'finish', stop.event, outcome], RECOVERY_DEADLINE_MS);
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
    // The folder Claude Code names after the session's directory first: one stat instead of a scan of every project.
    // (A caller that knows only the session id passes no folder: then only the scan.)
    const own = typeof stop.dir === 'string' && stop.dir ? path.join(root, stop.dir.replace(/[^A-Za-z0-9]/g, '-'), name) : null;
    if (own && fs.existsSync(own)) return own;
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

/** FD-103: the one Claude Code transcript of `folder` in the person's home written while a session ran (between `from`
 *  and a minute after `to`), as its session id; null when there is none or more than one (two sessions in one folder:
 *  never guessed at). Lets Continue resume a hand-over whose session id Switchboard does not report. `quietAfter`
 *  (R1-U4): a transcript written after it may belong to a session that still runs, so it is never taken. */
export function transcriptIn(folder: string, home: string, from: number | null, to: number, quietAfter: number | null = null): string | null {
  const dir = path.join(home, '.claude', 'projects', folder.replace(/[^A-Za-z0-9]/g, '-'));
  let names: string[] = [];
  try { names = fs.readdirSync(dir); } catch { return null; }
  const hits = names.filter((n) => SESSION.test(n.replace(/\.jsonl$/, '')) && n.endsWith('.jsonl')).filter((n) => {
    const at = writtenAt(path.join(dir, n));
    return at !== null && (from === null || at >= from) && at <= to + 60_000 && (quietAfter === null || at <= quietAfter);
  });
  return hits.length === 1 ? hits[0]!.replace(/\.jsonl$/, '') : null;
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

/** FIX-5 (operator 2026-10-25, «сессии ... продолжили работать», «это баг»): how much of a transcript's end is read to
 *  learn whether its session answered after a stop. A session waiting on a limit writes nothing, so its last lines are
 *  the stop itself; one that went on has its newest replies there. */
export const CONTINUED_TAIL_BYTES = 512 * 1024;

const continuedSeen = new Map<string, boolean>();

/** A reply the model gave, as the CLI records it: Claude Code's `assistant` entry that is neither an API error (the limit
 *  message itself is one) nor a line the CLI made up without a call (`<synthetic>`); Codex's assistant message. */
function isReply(e: Record<string, unknown>, provider: SbStop['provider']): boolean {
  const msg = (e.message ?? null) as Record<string, unknown> | null;
  const payload = (e.payload ?? null) as Record<string, unknown> | null;
  if (provider === 'codex') return e.type === 'response_item' && !!payload && (payload.type === 'agent_message' || (payload.type === 'message' && payload.role === 'assistant'));
  return e.type === 'assistant' && e.isApiErrorMessage !== true && !e.error && msg?.model !== '<synthetic>';
}

/** FIX-5: whether the session answered after `stoppedAt`: its transcript has a model reply recorded later than the stop.
 *  It went on by itself (Switchboard moved its managed traffic to another account, the CLI continued at the reset, or
 *  the person sent it again), so nothing waits and nothing may continue it again. Reads only each line's type, time and
 *  error flag, never its text; null when the transcript cannot be read (then nothing is concluded). */
export function continuedAfter(file: string | null, provider: SbStop['provider'], stoppedAt: number): boolean | null {
  if (!file || !(stoppedAt > 0)) return null;
  let st: fs.Stats;
  try { st = fs.statSync(file); } catch { return null; }
  if (st.mtimeMs <= stoppedAt) return false; // nothing written since the stop
  const seen = `${file}\0${st.size}\0${st.mtimeMs}\0${stoppedAt}`;
  const known = continuedSeen.get(seen);
  if (known !== undefined) return known;
  let text: string;
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const length = Math.min(st.size, CONTINUED_TAIL_BYTES);
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, st.size - length);
      text = buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return null; }
  const lines = text.split('\n');
  if (st.size > CONTINUED_TAIL_BYTES) lines.shift(); // the first line read is cut
  let answered = false;
  for (let k = lines.length - 1; k >= 0 && !answered; k--) {
    const line = lines[k]!;
    if (!line.trim()) continue;
    let e: Record<string, unknown>;
    try { e = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
    const at = typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : NaN;
    if (at > stoppedAt && isReply(e, provider)) answered = true;
  }
  if (continuedSeen.size > 512) continuedSeen.clear();
  continuedSeen.set(seen, answered);
  return answered;
}

/** FIX-5: the stops whose session went on: a later stop of the same session replaces an earlier one, and a session that
 *  answered after its stop is not stopped. Read only for stops of the last day (an older one is neither listed nor
 *  continued here), so one pass reads a handful of transcript ends. */
export function continuedOf(stops: readonly SbStop[], home: string, now: number): (stop: SbStop) => boolean {
  const newest = new Map<string, number>();
  for (const s of stops) newest.set(s.session, Math.max(newest.get(s.session) ?? 0, s.stoppedAt));
  return (s) => {
    if ((newest.get(s.session) ?? 0) > s.stoppedAt) return true;
    if (!(now - s.stoppedAt <= RESUME_MAX_AGE_MS)) return false;
    return continuedAfter(transcriptOf(s, home), s.provider, s.stoppedAt) === true;
  };
}

export function verdictOf(stop: SbStop, live: Live | null, now: number, exists: (dir: string) => boolean, transcript: (stop: SbStop) => string | null = () => 'unchecked', continued: (stop: SbStop) => boolean = () => false): StopVerdict {
  if (stop.state === 'claimed') return 'claimed';
  if (continued(stop)) return 'continued';
  if (stop.kind === 'billing') return 'billing';
  if (!stop.ready || !stop.candidates.length) return 'waiting';
  if (!exists(stop.dir)) return 'no-folder';
  if (!transcript(stop)) return 'no-transcript';
  if (!live || sessionOpen(stop, live)) return 'open';
  if (now - stop.stoppedAt > RESUME_MAX_AGE_MS) return 'old';
  return 'resume';
}

// #endregion limit-recovery
