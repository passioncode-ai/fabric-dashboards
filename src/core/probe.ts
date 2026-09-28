// Talking to a service: the unauthenticated well-known document, the
// token-gated events feed and the one-time login code. Runs in the main
// process only — the token never reaches a renderer.
import fs from 'node:fs';
import http from 'node:http';
import { expand, portOf } from './descriptor';
import { PROTOCOL, type Descriptor, type ServiceEvent, type WellKnown, type WellKnownResult } from './types';

export interface HttpResult { status: number; body: string; ms: number }

export function request(origin: string, method: 'GET' | 'POST', path: string, headers: Record<string, string> = {}, timeoutMs = 3000): Promise<HttpResult> {
  const port = portOf(origin);
  if (port === null) return Promise.reject(new Error(`origin ${origin} is not http://127.0.0.1:<port>`));
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: { Host: `127.0.0.1:${port}`, Accept: 'application/json', ...headers }, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > 2 * 1024 * 1024) { req.destroy(new Error('response larger than 2 MB')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), ms: Date.now() - started }));
    });
    req.on('timeout', () => req.destroy(new Error(`no answer within ${timeoutMs} ms`)));
    req.on('error', reject);
    req.end();
  });
}

export type { WellKnownResult } from './types';

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

export async function fetchWellKnown(origin: string, timeoutMs = 2000): Promise<WellKnownResult> {
  let res: HttpResult;
  try {
    res = await request(origin, 'GET', '/.well-known/fabric-service', {}, timeoutMs);
  } catch (error) {
    return { kind: 'no-answer', detail: (error as Error).message };
  }
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

/** Read the token with the same refusals as the kits: no symlink, owner only, 0600. */
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

export function authHeaders(d: Descriptor, token: string): Record<string, string> {
  const header = d.auth.header ?? 'Authorization';
  const scheme = d.auth.scheme ?? 'Bearer';
  return { [header]: scheme === 'Bearer' ? `Bearer ${token}` : token };
}

export interface EventsPage { events: ServiceEvent[]; cursor: string | null }

export async function fetchEvents(d: Descriptor, eventsPath: string, token: string, after: string | null, limit = 100): Promise<EventsPage> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (after) q.set('after', after);
  const res = await request(d.origin, 'GET', `${eventsPath}?${q}`, authHeaders(d, token), 5000);
  if (res.status === 401 || res.status === 403) throw new Error(`the service refused the token (HTTP ${res.status})`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} from the events feed`);
  const page = JSON.parse(res.body) as EventsPage;
  if (!Array.isArray(page.events)) throw new Error('the events feed did not return an events page');
  const events = page.events.filter((e) => e && typeof e.id === 'string' && typeof e.text === 'string' && typeof e.at === 'string'
    && ['info', 'notice', 'warning', 'error'].includes(e.level) && (e.link === undefined || (e.link.startsWith('/') && !e.link.startsWith('//'))));
  return { events, cursor: page.cursor ?? after };
}

/** POST /fabric/v1/login-code → an absolute URL on the service origin. */
export async function loginUrl(d: Descriptor, token: string): Promise<string> {
  const res = await request(d.origin, 'POST', '/fabric/v1/login-code', authHeaders(d, token), 5000);
  if (res.status !== 200) throw new Error(`the service refused a login code (HTTP ${res.status})`);
  const body = JSON.parse(res.body) as { url?: string };
  if (!body.url || !/^\/fabric\/v1\/login\?code=[A-Za-z0-9_-]{16,256}$/.test(body.url)) throw new Error('the login code answer is malformed');
  return d.origin + body.url;
}
