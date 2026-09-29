// Deep links: `fabric-dashboards://…` opens a service — or one page of it — inside the app.
//
// An agent that starts work on a service hands a person a link. A plain
// `http://127.0.0.1:<port>/…` opens in the default browser, outside the app and without its
// session; the same place as `fabric-dashboards://open?url=<that URL>` opens here, signed in.
// Parsing is pure and checked against the descriptors the app already trusts: a link can only
// name a service that is installed and a path on that service's own origin (docs/adr/0004).
import { portOf } from './descriptor';
import type { Descriptor } from './types';

export const SCHEME = 'fabric-dashboards';

export type DeepLink =
  | { page: 'service'; key: string; link?: string }
  | { page: 'activity' }
  | { page: 'overview' };

export type DeepLinkResult = { ok: true; target: DeepLink } | { ok: false; reason: string };

/** The descriptors a link may name, keyed `id.instance`. */
export type Known = ReadonlyArray<{ key: string; descriptor: Descriptor | null }>;

const MAX_LINK = 2048;

/** A path on the service's own origin: `/…`, not `//host`, no backslash, no control character. */
export function safePath(path: string): string | null {
  if (!path.startsWith('/') || path.startsWith('//') || path.length > MAX_LINK) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return null;
  return path;
}

/**
 * `fabric-dashboards://open?service=<id.instance>[&path=/…]`
 * `fabric-dashboards://open?url=http://127.0.0.1:<port>/…`   (the service is found by its origin)
 * `fabric-dashboards://activity`, `fabric-dashboards://` (overview)
 */
export function parseDeepLink(raw: string, known: Known): DeepLinkResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'not a URL' };
  }
  if (url.protocol !== `${SCHEME}:`) return { ok: false, reason: `not a ${SCHEME}: link` };
  // `fabric-dashboards://open?…` puts the verb in the host; `fabric-dashboards:open?…` in the path.
  const verb = (url.hostname || url.pathname.replace(/^\/+/, '')).toLowerCase();
  if (verb === '' || verb === 'overview') return { ok: true, target: { page: 'overview' } };
  if (verb === 'activity') return { ok: true, target: { page: 'activity' } };
  if (verb !== 'open') return { ok: false, reason: `unknown link verb ${JSON.stringify(verb.slice(0, 40))}` };

  const service = url.searchParams.get('service');
  const target = url.searchParams.get('url');
  if (service && target) return { ok: false, reason: 'name a service or a url, not both' };
  if (target) return fromServiceUrl(target, known);
  if (!service) return { ok: false, reason: 'open needs service= or url=' };
  const entry = known.find((k) => k.key === service && k.descriptor);
  if (!entry) return { ok: false, reason: `no installed service ${JSON.stringify(service.slice(0, 80))}` };
  const pathParam = url.searchParams.get('path');
  if (pathParam === null) return { ok: true, target: { page: 'service', key: entry.key } };
  const path = safePath(pathParam);
  if (!path) return { ok: false, reason: 'path must be a path on the service, starting with one /' };
  return { ok: true, target: { page: 'service', key: entry.key, link: path } };
}

/** A service's own `http://127.0.0.1:<port>/…` URL → the installed service it belongs to. */
export function fromServiceUrl(raw: string, known: Known): DeepLinkResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'url is not a URL' };
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
    return { ok: false, reason: 'url must be a local service on http://127.0.0.1:<port>' };
  }
  if (url.username || url.password) return { ok: false, reason: 'url must not carry credentials' };
  const port = Number(url.port);
  const entry = known.find((k) => k.descriptor && portOf(k.descriptor.origin) === port);
  if (!entry) return { ok: false, reason: `no installed service on port ${url.port || '80'}` };
  const path = safePath(`${url.pathname}${url.search}${url.hash}` || '/');
  if (!path) return { ok: false, reason: 'the url path is not a path on the service' };
  return { ok: true, target: { page: 'service', key: entry.key, link: path === '/' ? undefined : path } };
}

/** The link that opens `path` of `key` here — what an agent hands a person. */
export function linkFor(key: string, path?: string): string {
  const query = new URLSearchParams({ service: key });
  if (path) query.set('path', path);
  return `${SCHEME}://open?${query.toString()}`;
}
