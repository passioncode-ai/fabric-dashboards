// Talking to a service with its token: the events feed and the one-time login code. Runs in the
// main process only — the token never reaches a renderer. The unauthenticated health probe
// (the well-known document) is shared with Fabric in @passioncode-ai/fabric-service-host.
import fs from 'node:fs';
import { expand, request, type Descriptor, type ServiceEvent } from '@passioncode-ai/fabric-service-host';

export { fetchWellKnown, request } from '@passioncode-ai/fabric-service-host';
export type { WellKnownResult } from '@passioncode-ai/fabric-service-host';

/** How long one health probe waits. A loaded Mac answers late, not never: 2 s gave a false
 *  "not answering" under load (ADR-0008), so the window and the MCP server wait 5 s. */
export const PROBE_TIMEOUT_MS = 5_000;

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
