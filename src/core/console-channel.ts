// #region console-channel — docs: docs/adr/0025-the-console-channel.md#decision
// ADR-0025 (FD-120, fabric-workspace MD-12): the one way into the running app, for its own MCP server only: a per-user
// Unix socket (a first-instance named pipe on Windows) and a key rewritten at every start. Two operations start a
// console session or a fix in one, through the same code as the buttons. This module is the part both ends share and
// tests read without a socket: the places, the key, the request's shape and the limits.
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

export const CHANNEL_MAX_BYTES = 64 * 1024;
export const CHANNEL_READ_MS = 5_000;
export const CHANNEL_PER_MINUTE = 10;
export const CHANNEL_KEY_FILE = 'console.key';
export const CHANNEL_SOCKET_FILE = 'console.sock';
export const CHANNEL_TASK_MAX = 16 * 1024;

export type ChannelOp = 'console.new' | 'console.fix';
export interface ChannelRequest { key: string; op: ChannelOp; service: string; task?: { kind: 'fix' | 'audit'; output: string } }
export type ChannelAnswer = { ok: true; consoleKey: string } | { ok: false; code: string; detail?: string };

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
  for (const k of Object.keys(r)) if (!['key', 'op', 'service', 'task'].includes(k)) return { ok: false, code: 'unknown-field' };
  if (r.op !== 'console.new' && r.op !== 'console.fix') return { ok: false, code: 'unknown-op' };
  if (typeof r.service !== 'string' || !SERVICE_KEY.test(r.service)) return { ok: false, code: 'bad-service' };
  if (r.op === 'console.fix') {
    const t = r.task as Record<string, unknown> | undefined;
    if (!t || typeof t !== 'object' || (t.kind !== 'fix' && t.kind !== 'audit') || typeof t.output !== 'string' || t.output.length > CHANNEL_TASK_MAX) return { ok: false, code: 'bad-task' };
    return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: r.service, task: { kind: t.kind, output: t.output } } };
  }
  if (r.task !== undefined) return { ok: false, code: 'bad-task' };
  return { ok: true, request: { key: String(r.key ?? ''), op: r.op, service: r.service } };
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
