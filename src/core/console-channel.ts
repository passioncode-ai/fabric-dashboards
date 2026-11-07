// #region console-channel — docs: docs/adr/0025-the-console-channel.md#decision
// ADR-0025 (FD-120, fabric-workspace MD-12): the one way into the running app, for its own MCP server only: a per-user
// Unix socket (a first-instance named pipe on Windows) and a key rewritten at every start. Two operations start a
// console session or a fix in one, through the same code as the buttons; FD-166 adds one read, the consoles open now
// (Fabric's CO-457: one screen of sessions). This module is the part both ends share and tests read without a socket:
// the places, the key, the request's shape and the limits.
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { SessionRow } from './sessions';

export const CHANNEL_MAX_BYTES = 64 * 1024;
export const CHANNEL_READ_MS = 5_000;
export const CHANNEL_PER_MINUTE = 10;
/** FD-166: reads of the open consoles, apart from starts: a screen polling every 15 s takes 4 a minute. */
export const CHANNEL_READS_PER_MINUTE = 30;
export const CHANNEL_KEY_FILE = 'console.key';
export const CHANNEL_SOCKET_FILE = 'console.sock';
export const CHANNEL_TASK_MAX = 16 * 1024;

export type ChannelOp = 'console.new' | 'console.fix' | 'console.list' | 'console.choose' | 'settings.update' | 'sessions.act' | 'app.update' | 'app.install';
const OPS: readonly string[] = ['console.new', 'console.fix', 'console.list', 'console.choose', 'settings.update', 'sessions.act', 'app.update', 'app.install'];
/** FD-175: what a session row's button does, and what the app's update buttons do. */
export type SessionAct = 'continue' | 'end' | 'dismiss' | 'clear-ended';
export interface ChannelRequest {
  key: string; op: ChannelOp; service: string; task?: { kind: 'fix' | 'audit'; output: string };
  /** FD-175, `settings.update`: a settings patch, checked again by the app against AGENT_SETTINGS. */
  patch?: Record<string, unknown>;
  /** FD-175, `sessions.act`: the button and its row (none for `clear-ended`), and Continue now's account. */
  session?: { act: SessionAct; row?: string; account?: string };
  /** FD-175, `app.update`: Check for updates, or Restart to update. */
  update?: 'check' | 'restart';
  /** FD-175, `console.choose`: the console's coding agent (a runtime id) and its folder (absolute), as the console's
   *  own pickers set them. At least one. */
  choice?: { runtime?: string; folder?: string };
  /** FD-175, `app.install`: Move to Applications, or Uninstall keeping settings and history (`uninstall`) or with them
   *  (`uninstall-all`), as the confirmation's box ticked. */
  install?: AppInstall;
}
export type AppInstall = 'move-to-applications' | 'uninstall' | 'uninstall-all';
/** FD-166: one console of this app that runs now, as the Sessions list joins it with Switchboard's record. Ids only:
 *  never what the console printed, its prompt or a path inside the agent's data. */
export interface OpenConsole {
  /** The Sessions row (`c:<console key>:<start>`, `sb:…`): what the session's link opens. */
  row: string;
  consoleKey: string;
  /** The agent whose console it is, or null for a console of its own (a hand-over, a session continued after a limit). */
  service: string | null;
  /** The coding agent that runs in it (`claude-code`, `codex`, or the runtime's name). */
  runtime: string;
  folder: string;
  /** Switchboard's `provider_session_id` for a launch it made or a resume; null when it named none. Never guessed. */
  sessionId: string | null;
  /** The runtime's own session id (Claude Code's `session_id`, its transcript's name), the id Fabric's hub records with
   *  `fabric_session_observe`; null when not known. */
  runtimeSessionId: string | null;
  /** When it started, ISO 8601. */
  since: string;
}
export type ChannelAnswer = { ok: true; consoleKey: string } | { ok: true; consoles: OpenConsole[] } | { ok: true; result: Record<string, unknown> } | { ok: false; code: string; detail?: string };

