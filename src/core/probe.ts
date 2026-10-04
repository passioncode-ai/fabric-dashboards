// Talking to a service with its token: the events feed, the usage report and the one-time login code. Runs in the
// main process only — the token never reaches a renderer. The unauthenticated health probe
// (the well-known document) is shared with Fabric in @passioncode-ai/fabric-service-host.
import { checkUsage, request, type Descriptor, type ServiceEvent, type UsageReport } from '@passioncode-ai/fabric-service-host';
import { tlsFor } from './testhooks';

export { fetchWellKnown, request } from '@passioncode-ai/fabric-service-host';
export type { WellKnownResult } from '@passioncode-ai/fabric-service-host';

/** How long one health probe waits. A loaded Mac answers late, not never: 2 s gave a false
 *  "not answering" under load (ADR-0008), so the window and the MCP server wait 5 s. */
export const PROBE_TIMEOUT_MS = 5_000;

// One definition of each boundary (R-005): token reading and its header live in the shared package,
// which a remote placement's probe needs too (DEC-0019).
export { readToken, authHeaders } from '@passioncode-ai/fabric-service-host';
import { authHeaders } from '@passioncode-ai/fabric-service-host';

export interface EventsPage { events: ServiceEvent[]; cursor: string | null }

export async function fetchEvents(d: Descriptor, eventsPath: string, token: string, after: string | null, limit = 100): Promise<EventsPage> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (after) q.set('after', after);
  const res = await request(d.origin, 'GET', `${eventsPath}?${q}`, authHeaders(d, token), 5000, tlsFor(d.origin));
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
  const res = await request(d.origin, 'POST', '/fabric/v1/login-code', authHeaders(d, token), 5000, tlsFor(d.origin));
  if (res.status !== 200) throw new Error(`the service refused a login code (HTTP ${res.status})`);
  const body = JSON.parse(res.body) as { url?: string };
  if (!body.url || !/^\/fabric\/v1\/login\?code=[A-Za-z0-9_-]{16,256}$/.test(body.url)) throw new Error('the login code answer is malformed');
  return d.origin + body.url;
}

/** GET the service's usage report (contract DEC-0021), checked against the descriptor's identity. */
export async function fetchUsage(d: Descriptor, usagePath: string, token: string): Promise<UsageReport> {
  const res = await request(d.origin, 'GET', usagePath, authHeaders(d, token), 5000, tlsFor(d.origin));
  if (res.status === 401 || res.status === 403) throw new Error(`the service refused the token (HTTP ${res.status})`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} from the usage report`);
  let body: unknown;
  try { body = JSON.parse(res.body); } catch { throw new Error('the usage report is not JSON'); }
  const problem = checkUsage(body, { id: d.id, instance: d.instance });
  if (problem) throw new Error(`the usage report is malformed: ${problem}`);
  return body as UsageReport;
}
