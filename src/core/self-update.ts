// #region self-update — docs: docs/adr/0019-windows-and-linux.md#amendment-2026-10-11--updates-on-linux-fd-37-m4b
// FD-37 M4 (platforms.md PL-04, LC-16 on every OS): how this copy updates itself, decided by how it was
// installed, and which file of a release's feed is its own. The trust is the same everywhere: the release's
// SHA256SUMS signed by the organization key (`release-verify.ts`), then the file's own hash.
import fs from 'node:fs';
import path from 'node:path';

/**
 * - `squirrel`: macOS, Squirrel.Mac (ADR-0015).
 * - `appimage`: Linux AppImage — the verified new AppImage replaces this file; it runs from the next start.
 * - `package`: Linux `.deb` — never checks (PL-04); a newer `.deb` updates it, through the package manager.
 * - `not-yet`: Windows until M4c — this copy does not update itself and says where the newer installer is.
 * - `development`: not packaged — updates come with the installed app.
 */
export type UpdateChannel = 'squirrel' | 'appimage' | 'package' | 'not-yet' | 'development';

export function updateChannel(o: { platform: NodeJS.Platform; packaged: boolean; appImage?: string }): UpdateChannel {
  if (!o.packaged) return 'development';
  if (o.platform === 'darwin') return 'squirrel';
  if (o.platform === 'linux') return o.appImage && /\.AppImage$/i.test(o.appImage) && path.isAbsolute(o.appImage) ? 'appimage' : 'package';
  return 'not-yet';
}

/** The feed's key for this copy (`scripts/release-feed.mjs` PLATFORMS). */
export const platformKey = (platform: NodeJS.Platform, arch: string): string => (platform === 'darwin' ? 'darwin-universal' : `${platform}-${arch}`);

/** The name a release gives this platform's update file — the feed must name exactly this. */
export function updateFileName(key: string, version: string): string | null {
  const [os, arch] = key.split('-');
  if (os === 'linux' && (arch === 'x64' || arch === 'arm64')) return `Fabric-Dashboards-${version}-linux-${arch}.AppImage`;
  if (os === 'win32' && (arch === 'x64' || arch === 'arm64')) return `Fabric-Dashboards-${version}-windows-${arch}-setup.exe`;
  return null;
}

/** This platform's entry in a release's feed, or why there is none. The name must be the release's own. */
export function platformUpdate(feed: unknown, key: string, version: string): { ok: true; file: string; sha256: string } | { ok: false; why: string } {
  const entry = (feed as { platforms?: Record<string, { update?: unknown; sha256?: unknown }> })?.platforms?.[key];
  if (!entry) return { ok: false, why: `the feed of ${version} names no update for ${key}` };
  const expected = updateFileName(key, version);
  if (!expected || entry.update !== expected) return { ok: false, why: `the feed of ${version} names ${String(entry.update)} for ${key}, not ${expected ?? 'a known file'}` };
  if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) return { ok: false, why: `the feed of ${version} gives no sha256 for ${expected}` };
  return { ok: true, file: expected, sha256: entry.sha256 };
}

/** Where a new AppImage is written before it replaces this one: beside it (same file system, so the rename is
 *  atomic), hidden, named for its version. */
export const stagedAppImage = (target: string, version: string): string => path.join(path.dirname(target), `.${path.basename(target)}.${version}.part`);

/**
 * Put a verified AppImage in place of this one: executable, then renamed over the target in one step. The
 * running copy keeps the old file open (its mount), so it runs on until the next start. A failure leaves the
 * target as it was and removes the staged file.
 */
export function replaceAppImage(target: string, staged: string): void {
  try {
    fs.chmodSync(staged, 0o755);
    fs.renameSync(staged, target);
  } catch (error) {
    fs.rmSync(staged, { force: true });
    throw error;
  }
}
// #endregion self-update