/** Where the channel listens: a socket in the app's data folder, or on Windows a pipe named for this user. */
export function channelAddress(userData: string, platform: NodeJS.Platform = process.platform, user = os.userInfo().username, home = os.homedir()): string {
  if (platform === 'win32') {
    // Named for the account (its name and profile, hashed), so two accounts on one machine never share one pipe.
    const who = crypto.createHash('sha256').update(`${user}\u0000${home}`).digest('hex').slice(0, 16);
    return `\\\\.\\pipe\\fabric-dashboards-console-${who}`;
  }
  return path.join(userData, CHANNEL_SOCKET_FILE);
}

export function newChannelKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Constant-time comparison of a request's key with this run's; a wrong length is a mismatch, never a throw. */
export function keyMatches(given: unknown, expected: string): boolean {
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const SERVICE_KEY = /^[a-z0-9][a-z0-9-]{0,62}\.[a-z0-9][a-z0-9-]{0,62}$/;

/** One request line, checked strictly; anything else is refused by its code. The key is checked by the caller. */
export function parseRequest(line: string): { ok: true; request: ChannelRequest } | { ok: false; code: string } {
  if (Buffer.byteLength(line) > CHANNEL_MAX_BYTES) return { ok: false, code: 'too-large' };
  let v: unknown;
  try { v = JSON.parse(line); } catch { return { ok: false, code: 'not-json' }; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, code: 'not-an-object' };
  const r = v as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!['key', 'op', 'service', 'task', 'patch', 'session', 'update', 'choice', 'install'].includes(k)) return { ok: false, code: 'unknown-field' };
  if (!OPS.includes(String(r.op))) return { ok: false, code: 'unknown-op' };
  // FD-175: the window's own buttons, each with only its own field.
  const only = (field: string) => Object.keys(r).every((k) => k === 'key' || k === 'op' || k === field);
  if (r.op === 'settings.update') {
    if (!only('patch') || !r.patch || typeof r.patch !== 'object' || Array.isArray(r.patch)) return { ok: false, code: 'bad-patch' };
    return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: '', patch: r.patch as Record<string, unknown> } };
  }
  if (r.op === 'sessions.act') {
    const s = r.session as Record<string, unknown> | undefined;
    if (!only('session') || !s || typeof s !== 'object') return { ok: false, code: 'bad-session' };
    const act = s.act;
    if (act !== 'continue' && act !== 'end' && act !== 'dismiss' && act !== 'clear-ended') return { ok: false, code: 'bad-session' };
    const row = s.row;
    if (act === 'clear-ended' ? row !== undefined : typeof row !== 'string' || row.length < 1 || row.length > 500) return { ok: false, code: 'bad-session' };
    const account = s.account;
    if (account !== undefined && (act !== 'continue' || typeof account !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(account))) return { ok: false, code: 'bad-session' };
    return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: '', session: { act, ...(typeof row === 'string' ? { row } : {}), ...(typeof account === 'string' ? { account } : {}) } } };
  }
  if (r.op === 'app.update') {
    if (!only('update') || (r.update !== 'check' && r.update !== 'restart')) return { ok: false, code: 'bad-update' };
    return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: '', update: r.update } };
  }
  if (r.op === 'app.install') {
    if (!only('install') || (r.install !== 'move-to-applications' && r.install !== 'uninstall' && r.install !== 'uninstall-all')) return { ok: false, code: 'bad-install' };
    return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: '', install: r.install } };
  }
  if (r.op === 'console.choose') {
    const c = r.choice as Record<string, unknown> | undefined;
    if (Object.keys(r).some((k) => !['key', 'op', 'service', 'choice'].includes(k))) return { ok: false, code: 'unknown-field' };
    if (typeof r.service !== 'string' || !SERVICE_KEY.test(r.service)) return { ok: false, code: 'bad-service' };
    if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).some((k) => k !== 'runtime' && k !== 'folder')) return { ok: false, code: 'bad-choice' };
    const runtime = c.runtime;
    const folder = c.folder;
    if (runtime === undefined && folder === undefined) return { ok: false, code: 'bad-choice' };
    if (runtime !== undefined && (typeof runtime !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(runtime))) return { ok: false, code: 'bad-choice' };
    // An absolute path, no NUL; whether it is a folder is the app's check.
    if (folder !== undefined && (typeof folder !== 'string' || folder.length > 4096 || folder.includes('\u0000') || !(folder.startsWith('/') || /^[A-Za-z]:[\\/]/.test(folder)))) return { ok: false, code: 'bad-choice' };
    return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: r.service, choice: { ...(typeof runtime === 'string' ? { runtime } : {}), ...(typeof folder === 'string' ? { folder } : {}) } } };
  }
  // A console operation carries none of the window's fields.
  if (r.patch !== undefined || r.session !== undefined || r.update !== undefined || r.choice !== undefined || r.install !== undefined) return { ok: false, code: 'unknown-field' };
  if (r.op === 'console.list') {
    // FD-166: a read names no service and carries no task.
    if (r.service !== undefined || r.task !== undefined) return { ok: false, code: 'unknown-field' };
    return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: '' } };
  }
  if (typeof r.service !== 'string' || !SERVICE_KEY.test(r.service)) return { ok: false, code: 'bad-service' };
  if (r.op === 'console.fix') {
    const t = r.task as Record<string, unknown> | undefined;
    if (!t || typeof t !== 'object' || (t.kind !== 'fix' && t.kind !== 'audit') || typeof t.output !== 'string' || t.output.length > CHANNEL_TASK_MAX) return { ok: false, code: 'bad-task' };
    return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: r.service, task: { kind: t.kind, output: t.output } } };
  }
  if (r.task !== undefined) return { ok: false, code: 'bad-task' };
  return { ok: true, request: { key: String(r.key ?? ''), op: r.op as ChannelOp, service: r.service } };
}

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AGENT_KEY = /^[a-z0-9][a-z0-9-]{0,62}\.[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * FD-166: the running consoles of the Sessions list, as the channel hands them out. `resumed` is the session id a console
 * continues (a resume after a limit, or Continue), which the console host knows itself. A session id is taken only from
 * Switchboard's record or that resume; the runtime's own id is the same id, or its transcript's name; nothing else is
 * guessed.
 */
export function openConsolesOf(rows: readonly SessionRow[], resumed: (consoleKey: string) => string | null): OpenConsole[] {
  const out: OpenConsole[] = [];
  for (const r of rows) {
    if (r.group !== 'running' || !r.key) continue;
    const own = r.launch?.providerSessionId ?? null;
    const back = resumed(r.key);
    const fromTranscript = r.launch?.transcript ? path.basename(r.launch.transcript).replace(/\.jsonl$/, '') : '';
    const runtimeSessionId = own ?? (back && SESSION_ID.test(back) ? back.toLowerCase() : null) ?? (SESSION_ID.test(fromTranscript) ? fromTranscript.toLowerCase() : null);
    out.push({
      row: r.id, consoleKey: r.key, service: AGENT_KEY.test(r.key) && !r.key.startsWith('handover.') ? r.key : null, runtime: r.agent, folder: r.folder, // `handover.<id>`: a console of its own
      sessionId: own, runtimeSessionId, since: new Date(r.startedAt ?? r.at).toISOString(),
    });
  }
  return out;
}

/** At most `limit` requests in any minute; a request past it is refused `busy`. */
export class RateLimit {
  private stamps: number[] = [];
  constructor(private readonly limit = CHANNEL_PER_MINUTE, private readonly windowMs = 60_000) {}
  take(now: number): boolean {
    this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(now);
    return true;
  }
}
// #endregion console-channel
