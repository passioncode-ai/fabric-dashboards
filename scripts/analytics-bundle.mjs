// FD-136 (docs/ANALYTICS.md#which-builds-send): the App Key a release build carries. Only the release workflow sets
// FABRIC_DASHBOARDS_ANALYTICS_APP_KEY and FABRIC_DASHBOARDS_ANALYTICS_HOST; without them nothing is written and the
// built app sends nothing. The key's value is never printed: the receipt says only whether one is bundled.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const KEY = /^A-[A-Z]{2,4}-\d{10}$/;

/** The host as an https origin with nothing after it, or null. */
export function analyticsOrigin(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && url.href === `${url.origin}/` && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

/**
 * Writes `analytics.json` into `dir` when the environment carries a key, and returns its path for the packager's
 * `extraResource` (null: no key, nothing bundled). A key without a valid host, or a malformed key, stops the build.
 * `debug` marks every event as Debug: a key set by hand outside GitHub Actions never lands in the Release dataset.
 */
export function analyticsBundle(dir, env = process.env) {
  const appKey = env.FABRIC_DASHBOARDS_ANALYTICS_APP_KEY;
  if (!appKey) return null;
  if (!KEY.test(appKey)) throw new Error('FABRIC_DASHBOARDS_ANALYTICS_APP_KEY is not an App Key');
  const host = analyticsOrigin(env.FABRIC_DASHBOARDS_ANALYTICS_HOST);
  if (!host) throw new Error('FABRIC_DASHBOARDS_ANALYTICS_HOST must be an https origin when an App Key is set');
  const file = path.join(dir, 'analytics.json');
  writeFileSync(file, JSON.stringify({ appKey, host, debug: env.GITHUB_ACTIONS !== 'true' }) + '\n', { mode: 0o644 });
  return file;
}
