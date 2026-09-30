// Deep links: `fabric-dashboards://…` opens a service — or one page of it — inside the app.
//
// An agent that starts work on a service, or Fabric's "Open dashboard" (SCN-101 in Fabric), hands
// a person a link. A plain `http://127.0.0.1:<port>/…` opens in the default browser, outside the
// app and without its session; `fabric-dashboards://service/<id>.<instance>?path=/…` opens the
// same place here, signed in. Parsing is pure and checked against the descriptors the app
// already trusts: a link can only name a service that is installed and a path on that service's
// own origin (docs/adr/0004-deep-links-and-mcp.md, docs/adr/0005-service-links.md).
// The key syntax, the safe path and the link builder are shared with Fabric
// (@passioncode-ai/fabric-service-host → links), so the two apps cannot disagree on the form.
import { isServiceKey, portOf, safePath, SCHEME, serviceLink, type Descriptor } from '@passioncode-ai/fabric-service-host';

export { isServiceKey, safePath, SCHEME } from '@passioncode-ai/fabric-service-host';

export type DeepLink =
  | { page: 'service'; key: string; link?: string }
  | { page: 'activity' }
  | { page: 'overview' };

export type DeepLinkResult = { ok: true; target: DeepLink } | { ok: false; reason: string };

/** The descriptors a link may name, keyed `id.instance`. */
export type Known = ReadonlyArray<{ key: string; descriptor: Descriptor | null }>;

/** A piece of an untrusted link, safe to quote in a reason: JSON-escaped and clipped. */
const quote = (s: string, max = 80) => JSON.stringify(s.slice(0, max));

const PATH_REFUSED = 'path must be a path on the service, starting with one /';

/**
 * `fabric-dashboards://service/<id.instance>[?path=/…]`             (the form linkFor hands out)
 * `fabric-dashboards://open?service=<id.instance>[&path=/…]`        (0.2.0; still accepted)
 * `fabric-dashboards://open?url=http://127.0.0.1:<port>/…`          (the service found by its origin)
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
  if (url.username || url.password || url.port) return { ok: false, reason: 'a link carries no user, password or port' };
  // `fabric-dashboards://open?…` puts the verb in the host; `fabric-dashboards:open?…` in the path.
  const verb = (url.hostname || url.pathname.replace(/^\/+/, '')).toLowerCase();
  if (verb === '' || verb === 'overview') return { ok: true, target: { page: 'overview' } };
  if (verb === 'activity') return { ok: true, target: { page: 'activity' } };
  if (verb === 'service' && url.hostname) return serviceForm(url, known);
  if (verb !== 'open') return { ok: false, reason: `unknown link verb ${quote(verb, 40)}` };

  const service = url.searchParams.get('service');
  const target = url.searchParams.get('url');
  if (service && target) return { ok: false, reason: 'name a service or a url, not both' };
  if (target) return fromServiceUrl(target, known);
  if (!service) return { ok: false, reason: 'open needs service= or url=' };
  return installed(service, url.searchParams.get('path'), known);
}

// #region service-link-form — docs: docs/adr/0005-service-links.md#decision
/** `service/<id.instance>`, at most one trailing slash, and `path=` as the only parameter. */
function serviceForm(url: URL, known: Known): DeepLinkResult {
  const segments = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (!segments) return { ok: false, reason: 'service/ needs the service key, id.instance' };
  const [key, ...rest] = segments.split('/');
  if (!key || !isServiceKey(key)) return { ok: false, reason: `not a service key ${quote(key ?? '')}: id.instance, lowercase letters, digits and dashes` };
  if (rest.length) return { ok: false, reason: 'the link names one service, service/<id>.<instance>; a page of it goes in path=' };
  if (url.hash) return { ok: false, reason: 'a service link carries no #fragment; put the page, with its fragment, in path=' };
  for (const name of new Set(url.searchParams.keys())) {
    if (name !== 'path') return { ok: false, reason: `unknown parameter ${quote(name, 40)}; a service link takes only path=` };
  }
  const paths = url.searchParams.getAll('path');
  if (paths.length > 1) return { ok: false, reason: 'a service link takes one path' };
  return installed(key, paths.length ? paths[0]! : null, known);
}
// #endregion service-link-form

/** The named service must be installed with a usable descriptor; the path must stay on its origin. */
function installed(key: string, pathParam: string | null, known: Known): DeepLinkResult {
  const entry = known.find((k) => k.key === key && k.descriptor);
  if (!entry) return { ok: false, reason: `no installed service ${quote(key)}` };
  if (pathParam === null) return { ok: true, target: { page: 'service', key: entry.key } };
  const path = safePath(pathParam);
  if (!path) return { ok: false, reason: PATH_REFUSED };
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

/**
 * The link that opens `path` of `key` here — what an agent, or Fabric's "Open dashboard", hands
 * a person: `fabric-dashboards://service/<id.instance>[?path=/…]`. Refuses to build a link the
 * app would refuse.
 */
export function linkFor(key: string, path?: string): string {
  return serviceLink(key, path);
}
