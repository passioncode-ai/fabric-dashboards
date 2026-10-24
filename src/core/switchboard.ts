// #region switchboard-binding — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
// ADR-0017: which account a console session runs on. Fabric Switchboard owns the answer: a folder
// in one of its projects (or under a managed rule) must run on that project's account, never on the
// ordinary sign-in. Read-only queries only (`project show`, `accounts list`, `launch --help`); the
// session itself is started by Switchboard, in the console once it can launch in place (SB-75),
// otherwise in Terminal. No token ever passes through this app.
import type { Runner } from '@passioncode-ai/fabric-service-host';
import path from 'node:path';
import fs from 'node:fs';
import type { RuntimeSpec } from './runtimes';
import type { SbSessionRecord, SourceResult } from './sessions';

export type Binding =
  | { kind: 'none' } // no project or managed rule for this provider: the ordinary sign-in
  | { kind: 'project'; name: string; pool: string }
  | { kind: 'error'; detail: string }; // Switchboard did not answer: never start on a guess

/** The Switchboard CLI in `dirs`, or null when it is not installed. */
export function findSwitchboard(dirs: string[]): string | null {
  for (const d of dirs) {
    const file = path.join(d, 'switchboard');
    try { fs.accessSync(file, fs.constants.X_OK); if (fs.statSync(file).isFile()) return file; } catch { /* next */ }
  }
  return null;
}

function parse(stdout: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(stdout) as { ok?: boolean; data?: unknown };
    return v && v.ok === true && v.data && typeof v.data === 'object' ? (v.data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** What Switchboard binds `folder` to for `provider`. A runtime Switchboard holds no account for is never bound. */
export async function bindingFor(run: Runner, sb: string, folder: string, provider: RuntimeSpec['provider']): Promise<Binding> {
  if (!provider) return { kind: 'none' };
  const r = await run(sb, ['--json', 'project', 'show', '--path', folder], 10_000);
  const data = r.code === 0 ? parse(r.stdout) : null;
  if (!data) return { kind: 'error', detail: (r.stderr || r.stdout).trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}` };
  const project = data.project as { name?: unknown; pool?: unknown } | null;
  if (project && typeof project.name === 'string' && typeof project.pool === 'string') return { kind: 'project', name: project.name, pool: project.pool };
  // A folder rule whose effective target is a managed session also routes through Switchboard, in
  // the pool of the account it names (review R-2); a rule that names no account is not guessed at.
  const rules = Array.isArray(data.rules) ? (data.rules as { provider?: string; effective?: { target?: string; enabled?: boolean; account?: unknown } | null }[]) : [];
  const rule = rules.find((x) => x.provider === provider)?.effective;
  if (rule && rule.target === 'managed' && rule.enabled !== false) {
    const pool = (rule.account as { pool?: unknown } | null | undefined)?.pool;
    if (typeof pool !== 'string' || !pool) return { kind: 'error', detail: 'a managed Switchboard rule for this folder names no account' };
    return { kind: 'project', name: path.basename(folder), pool };
  }
  return { kind: 'none' };
}

/** Whether this Switchboard can run a prepared session in the caller's terminal (SB-75). */
export async function canLaunchInPlace(run: Runner, sb: string): Promise<boolean> {
  const r = await run(sb, ['launch', '--help'], 10_000);
  const text = `${r.stdout}\n${r.stderr}`;
  return r.code === 0 && /--in-place\b/.test(text) && /--provider\b/.test(text);
}

/** The command the console runs for a bound folder once Switchboard launches in place. */
export function inPlaceArgv(sb: string, provider: 'claude' | 'codex', folder: string, runtimeArgs: string[]): string[] {
  return [sb, 'launch', '--provider', provider, '--mode', 'managed', '--working-directory', folder, '--in-place', ...(runtimeArgs.length ? ['--', ...runtimeArgs] : [])];
}

/** Until SB-75: the account Switchboard selects in the pool, for its existing Terminal launch. */
export async function terminalLaunchArgv(run: Runner, sb: string, provider: 'claude' | 'codex', pool: string, folder: string): Promise<{ argv: string[] } | { error: string }> {
  const r = await run(sb, ['--json', 'accounts', 'list'], 10_000);
  const data = r.code === 0 ? parse(r.stdout) : null;
  const account = (data?.routes as Record<string, unknown> | undefined)?.[`${provider}:${pool}`];
  if (typeof account !== 'string' || !/^[0-9a-f-]{8,64}$/i.test(account)) {
    return { error: data ? `Switchboard selects no ${provider} account in pool ${pool}` : ((r.stderr || r.stdout).trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}`) };
  }
  return { argv: [sb, 'launch', account, '--mode', 'managed', '--working-directory', folder] };
}
// #endregion switchboard-binding

// #region switchboard-sessions — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
/** Switchboard's accounts as the console needs them: which account each `<provider>:<pool>` route
 *  selects now, and each account's label. Never a credential (`accounts list` carries none). */
