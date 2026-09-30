// #region health-probe — docs: packages/service-host/README.md#health
// One look at a service's health: the unauthenticated well-known document on its own loopback
// origin. Needs no token; a host that also reads events or signs in adds that itself.
import http from 'node:http';
import { portOf } from './descriptor';
import { PROTOCOL, type WellKnown, type WellKnownResult } from './protocol';

export interface HttpResult { status: number; body: string; ms: number }

const MAX_BODY = 2 * 1024 * 1024;

/** One request to a loopback service origin, answer capped at 2 MB. */
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

/** GET /.well-known/fabric-service. Never throws: silence is `no-answer`, anything else `not-protocol`. */
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
// #endregion health-probe
