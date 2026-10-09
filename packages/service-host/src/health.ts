// #region health-probe — docs: packages/service-host/README.md#health
// One look at a service's health: the well-known document on its own origin. A local service
// answers it without a token on loopback; a remote one (DEC-0019) only over verified https and
// only to the bearer of its token — a host passes the token's header in `options.headers`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { expand, portOf, remoteOriginProblem } from './descriptor';
import { PROTOCOL, type WellKnown, type WellKnownResult } from './protocol';

export interface HttpResult { status: number; body: string; ms: number }

const MAX_BODY = 2 * 1024 * 1024;

export interface TlsOptions {
  /** Trust this CA bundle instead of the system store — tests only. */
  ca?: string | Buffer;
  /** Dial this host:port while speaking TLS to the origin's name — tests only. */
  connect?: { host: string; port: number };
}

/** Remote placements get several seconds; a missed probe is still not an outage (ADR-0008). */
export const REMOTE_TIMEOUT_MS = 8000;

/**
 * One request to a service origin, answer capped at 2 MB. A loopback origin goes over http to
 * 127.0.0.1; an https origin (DEC-0019) over TLS with the certificate verified against the system
 * store. Neither follows a redirect: Node's core clients never do, and a 3xx comes back as a status.
 */
export function request(origin: string, method: 'GET' | 'POST', path: string, headers: Record<string, string> = {}, timeoutMs = 3000, tls: TlsOptions = {}): Promise<HttpResult> {
  const port = portOf(origin);
  const remote = port === null && remoteOriginProblem(origin) === null;
  if (port === null && !remote) return Promise.reject(new Error(`origin ${origin} is not http://127.0.0.1:<port>, nor a remote https origin`));
  const started = Date.now();
  const target = remote ? new URL(origin) : null;
  const options = remote
    ? {
      host: tls.connect?.host ?? target!.hostname, port: tls.connect?.port ?? (Number(target!.port) || 443), servername: target!.hostname,
      method, path, headers: { Host: target!.host, Accept: 'application/json', ...headers }, timeout: timeoutMs,
      ...(tls.ca ? { ca: tls.ca } : {}), rejectUnauthorized: true,
    }
    : { host: '127.0.0.1', port: port!, method, path, headers: { Host: `127.0.0.1:${port}`, Accept: 'application/json', ...headers }, timeout: timeoutMs };
  return new Promise((resolve, reject) => {
    const client = remote ? https : http;
    // `timeout` above is only the socket's idle time: a service that trickles a byte now and then
    // would hold the probe — and a host's monitor awaiting it — for ever. This deadline is the whole
    // request, answer included (audit 2026-10-07, MEDIUM-4).
    const deadline = setTimeout(() => req.destroy(new Error(`no answer within ${timeoutMs} ms`)), timeoutMs);
    const done = <T>(fn: (v: T) => void) => (v: T) => { clearTimeout(deadline); fn(v); };
    resolve = done(resolve);
    reject = done(reject);
    const req = client.request(options, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) { req.destroy(new Error('response larger than 2 MB')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), ms: Date.now() - started }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`no answer within ${timeoutMs} ms`)));
    req.on('error', reject);
    req.end();
  });
}

/** The first thing that makes this not a `fabric-service/0.1` well-known document, or null. */
export function checkWellKnown(value: unknown): string | null {
  const d = value as Partial<WellKnown> | null;
  if (!d || typeof d !== 'object') return 'the answer is not a JSON object';
  if (d.protocol !== PROTOCOL) return `protocol is ${JSON.stringify(d.protocol)}`;
  if (!d.service || typeof d.service.id !== 'string' || typeof d.service.instance !== 'string') return 'service identity is missing';
  if (!d.process || typeof d.process.pid !== 'number') return 'process.pid is missing';
  if (!['starting', 'ready', 'degraded', 'stopping'].includes(String(d.status))) return `status ${JSON.stringify(d.status)} is not a protocol status`;
  if (!Array.isArray(d.degraded)) return 'degraded is missing';
  if (!d.surfaces || !d.surfaces.events) return 'surfaces.events is missing';
  return null;
}

const TLS_CODES = /^(CERT_|ERR_TLS_|ERR_SSL_|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|UNABLE_TO_(GET|VERIFY)_|ERR_OSSL)/;

