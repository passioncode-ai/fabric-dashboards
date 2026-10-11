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
 * - `nsis`: Windows, installed by the NSIS installer (its uninstaller beside the app) — the verified new installer
 *   runs silently in update mode once the app quits, and starts the app again (M4c).
 * - `not-yet`: any other Windows copy — it does not update itself and says where the newer installer is.
 * - `development`: not packaged — updates come with the installed app.
 */
export type UpdateChannel = 'squirrel' | 'appimage' | 'package' | 'nsis' | 'not-yet' | 'development';

export function updateChannel(o: { platform: NodeJS.Platform; packaged: boolean; appImage?: string; appDir?: string; execPath?: string; appImageIsFile?: boolean; nsisUninstaller?: boolean }): UpdateChannel {
  if (!o.packaged) return 'development';
  if (o.platform === 'darwin') return 'squirrel';
  if (o.platform === 'linux') {
    // `APPIMAGE` and `APPDIR` are inherited by children: this copy is an AppImage only when it runs from inside
    // that image's mount, and the image is a regular file. Anything else — a .deb started from an AppImage's
    // shell — is never allowed to overwrite the file the variable names.
    const inside = Boolean(o.appDir && o.execPath && path.isAbsolute(o.appDir) && path.resolve(o.execPath).startsWith(path.resolve(o.appDir) + path.sep));
    return o.appImage && /\.AppImage$/i.test(o.appImage) && path.isAbsolute(o.appImage) && inside && o.appImageIsFile === true ? 'appimage' : 'package';
  }
  if (o.platform === 'win32') return o.nsisUninstaller === true ? 'nsis' : 'not-yet';
  return 'not-yet';
}

/** Where a Windows copy keeps a verified installer until it runs (inside the app's data, so uninstall removes it). */
export const PENDING_UPDATE_DIR = 'pending-update';

/**
 * How a verified NSIS installer runs as an update (electron-builder's own flags, as electron-updater's
 * NsisUpdater passes them): `--updated` installs over the copy in place, `/S` without a window, `--force-run`
 * starts the app again when it is done. Never an uninstall, never app data (PL-04).
 */
export const NSIS_UPDATE_ARGS: readonly string[] = ['--updated', '/S', '--force-run'];

/** Whether this Windows copy sits where the per-user one-click installer puts it (%LOCALAPPDATA%\Programs\<name>):
 *  an `--updated` install writes there, so a copy anywhere else would never change and update forever. */
export function nsisInstalledAt(execPath: string, localAppData: string | undefined): boolean {
  if (!localAppData) return false;
  const programs = path.win32.join(localAppData, 'Programs').toLowerCase();
  return path.win32.dirname(path.win32.dirname(execPath)).toLowerCase() === programs;
}

/**
 * How the verified installer is run as an update: a hidden PowerShell that waits for this app's process to exit
 * (NSIS cannot replace files the running app holds), refuses if it is still running, checks the installer's
 * SHA256 again right before it runs — nothing may swap it between the app's check and the install — and only then
 * starts it with the update flags. Paths go in single-quoted literals with quotes doubled; nothing passes through
 * cmd.exe (as `uninstallCommand`).
 */
export function nsisUpdateCommand(installer: string, sha256: string, pid: number, waitSeconds = 120): { file: string; args: string[] } {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('the installer\'s sha256 is 64 hex digits');
  const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const id = Math.trunc(pid);
  const script = [
    `Wait-Process -Id ${id} -Timeout ${Math.trunc(waitSeconds)} -ErrorAction SilentlyContinue`,
    `if (Get-Process -Id ${id} -ErrorAction SilentlyContinue) { exit 3 }`,
    `if ((Get-FileHash -Algorithm SHA256 -LiteralPath ${lit(installer)}).Hash.ToLowerInvariant() -ne ${lit(sha256)}) { exit 2 }`,
    `Start-Process -FilePath ${lit(installer)} -ArgumentList ${NSIS_UPDATE_ARGS.map(lit).join(',')}`,
  ].join('; ');
  return { file: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', script] };
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
    // On disk before it takes the name: a power loss after the rename must not leave a truncated AppImage.
    const fd = fs.openSync(staged, 'r+'); // r+: Windows flushes only a handle that may write
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(staged, target);
  } catch (error) {
    fs.rmSync(staged, { force: true });
    throw error;
  }
  // The rename itself, on disk (POSIX; a folder cannot be opened this way on Windows, where it is not needed).
  try { const dir = fs.openSync(path.dirname(target), 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); } } catch { /* best effort */ }
}
// #endregion self-update
