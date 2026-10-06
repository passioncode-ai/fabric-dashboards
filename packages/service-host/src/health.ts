// #region health-probe — docs: packages/service-host/README.md#health
// One look at a service's health: the well-known document on its own origin. A local service
// answers it without a token on loopback; a remote one (DEC-0019) only over verified https and
// only to the bearer of its token — a host passes the token's header in `options.headers`.
import fs from 'node:fs';
import http from 'node:http';
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

/** Read a service token with the kits' refusals: no symlink, owner only, mode 0600. Main process only. */
export function readToken(tokenFile: string): string {
  const file = expand(tokenFile);
  const info = fs.lstatSync(file);
  if (info.isSymbolicLink()) throw new Error(`the token file ${tokenFile} is a symlink`);
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) throw new Error(`the token file ${tokenFile} belongs to another user`);
  if (info.mode & 0o077) throw new Error(`the token file ${tokenFile} is readable by others; set mode 0600`);
  const token = fs.readFileSync(file, 'utf8').trim();
  if (token.length < 16) throw new Error(`the token file ${tokenFile} holds no usable token`);
  return token;
}

/** The header that carries a descriptor's token. */
export function authHeaders(d: { auth: { header?: string; scheme?: 'Bearer' | 'none' } }, token: string): Record<string, string> {
  const header = d.auth.header ?? 'Authorization';
  return { [header]: (d.auth.scheme ?? 'Bearer') === 'Bearer' ? `Bearer ${token}` : token };
}