/** Why nothing usable came back: TLS, a timeout, or the network. */
function causeOf(error: unknown): 'tls' | 'timeout' | 'network' {
  const e = error as NodeJS.ErrnoException;
  if (e?.code && TLS_CODES.test(e.code)) return 'tls';
  if (/certificate|self[- ]signed|altname/i.test(String(e?.message))) return 'tls';
  if (/no answer within/.test(String(e?.message))) return 'timeout';
  return 'network';
}

export interface WellKnownOptions extends TlsOptions {
  /** The token header for a remote placement (DEC-0019); a local one needs none. */
  headers?: Record<string, string>;
}

/**
 * GET /.well-known/fabric-service. Never throws: silence is `no-answer` (with its cause for a
 * remote origin), a remote `401` is `refused`, a redirect is `no-answer` with cause `redirect`
 * (never followed), a remote 5xx is `no-answer` with cause `http` (a deploy or an outage, not
 * another program), anything else `not-protocol`.
 */
export async function fetchWellKnown(origin: string, timeoutMs = 2000, options: WellKnownOptions = {}): Promise<WellKnownResult> {
  let res: HttpResult;
  try {
    res = await request(origin, 'GET', '/.well-known/fabric-service', options.headers ?? {}, timeoutMs, options);
  } catch (error) {
    // A local result keeps its 0.1.0 shape; the cause is new with the remote placement.
    if (portOf(origin) !== null) return { kind: 'no-answer', detail: (error as Error).message };
    return { kind: 'no-answer', detail: (error as Error).message, cause: causeOf(error) };
  }
  if (res.status === 401 && portOf(origin) === null) return { kind: 'refused', detail: 'HTTP 401 on /.well-known/fabric-service' };
  if (portOf(origin) === null && res.status >= 300 && res.status < 400) return { kind: 'no-answer', detail: `HTTP ${res.status}: the service answered with a redirect, which a host does not follow`, cause: 'redirect' };
  if (portOf(origin) === null && res.status >= 500) return { kind: 'no-answer', detail: `HTTP ${res.status} on /.well-known/fabric-service`, cause: 'http' };
  if (res.status !== 200) return { kind: 'not-protocol', detail: `HTTP ${res.status} on /.well-known/fabric-service` };
  let doc: unknown;
  try {
    doc = JSON.parse(res.body);
  } catch {
    return { kind: 'not-protocol', detail: 'the answer is not JSON' };
  }
  const problem = checkWellKnown(doc);
  if (problem) return { kind: 'not-protocol', detail: problem };
  return { kind: 'answer', doc: doc as WellKnown, ms: res.ms };
}
// #endregion health-probe

/** What `readToken` needs to know about a token file, from `fs.lstatSync`. */
export interface TokenFileInfo { symlink: boolean; uid: number; mode: number }

/**
 * Why a token file must not be read, or null. POSIX: no symlink, owned by this user, mode 0600.
 * FD-37 — Windows has no POSIX owner or mode (`fs.stat` reads 0o666): the guard is the user
 * profile's ACL, so the file must not be a link and must sit inside the profile.
 */
export function tokenFileProblem(file: string, info: TokenFileInfo, o: { platform: NodeJS.Platform; uid: number | undefined; home: string }, label = file): string | null {
  if (info.symlink) return `the token file ${label} is a symlink`;
  if (o.platform === 'win32') {
    const norm = (p: string) => path.win32.resolve(p).toLowerCase();
    const home = norm(o.home);
    const root = home.endsWith('\\') ? home : `${home}\\`;
    return norm(file).startsWith(root) ? null : `the token file ${label} is outside your user profile, so Windows does not keep it private to you`;
  }
  if (o.uid !== undefined && info.uid !== o.uid) return `the token file ${label} belongs to another user`;
  if (info.mode & 0o077) return `the token file ${label} is readable by others; set mode 0600`;
  return null;
}

/** A Windows file's ACL, SIDs only (no account names: those are localised and can be renamed). */
export interface WindowsAcl { owner: string; aces: { sid: string; type: string; rights: number }[] }

/** DEC-0032's allow-list beside the current user: SYSTEM and BUILTIN\Administrators — the trust of root on POSIX. */
const TRUSTED_SIDS = new Set(['S-1-5-18', 'S-1-5-32-544']);