export interface SbAccounts { routes: Record<string, string>; labels: Record<string, string> }

export async function accountsOf(run: Runner, sb: string): Promise<SbAccounts | null> {
  const r = await run(sb, ['--json', 'accounts', 'list'], 10_000);
  const data = r.code === 0 ? parse(r.stdout) : null;
  if (!data) return null;
  const routes: Record<string, string> = {};
  for (const [k, v] of Object.entries((data.routes ?? {}) as Record<string, unknown>)) if (typeof v === 'string') routes[k] = v;
  const labels: Record<string, string> = {};
  for (const a of Array.isArray(data.accounts) ? (data.accounts as { id?: unknown; label?: unknown }[]) : []) {
    if (typeof a.id === 'string') labels[a.id] = typeof a.label === 'string' && a.label ? a.label : a.id;
  }
  return { routes, labels };
}

/** FD-51 (LC-20): Switchboard can run this provider's sessions in managed mode — it has a route for it. */
export function managesProvider(accounts: SbAccounts | null, provider: RuntimeSpec['provider']): boolean {
  return Boolean(provider && accounts && Object.keys(accounts.routes).some((k) => k.startsWith(`${provider}:`)));
}

/** One session Switchboard launched in a folder (FD-43, SB-95), with where it runs now (FD-51). */
export interface SbSession {
  state: 'starting' | 'running' | 'ended' | 'unknown';
  label: string;
  mode: string;
  provider: string;
  /** Milliseconds since the epoch, or null. */
  launchedAt: number | null;
  /** SB-98: a managed session follows its pool's selected account; when that is no longer the one it
   *  was launched on, Switchboard moved it — to this account's label. */
  movedTo: string | null;
}

export type SbSessions = { sessions: SbSession[] } | { unavailable: 'old' | 'error'; detail: string };

const ms = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? (v < 1e12 ? v * 1000 : v) : null);
const samePath = (a: string, b: string) => {
  const real = (p: string) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
  return real(a) === real(b);
};

/** The sessions Switchboard launched in `folder`, newest first. A Switchboard without `sessions` (before
 *  SB-95) says so rather than showing nothing as if nothing ran. */
export async function sessionsIn(run: Runner, sb: string, folder: string, accounts: SbAccounts | null): Promise<SbSessions> {
  const r = await run(sb, ['--json', 'sessions'], 10_000);
  const text = `${r.stdout}\n${r.stderr}`;
  const data = r.code === 0 ? parse(r.stdout) : null;
  if (!data) {
    const old = /unrecognized subcommand|unexpected argument|invalid value.*sessions/i.test(text);
    return { unavailable: old ? 'old' : 'error', detail: text.trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}` };
  }
  const list = Array.isArray(data.sessions) ? (data.sessions as Record<string, unknown>[]) : [];
  const sessions: SbSession[] = [];
  for (const x of list) {
    if (typeof x.working_directory !== 'string' || !samePath(x.working_directory, folder)) continue;
    const provider = typeof x.provider === 'string' ? x.provider : '';
    const pool = typeof x.pool === 'string' ? x.pool : 'default';
    const accountId = typeof x.account_id === 'string' ? x.account_id : '';
    const now = accounts?.routes[`${provider}:${pool}`];
    const state = x.state === 'starting' || x.state === 'running' || x.state === 'ended' ? x.state : 'unknown';
    sessions.push({
      state, mode: typeof x.mode === 'string' ? x.mode : '', provider,
      label: typeof x.label === 'string' && x.label ? x.label : accounts?.labels[accountId] ?? accountId,
      launchedAt: ms(x.launched_at),
      movedTo: x.mode === 'managed' && now && accountId && now !== accountId ? accounts?.labels[now] ?? now : null,
    });
  }
  sessions.sort((a, b) => (b.launchedAt ?? 0) - (a.launchedAt ?? 0));
  return { sessions };
}

/** FD-103: every session Switchboard launched on this Mac, ended ones included (`sessions --all`), for the Sessions
 *  list. Read on the hand-overs' tick, never in front of the person; a malformed record is skipped. A Switchboard
 *  without `--all` (before SB-95) answers `old`; any other failure `error`, which the list shows as a degraded source. */
export async function allSessionsOf(run: Runner, sb: string): Promise<SourceResult<SbSessionRecord[]>> {
  const r = await run(sb, ['--json', 'sessions', '--all'], 10_000);
  const text = `${r.stdout}\n${r.stderr}`;
  const data = r.code === 0 ? parse(r.stdout) : null;
  if (!data) {
    const old = /unrecognized subcommand|unexpected argument|earlier version than this command/i.test(text);
    return { ok: false, reason: old ? 'old' : 'error', detail: text.trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}` };
  }
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
  const out: SbSessionRecord[] = [];
  for (const x of Array.isArray(data.sessions) ? (data.sessions as Record<string, unknown>[]) : []) {
    if (!x || typeof x !== 'object' || typeof x.working_directory !== 'string' || !path.isAbsolute(x.working_directory)) continue;
    const state = x.state === 'starting' || x.state === 'running' || x.state === 'ended' ? x.state : 'unknown';
    out.push({
      home: str(x.home, 400), folder: x.working_directory, provider: str(x.provider, 32), pool: str(x.pool, 64) || 'default', mode: str(x.mode, 32),
      account: str(x.label) || str(x.account_id, 64), accountId: str(x.account_id, 64),
      context: typeof x.context === 'string' ? x.context.slice(0, 120) : null, contextName: typeof x.context_name === 'string' ? x.context_name.slice(0, 120) : null,
      continues: typeof x.continues === 'string' && x.continues ? x.continues.slice(0, 64) : null, inPlace: x.in_place === true,
      launchedAt: ms(x.launched_at), startedAt: ms(x.started_at), state,
    });
  }
  return { ok: true, value: out };
}
// #endregion switchboard-sessions

