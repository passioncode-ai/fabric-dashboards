// #region service-links — docs: packages/service-host/README.md#links
// The link that opens one service in Fabric Dashboards: `fabric-dashboards://service/<id>.<instance>`,
// optionally `?path=/…` for one page of it. Fabric's "Open dashboard" builds it here, so the two
// apps can never disagree on its form (docs/adr/0005-service-links.md). Pure: no Node import.
import { ID_PATTERN, INSTANCE_PATTERN } from './protocol';

export const SCHEME = 'fabric-dashboards';
export const APP_NAME = 'Fabric Dashboards';
/** Where a person gets Fabric Dashboards when it is not installed. */
export const DOWNLOAD_URL = 'https://github.com/passioncode-ai/fabric-dashboards/releases/latest';

const MAX_PATH = 2048;

/** `id.instance`, each part in the descriptor's own syntax; nothing encoded, nothing extra. */
export function isServiceKey(key: string): boolean {
  const dot = key.indexOf('.');
  return dot > 0 && ID_PATTERN.test(key.slice(0, dot)) && INSTANCE_PATTERN.test(key.slice(dot + 1));
}

/** A path on the service's own origin: `/…`, not `//host`, no backslash, no control character. */
export function safePath(path: string): string | null {
  if (!path.startsWith('/') || path.startsWith('//') || path.length > MAX_PATH) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return null;
  return path;
}

/** The link that opens `key` (and `path` on it) in Fabric Dashboards. Refuses what the app would refuse. */
export function serviceLink(key: string, path?: string): string {
  if (!isServiceKey(key)) throw new TypeError(`not a service key ${JSON.stringify(key.slice(0, 80))}: id.instance, lowercase letters, digits and dashes`);
  const base = `${SCHEME}://service/${key}`;
  if (path === undefined || path === '') return base;
  if (!safePath(path)) throw new TypeError('path must be a path on the service, starting with one /');
  return `${base}?${new URLSearchParams({ path }).toString()}`;
}
// #endregion service-links