/**
 * Why a Windows token file's ACL must not be trusted, or null (contract service.md, Windows token
 * files): the owner is the current user, and every ACE that grants any right names the user, SYSTEM
 * or Administrators. A deny ACE does not decide. The refusal names the SID, never the contents.
 */
export function windowsAclProblem(acl: WindowsAcl, userSid: string): string | null {
  if (acl.owner !== userSid) return `is owned by ${acl.owner}, not by you`;
  for (const ace of acl.aces) {
    if (!/^allow$/i.test(ace.type) || !(ace.rights > 0)) continue;
    if (ace.sid !== userSid && !TRUSTED_SIDS.has(ace.sid)) return `grants access to ${ace.sid}, but only you, SYSTEM and Administrators may hold it`;
  }
  return null;
}

const ACL_SCRIPT = (file: string) => `$a = Get-Acl -LiteralPath '${file.replace(/'/g, "''")}'; ` +
  "$s = [System.Security.Principal.SecurityIdentifier]; " +
  "$r = @($a.GetAccessRules($true, $true, $s) | ForEach-Object { @{ sid = $_.IdentityReference.Value; type = $_.AccessControlType.ToString(); rights = [long]$_.FileSystemRights } }); " +
  "@{ user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; owner = $a.GetOwner($s).Value; aces = $r } | ConvertTo-Json -Compress -Depth 4";

/** DEC-0032: one PowerShell read per file at most every ACL_TTL_MS, or when its metadata changes —
 *  readToken is synchronous and runs in the main process, which must not wait on PowerShell per probe. */
const ACL_TTL_MS = 5 * 60_000;
const aclCache = new Map<string, { key: string; at: number; problem: string | null }>();

function windowsTokenAclProblem(file: string, label: string, info: fs.Stats): string | null {
  const key = `${info.ctimeMs}|${info.mtimeMs}|${info.size}`;
  const hit = aclCache.get(file);
  if (hit && hit.key === key && Date.now() - hit.at < ACL_TTL_MS) return hit.problem;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ACL_SCRIPT(file)], { encoding: 'utf8', timeout: 15_000, windowsHide: true });
  let problem: string | null;
  try {
    const parsed = JSON.parse(r.stdout) as WindowsAcl & { user: string };
    const aces = Array.isArray(parsed.aces) ? parsed.aces : parsed.aces ? [parsed.aces] : [];
    const why = windowsAclProblem({ owner: parsed.owner, aces }, parsed.user);
    problem = why ? `the token file ${label} ${why}` : null;
  } catch {
    // The ACL could not be read: refuse, never fall back to trusting the file.
    problem = `the token file ${label}'s permissions could not be read`;
  }
  aclCache.set(file, { key, at: Date.now(), problem });
  return problem;
}

/** Read a service token with the kits' refusals (`tokenFileProblem`). Main process only. */
export function readToken(tokenFile: string): string {
  const file = expand(tokenFile);
  const info = fs.lstatSync(file);
  // FD-37: on Windows the profile check compares real paths, so a junction inside the profile that leads
  // outside it is caught (lstat looks only at the last component).
  const win = process.platform === 'win32';
  const where = win ? fs.realpathSync.native(file) : file;
  const home = win ? fs.realpathSync.native(os.homedir()) : os.homedir();
  const problem = tokenFileProblem(where, { symlink: info.isSymbolicLink(), uid: info.uid, mode: info.mode },
    { platform: process.platform, uid: typeof process.getuid === 'function' ? process.getuid() : undefined, home }, tokenFile);
  if (problem) throw new Error(problem);
  if (win) {
    const acl = windowsTokenAclProblem(where, tokenFile, fs.statSync(where));
    if (acl) throw new Error(acl);
  }
  const token = fs.readFileSync(file, 'utf8').trim();
  if (token.length < 16) throw new Error(`the token file ${tokenFile} holds no usable token`);
  return token;
}

/** The header that carries a descriptor's token. */
export function authHeaders(d: { auth: { header?: string; scheme?: 'Bearer' | 'none' } }, token: string): Record<string, string> {
  const header = d.auth.header ?? 'Authorization';
  return { [header]: (d.auth.scheme ?? 'Bearer') === 'Bearer' ? `Bearer ${token}` : token };
}