// #region switchboard-handovers — docs: docs/ux/scenarios.md#scn-069-a-hand-over-opens-in-the-console
/** FD-62 (SB-108): a session Switchboard prepared and left for a console to take instead of opening Terminal.
 *  Ids, a label and folders only: the record never holds a token or the prompt (Switchboard's contract). */
export interface SbHandover {
  id: string;
  workflow: string;
  /** Switchboard's catalog id of the agent that continues it (`claude-code`, `codex`, …). */
  agent: string;
  account: string;
  /** The workflow's checkout the session runs in. */
  dir: string;
  /** Milliseconds since the epoch; past it, Switchboard no longer offers it. */
  offeredUntil: number;
}

export type SbHandovers = { enabled: boolean; handovers: SbHandover[] } | { unavailable: 'old' | 'error'; detail: string };

const HANDOVER_ID = /^ho-[0-9a-f]{12}$/;

/** The hand-overs waiting for a console, oldest first. A Switchboard without them (before SB-108, or a running
 *  app older than its CLI) says so; a malformed record is skipped, never guessed at. */
export async function handoversOf(run: Runner, sb: string): Promise<SbHandovers> {
  const r = await run(sb, ['--json', 'handovers'], 10_000);
  const text = `${r.stdout}\n${r.stderr}`;
  const data = r.code === 0 ? parse(r.stdout) : null;
  if (!data) {
    const old = /unrecognized subcommand|unexpected argument|earlier version than this command/i.test(text);
    let detail = text.trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}`;
    try { const e = JSON.parse(r.stdout) as { error?: unknown }; if (typeof e.error === 'string') detail = e.error.slice(0, 300); } catch { /* plain text */ }
    return { unavailable: old ? 'old' : 'error', detail };
  }
  const handovers: SbHandover[] = [];
  for (const x of Array.isArray(data.handovers) ? (data.handovers as Record<string, unknown>[]) : []) {
    const until = typeof x.offered_until === 'string' ? Date.parse(x.offered_until) : Number.NaN;
    if (typeof x.id !== 'string' || !HANDOVER_ID.test(x.id) || typeof x.dir !== 'string' || !path.isAbsolute(x.dir) || !Number.isFinite(until)) continue;
    handovers.push({
      id: x.id, dir: x.dir, offeredUntil: until,
      workflow: typeof x.workflow === 'string' ? x.workflow.slice(0, 200) : '',
      agent: typeof x.agent === 'string' ? x.agent.slice(0, 64) : '',
      account: typeof x.account_label === 'string' ? x.account_label.slice(0, 200) : '',
    });
  }
  return { enabled: data.enabled === true, handovers };
}

/** The console key of a hand-over's own console (like Setup's): `handover.<id>`. */
export const handoverOwnKey = (id: string) => `handover.${id}`;
/** FD-83: a session continued after a limit takes a console of its own the same way (`handover.rs-<12 hex>`); FD-103:
 *  so does a session continued from the Sessions list in a folder no agent's console owns (`handover.cs-<12 hex>`). */
export const isHandoverKey = (key: string) => /^handover\.(ho|rs|cs)-[0-9a-f]{12}$/.test(key);

/** The command a console runs to take the hand-over: Switchboard takes it once and runs its session here. */
export function handoverRunArgv(sb: string, id: string): string[] {
  return [sb, 'handovers', 'run', id];
}

/** FD-103: Switchboard's own switch for handing sessions over to a console, set through its CLI (`handovers set on|off`);
 *  this app never writes Switchboard's files. It is read with the hand-overs (`enabled`). */
export async function handoversSwitch(run: Runner, sb: string, on: boolean): Promise<{ ok: true } | { ok: false; detail: string }> {
  const r = await run(sb, ['handovers', 'set', on ? 'on' : 'off'], 10_000);
  return r.code === 0 ? { ok: true } : { ok: false, detail: `${r.stderr}\n${r.stdout}`.trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}` };
}
// #endregion switchboard-handovers
