// App self-update (SCN-022, ADR-0015, lifecycle LC-16 "in detail"): Squirrel.Mac through Electron's
// autoUpdater with a JSON feed published beside each GitHub release. It needs a signed, packaged app
// in Applications; an unpackaged run reports `unsupported` instead of pretending.
//
// LC-16, the same in every product of the organization:
// - switch: the `auto-update` file in the app's data folder (absent = on, `off` = off). Off stops
//   automatic checks, downloads and installs; "Check for Updates…" always works.
// - cadence: first check 90 s after start, then every 6 h while the process runs; after a failed
//   check one retry within the hour.
// - verification, before Squirrel may stage anything: the release's SHA256SUMS signed by the pinned
//   organization key, the zip's sha256 as SHA256SUMS names it, the feed naming only its own release,
//   the app inside signed (strict) by team KJ35UYYL22 and carrying the announced, newer version. Its
//   code-directory hash is recorded; the bundle Squirrel stages must carry the same, else it is
//   removed before any quit. Squirrel itself also refuses downgrades (ElectronSquirrelPreventDowngrades).
// - activation only at a safe point: quit, Restart to update, or 10 hidden minutes with nothing running.
// - a release whose feed says `needsPerson` is verified but held until the person installs it.
// - log events, codes as the organization names them: update_check, update_download, update_install,
//   update_restart, auto_update (LC-12).
import { app, autoUpdater, net } from 'electron';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FEED_FILE, feedNamesOwnRelease, localFeed, parseSums, releaseFile, signedFeed, sumsSignedByRelease, zipName } from '../core/release-verify';
import { APP_UPDATE_EVERY_MS, FIRST_CHECK_MS, isNewer, quietCheck, mayCheck, stagedBundlePath, stagedRefusal, stagingLost, strayShipIt } from '../core/version';
import type { AppStatus } from '../core/types';
import { appImageRelaunchCommand, nsisInstalledAt, nsisUpdateCommand, PENDING_UPDATE_DIR, platformKey, platformUpdate, replaceAppImage, stagedAppImage, updateChannel } from '../core/self-update';
import { uninstallTarget } from '../core/platform';
import { powerShellAfterExit, spawnAfterExit } from '../core/after-exit';
import { windowsPowerShellEnv } from '@passioncode-ai/fabric-service-host';

/** The one feed this app reads: pinned, never taken from the environment. */
export const DEFAULT_FEED = 'https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json';
const FEED_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
const RETRY_AFTER_FAILURE_MS = APP_UPDATE_EVERY_MS;
/** A check or a download that shows no progress this long is a failure, never a state that sticks (audit 2026-10-07). */
const STUCK_MS = 45 * 60_000;
const BUNDLE_ID = 'ai.passioncode.fabric-dashboards';

// #region local-feed — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#lc-16
/** FD-29: the verified zip waits for Squirrel here, so the bytes verified are the bytes Squirrel
 *  stages, the zip is not downloaded twice, and no fetch of Squirrel's follows our check. One
 *  folder: emptied before each verification, once Squirrel has staged or refused its copy, and at
 *  start (what a stopped run left). */
function verifiedCacheDir(): string {
  return path.join(os.homedir(), 'Library', 'Caches', BUNDLE_ID, 'verified-update');
}

function emptyVerifiedCache(): void {
  fs.rmSync(verifiedCacheDir(), { recursive: true, force: true });
}
// #endregion local-feed

export type UpdateState = AppStatus['update'];
type Feed = { currentRelease?: unknown; needsPerson?: unknown };
type Verified = { version: string; cdhash: string; needsPerson: string | null; feedUrl: string };

function run(file: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 120_000, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ code: error ? 1 : 0, out: `${stdout ?? ''}${stderr ?? ''}` });
    });
  });
}

/** Stream a release file to `file` (0600), returning its sha256. A write error (a full disk, no permission)
 *  ends the wait for `drain` instead of hanging it; a failure removes nothing — the caller decides. */
async function downloadTo(url: string, file: string, timeoutMs: number): Promise<string> {
  const res = await net.fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok || !res.body) throw new Error(`${path.basename(file)} answered HTTP ${res.status}`);
  const hash = createHash('sha256');
  const out = fs.createWriteStream(file, { mode: 0o600 });
  let failed: Error | null = null;
  const failure = new Promise<never>((_, reject) => out.once('error', (e) => { failed = e; reject(e); }));
  failure.catch(() => undefined);
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (failed) throw failed;
      hash.update(value);
      if (!out.write(value)) await Promise.race([new Promise((r) => out.once('drain', r)), failure]);
    }
    await Promise.race([new Promise<void>((resolve) => out.end(() => resolve())), failure]);
    if (failed) throw failed;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    out.destroy();
    throw error;
  }
  return hash.digest('hex');
}

/** What codesign and the Info.plist say about a bundle. */
async function inspect(bundle: string): Promise<{ strict: boolean; team: string | null; cdhash: string | null; version: string | null }> {
  const strict = (await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle])).code === 0;
  const details = (await run('/usr/bin/codesign', ['-dvvv', bundle])).out;
  const info = await run('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', path.join(bundle, 'Contents/Info.plist')]);
  return {
    strict,
    team: /TeamIdentifier=(\w+)/.exec(details)?.[1] ?? null,
    cdhash: /CDHash=([0-9a-f]+)/.exec(details)?.[1] ?? null,
    version: info.code === 0 ? info.out.trim() : null,
  };
}

export class Updater {
  /** The last quiet check logged, `<installed>:<feed>`; null after a failure. */
  private lastQuiet: string | null = null;
  state: UpdateState = { state: 'idle' };
  private timer: NodeJS.Timeout | null = null;
  private retry: NodeJS.Timeout | null = null;
  private verified: Verified | null = null;
  private stuck: NodeJS.Timeout | null = null;
  /** FD-37 M4: how this copy updates, from how it was installed (`src/core/self-update.ts`). */
  private readonly channel = updateChannel({
    platform: process.platform, packaged: app.isPackaged, appImage: process.env.APPIMAGE, appDir: process.env.APPDIR, execPath: process.execPath,
    appImageIsFile: (() => { try { return Boolean(process.env.APPIMAGE) && fs.lstatSync(process.env.APPIMAGE!).isFile(); } catch { return false; } })(),
    nsisUninstaller: process.platform === 'win32' && uninstallTarget('win32', process.execPath, process.env, fs.existsSync).kind === 'run-uninstaller' && nsisInstalledAt(process.execPath, process.env.LOCALAPPDATA),
  });
  /** A Linux or Windows release held by `needsPerson`: the version the person may install with Install now. */
  private heldFile: string | null = null;
  /** Windows (M4c): the verified installer waiting for the app to quit, and its sha256 (checked again before it runs). */
  private pendingInstaller: { file: string; sha256: string } | null = null;
  /** FD-75: the bundle Squirrel staged for the ready update, checked again before it is offered or installed. */
  private stagedBundle: string | null = null;
  /** FD-75: the person asked to install while the staged update had gone; install as soon as it is staged again. */
  private installWhenReady = false;
  /** FD-75: called when an update staged again after the person's Restart to update is ready to install. */
  onInstallWhenReady: (() => void) | null = null;

  constructor(
    private readonly onChange: () => void,
    private readonly log: (message: string) => void,
    /** Squirrel is about to close the windows and quit to install: the window must let itself close (R-3). */
    private readonly onQuitForUpdate: () => void = () => undefined,
    /** The person's switch (the `auto-update` file). */
    private readonly enabled: () => boolean = () => true,
    /** Where this app keeps its data: the last version it ran, to log an install it finished. */
    private readonly dataDir: string = app.getPath('userData'),
  ) {}

  private event(name: string, outcome: string, detail = ''): void {
    this.log(`${name} ${outcome}${detail ? ` ${detail}` : ''}`);
  }

  start(): void {
    this.noteInstalled();
    if (this.channel === 'development') {
      this.state = { state: 'unsupported' };
      return;
    }
    // PL-04: a .deb copy never checks — a newer .deb updates it; Windows does not update itself until M4c.
    if (this.channel === 'package' || this.channel === 'not-yet') {
      this.state = { state: this.channel === 'package' ? 'package' : 'notyet' };
      this.event('update_check', 'unsupported', `channel=${this.channel}`);
      return;
    }
    if (this.channel === 'appimage' || this.channel === 'nsis') {
      if (this.channel === 'appimage') this.sweepAppImageParts();
      // An installer from an earlier run has either run (this is the new version) or was never started: gone. The
      // installer that just ran may still hold its file for a moment; a removal that fails waits for the next start.
      else { try { fs.rmSync(path.join(this.dataDir, PENDING_UPDATE_DIR), { recursive: true, force: true }); } catch (error) { this.log(`update: ${PENDING_UPDATE_DIR} stays until the next start: ${(error as Error).message}`); } }
      this.switched(this.enabled());
      setTimeout(() => this.check(), FIRST_CHECK_MS).unref();
      this.timer = setInterval(() => this.check(), APP_UPDATE_EVERY_MS);
      this.timer.unref();
      return;
    }
    // Squirrel replaces the bundle where it is: from a disk image or Downloads (often translocated,
    // read-only) the install cannot happen, so nothing is downloaded until the app is moved (ADR-0015).
    if (!app.isInApplicationsFolder()) {
      this.state = { state: 'misplaced' };
      this.log('update: the app runs outside Applications; updates wait until it is moved there');
      return;
    }
    try {
      autoUpdater.setFeedURL({ url: DEFAULT_FEED, serverType: 'json' });
    } catch (error) {
      this.fail('check_failed', (error as Error).message);
      return;
    }
    emptyVerifiedCache();
    void this.removeStrayShipIt();
    autoUpdater.on('update-available', () => { this.event('update_download', 'started', `version=${this.verified?.version ?? '?'} by=squirrel`); this.set({ state: 'downloading', version: this.verified?.version }); });
    autoUpdater.on('update-not-available', () => { this.event('update_check', 'current', `version=${app.getVersion()} by=squirrel`); this.set({ state: 'idle', checkedAt: new Date().toISOString() }); });
    autoUpdater.on('update-downloaded', () => void this.checkStaged());
    autoUpdater.on('error', (error) => { if (this.state.state === 'downloading') emptyVerifiedCache(); this.fail(this.state.state === 'downloading' ? 'download_failed' : 'check_failed', error.message); });
    autoUpdater.on('before-quit-for-update', () => { this.event('update_install', 'started', `version=${this.state.version ?? '?'}`); this.onQuitForUpdate(); });
    this.switched(this.enabled());
    setTimeout(() => this.check(), FIRST_CHECK_MS).unref();
    this.timer = setInterval(() => this.check(), APP_UPDATE_EVERY_MS);
    this.timer.unref();
  }

  /** The person changed the switch (or it was read at start). */
  switched(on: boolean): void {
    this.event('auto_update', on ? 'on' : 'off');
  }

  /** The version this copy ran last time: a different one now means an install finished. */
  private noteInstalled(): void {
    const file = path.join(this.dataDir, '.last-version');
    let last = '';
    try { last = fs.readFileSync(file, 'utf8').trim(); } catch { /* first run */ }
    if (last && last !== app.getVersion()) this.event('update_install', 'installed', `from=${last} to=${app.getVersion()}`);
    try { if (last !== app.getVersion()) fs.writeFileSync(file, `${app.getVersion()}\n`, { mode: 0o600 }); } catch { /* read-only or full: logged elsewhere */ }
  }

  /** F-1: the feed's version is read first; only a newer, verified release reaches Squirrel.
   *  `manual` is the person's "Check for Updates…", which works with automatic updates off. */
  check(manual = false): void {
    if (this.lostStaging()) { this.restage(false); return; }
    if (!mayCheck({ manual, enabled: this.enabled(), state: this.state.state })) return;
    this.set({ state: 'checking' });
    void this.run(manual);
  }

  private async run(manual: boolean): Promise<void> {
    let feed: Feed;
    try {
      const res = await net.fetch(DEFAULT_FEED, { cache: 'no-store', signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
      if (!res.ok) return this.fail('check_failed', `the update feed answered HTTP ${res.status}`);
      feed = (await res.json()) as Feed;
    } catch (error) {
      return this.fail('check_failed', `the update feed could not be read: ${(error as Error).message}`);
    }
    const version = typeof feed.currentRelease === 'string' ? feed.currentRelease : null;
    if (!version) return this.fail('check_failed', 'the update feed names no release');
    if (!isNewer(version, app.getVersion())) {
      // 5-minute checks (LC-16): a quiet check is logged once per state, not 288 times a day; a person's check always.
      const quiet = quietCheck(this.lastQuiet, app.getVersion(), version, manual);
      if (quiet.log) this.event('update_check', 'current', `version=${app.getVersion()} feed=${version}${manual ? ' asked=person' : ''}`);
      this.lastQuiet = quiet.last;
      this.set({ state: 'idle', checkedAt: new Date().toISOString() });
      return;
    }
    if (!feedNamesOwnRelease(feed, version)) return this.fail('signature_failed', `the feed for ${version} names a file outside its own release`);
    if (this.channel === 'appimage' || this.channel === 'nsis') return this.prepareFile(version, false);
    this.set({ state: 'downloading', version });
    const verified = await this.verify(version);
    if ('error' in verified) return this.fail(verified.code, verified.error);
    this.verified = verified;
    const steps = verified.needsPerson; // from the release's signed feed, not the `latest` redirect
    if (steps) {
      this.event('update_check', 'needs_migration', `version=${version}`);
      this.set({ state: 'held', version, steps });
      return;
    }
    this.stage();
  }

  /** Hand the verified release to Squirrel: its feed is the local one naming the verified zip
   *  (FD-29), and the bundle it stages is checked against what was verified. */
  private stage(): void {
    try {
      if (this.verified) autoUpdater.setFeedURL({ url: this.verified.feedUrl, serverType: 'json' });
      autoUpdater.checkForUpdates();
    } catch (error) {
      this.fail('download_failed', (error as Error).message);
    }
  }

  /** The release's own files, verified end to end, before Squirrel touches anything. The zip stays
   *  in the verified-update cache for the local feed; a failure empties the folder. */
  private async verify(version: string): Promise<Verified | { code: string; error: string }> {
    const dir = verifiedCacheDir();
    emptyVerifiedCache();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    let keep = false;
    try {
      const get = async (name: string, timeout = FEED_TIMEOUT_MS) => {
        const res = await net.fetch(releaseFile(version, name), { cache: 'no-store', signal: AbortSignal.timeout(timeout) });
        if (!res.ok) throw new Error(`${name} answered HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      };
      let sums: Buffer;
      let asc: string;
      try { [sums, asc] = [await get('SHA256SUMS'), (await get('SHA256SUMS.asc')).toString('utf8')]; } catch (error) { return { code: 'download_failed', error: (error as Error).message }; }
      const signed = await sumsSignedByRelease(sums, asc);
      if (!signed.ok) return { code: 'signature_failed', error: `SHA256SUMS of ${version} is not signed by the organization: ${signed.why}` };
      const listed = parseSums(sums.toString('utf8'));
      let feedBytes: Buffer;
      try { feedBytes = await get(FEED_FILE); } catch (error) { return { code: 'download_failed', error: (error as Error).message }; }
      const feed = signedFeed(feedBytes, listed, version);
      if (!feed.ok) return { code: 'signature_failed', error: feed.why };
      const expected = listed.get(zipName(version));
      if (!expected) return { code: 'signature_failed', error: `SHA256SUMS of ${version} names no ${zipName(version)}` };
      this.event('update_download', 'started', `version=${version}`);
      const zip = path.join(dir, zipName(version));
      let actual: string;
      try {
        actual = await downloadTo(releaseFile(version, zipName(version)), zip, DOWNLOAD_TIMEOUT_MS);
      } catch (error) {
        return { code: 'download_failed', error: (error as Error).message };
      }
      if (actual !== expected) return { code: 'signature_failed', error: `${zipName(version)} has sha256 ${actual}, SHA256SUMS says ${expected}` };
      if ((await run('/usr/bin/ditto', ['-x', '-k', zip, path.join(dir, 'app')])).code !== 0) return { code: 'download_failed', error: `${zipName(version)} could not be unpacked` };
      const bundle = path.join(dir, 'app', 'Fabric Dashboards.app');
      const seen = await inspect(bundle);
      if (!seen.strict) return { code: 'signature_failed', error: `the app in ${zipName(version)} fails strict signature verification` };
      const refusal = stagedRefusal({ feedVersion: version, stagedVersion: seen.version, team: seen.team, current: app.getVersion() });
      if (refusal) return { code: 'signature_failed', error: refusal };
      if (!seen.cdhash) return { code: 'signature_failed', error: 'the app in the zip has no code-directory hash' };
      fs.rmSync(path.join(dir, 'app'), { recursive: true, force: true });
      const entry = (JSON.parse(feedBytes.toString('utf8')) as { releases?: { version?: unknown; updateTo?: { notes?: unknown; pub_date?: unknown } }[] })
        .releases?.find((r) => r.version === version)?.updateTo;
      const feedFile = path.join(dir, FEED_FILE);
      fs.writeFileSync(feedFile, localFeed(version, pathToFileURL(zip).href, entry), { mode: 0o600 });
      this.event('update_download', 'done', `version=${version} sha256=${actual.slice(0, 12)} team=${seen.team} cdhash=${seen.cdhash.slice(0, 12)}`);
      keep = true;
      return { version, cdhash: seen.cdhash, needsPerson: feed.needsPerson, feedUrl: pathToFileURL(feedFile).href };
    } finally {
      if (!keep) fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /** The bundle Squirrel staged must be the one verified (same code-directory hash and version); else it is removed. */
  private async checkStaged(): Promise<void> {
    emptyVerifiedCache();
    const shipIt = path.join(os.homedir(), 'Library/Caches', `${BUNDLE_ID}.ShipIt`);
    const stateFile = path.join(shipIt, 'ShipItState.plist');
    let bundle: string | null = null;
    try { bundle = stagedBundlePath(JSON.parse((await run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', stateFile])).out)); } catch { bundle = null; }
    const seen = bundle ? await inspect(bundle) : null;
    const v = this.verified;
    const refusal = !bundle || !seen ? 'the staged update could not be found'
      : !v ? 'nothing was verified before Squirrel staged an update'
      : seen.cdhash !== v.cdhash ? `the staged bundle (cdhash ${seen.cdhash ?? 'none'}) is not the verified one (${v.cdhash})`
      : stagedRefusal({ feedVersion: v.version, stagedVersion: seen.version, team: seen.team, current: app.getVersion() });
    if (refusal) {
      try {
        fs.rmSync(stateFile, { force: true });
        if (bundle && bundle.startsWith(shipIt)) fs.rmSync(path.dirname(bundle), { recursive: true, force: true });
      } catch (error) {
        this.log(`update: the refused update could not be removed: ${(error as Error).message}`);
      }
      return this.fail('signature_failed', `${refusal}; the staged update was removed`);
    }
    this.stagedBundle = bundle;
    this.event('update_check', 'ready', `version=${seen!.version}`);
    this.set({ state: 'ready', version: seen!.version ?? undefined });
    if (this.installWhenReady) { this.installWhenReady = false; this.event('update_install', 'restaged', `version=${seen!.version}`); this.onInstallWhenReady?.(); }
  }

  // #region staging-lost — docs: docs/backlog.md
  private shipItDir(): string {
    return path.join(os.homedir(), 'Library/Caches', `${BUNDLE_ID}.ShipIt`);
  }

  /** FD-75: whether the ready update's request or staged bundle has gone from disk (macOS, Squirrel only). */
  private lostStaging(): boolean {
    if (this.channel === 'appimage' || this.channel === 'nsis' || this.state.state !== 'ready') return false;
    return stagingLost({ state: this.state.state, requestExists: fs.existsSync(path.join(this.shipItDir(), 'ShipItState.plist')),
      bundleExists: this.stagedBundle ? fs.existsSync(this.stagedBundle) : null });
  }

  /** FD-75: say so, forget the ready state and download and stage the release again; `install` when the person
   *  asked to restart, so it installs as soon as it is staged. */
  private restage(install: boolean): void {
    this.event('update_check', 'staging_lost', `version=${this.state.version ?? '?'}${install ? ' asked=person' : ''}`);
    this.stagedBundle = null;
    this.installWhenReady = this.installWhenReady || install;
    this.lastQuiet = null;
    this.set({ state: 'idle' });
    this.check(install); // the person's restart counts as their check, even with automatic updates off
  }

  /** Whether Restart to update can hand Squirrel its staged update now; when it cannot, the update is staged
   *  again and installs by itself once it is (FD-75). */
  readyToInstall(): boolean {
    if (!this.lostStaging()) return this.state.state === 'ready';
    this.restage(true);
    return false;
  }

  /** FD-75: a ShipIt job left with no request relaunches every 2 s and fails; remove it at start. */
  private async removeStrayShipIt(): Promise<void> {
    const label = `${BUNDLE_ID}.ShipIt`;
    const listed = await run('/bin/launchctl', ['list', label]).catch(() => ({ code: 1, out: '' }));
    if (!strayShipIt({ requestExists: fs.existsSync(path.join(this.shipItDir(), 'ShipItState.plist')), jobLoaded: listed.code === 0, staging: this.state.state === 'downloading' })) return;
    const removed = await run('/bin/launchctl', ['remove', label]).catch(() => ({ code: 1, out: '' }));
    this.event('update_install', removed.code === 0 ? 'shipit_removed' : 'shipit_remove_failed', `label=${label} reason=no-request`);
  }
  // #endregion staging-lost

  // #region appimage-update — docs: docs/adr/0019-windows-and-linux.md#amendment-2026-10-11--updates-on-linux-fd-37-m4b
  /** A `.part` a killed download left beside this AppImage. */
  private sweepAppImageParts(): void {
    const target = process.env.APPIMAGE!;
    try {
      for (const name of fs.readdirSync(path.dirname(target))) {
        if (name.startsWith(`.${path.basename(target)}.`) && name.endsWith('.part')) fs.rmSync(path.join(path.dirname(target), name), { force: true });
      }
    } catch { /* an unreadable folder is reported when an update is written there */ }
  }

  /**
   * FD-37 M4b/M4c (PL-04 on Linux and Windows): the release's SHA256SUMS signed by the organization, its feed as
   * SHA256SUMS names it, this platform's file as both name it, then the file's own hash. Linux: the new AppImage
   * replaces this file; the next start runs it. Windows: the verified installer waits in the app's data and runs
   * once the app quits. `person`: Install now on a held release.
   */
  private async prepareFile(version: string, person: boolean): Promise<void> {
    const nsis = this.channel === 'nsis';
    const target = nsis ? '' : process.env.APPIMAGE!;
    const key = platformKey(process.platform, process.arch);
    this.set({ state: 'downloading', version });
    const get = async (name: string) => {
      const res = await net.fetch(releaseFile(version, name), { cache: 'no-store', signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`${name} answered HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    };
    let sums: Buffer;
    let asc: string;
    let feedBytes: Buffer;
    try { [sums, asc, feedBytes] = [await get('SHA256SUMS'), (await get('SHA256SUMS.asc')).toString('utf8'), await get(FEED_FILE)]; } catch (error) { return this.fail('download_failed', (error as Error).message); }
    const signed = await sumsSignedByRelease(sums, asc);
    if (!signed.ok) return this.fail('signature_failed', `SHA256SUMS of ${version} is not signed by the organization: ${signed.why}`);
    const listed = parseSums(sums.toString('utf8'));
    const feed = signedFeed(feedBytes, listed, version);
    if (!feed.ok) return this.fail('signature_failed', feed.why);
    const mine = platformUpdate(JSON.parse(feedBytes.toString('utf8')), key, version);
    if (!mine.ok) return this.fail('signature_failed', mine.why);
    const expected = listed.get(mine.file);
    if (!expected || expected !== mine.sha256) return this.fail('signature_failed', `SHA256SUMS of ${version} gives ${mine.file} ${expected ?? 'no'} sha256, the feed ${mine.sha256}`);
    if (feed.needsPerson && !person) {
      this.heldFile = version;
      this.event('update_check', 'needs_migration', `version=${version}`);
      this.set({ state: 'held', version, steps: feed.needsPerson });
      return;
    }
    const pending = path.join(this.dataDir, PENDING_UPDATE_DIR);
    if (nsis) { fs.rmSync(pending, { recursive: true, force: true }); fs.mkdirSync(pending, { recursive: true }); }
    const staged = nsis ? path.join(pending, mine.file) : stagedAppImage(target, version);
    // A folder this user cannot write fails now, not after a download.
    if (!nsis) { try { fs.accessSync(path.dirname(target), fs.constants.W_OK); } catch { return this.fail('download_failed', `the folder of this AppImage (${path.dirname(target)}) is not writable: the update cannot replace it`); } }
    this.event('update_download', 'started', `version=${version} file=${mine.file}`);
    let actual: string;
    try {
      fs.rmSync(staged, { force: true });
      actual = await downloadTo(releaseFile(version, mine.file), staged, DOWNLOAD_TIMEOUT_MS);
    } catch (error) {
      fs.rmSync(staged, { force: true });
      return this.fail('download_failed', `the update could not be written to ${path.dirname(staged)}: ${(error as Error).message}`);
    }
    if (actual !== expected) {
      fs.rmSync(staged, { force: true });
      return this.fail('signature_failed', `${mine.file} has sha256 ${actual}, SHA256SUMS says ${expected}`);
    }
    if (nsis) {
      this.pendingInstaller = { file: staged, sha256: actual };
    } else {
      try {
        replaceAppImage(target, staged);
      } catch (error) {
        return this.fail('download_failed', `${target} could not be replaced: ${(error as Error).message}`);
      }
    }
    this.heldFile = null;
    this.event('update_download', 'done', `version=${version} sha256=${actual.slice(0, 12)} ${nsis ? `installer=${staged}` : `replaced=${target}`}`);
    this.event('update_check', 'ready', `version=${version}`);
    this.set({ state: 'ready', version });
  }
  // #endregion appimage-update

  /** Install now: a ready update restarts into the new version; a held one is handed to Squirrel. */
  restart(): boolean {
    if (this.channel === 'appimage' || this.channel === 'nsis') {
      if (this.state.state === 'held' && this.heldFile) {
        this.event('update_restart', 'requested', `version=${this.heldFile} held=yes`);
        void this.prepareFile(this.heldFile, true);
        return true;
      }
      if (this.state.state !== 'ready') {
        this.event('update_restart', 'refused', `state=${this.state.state}`);
        return false;
      }
      this.event('update_restart', 'requested', `version=${this.state.version ?? '?'}`);
      if (this.channel === 'nsis') {
        // A waiter runs the installer once this app has exited, after checking its hash again (nsisUpdateCommand);
        // the app quits only once the waiter has started, so a waiter that cannot start leaves the app running.
        const pending = this.pendingInstaller;
        let now = '';
        try { if (pending) now = createHash('sha256').update(fs.readFileSync(pending.file)).digest('hex'); } catch { now = ''; }
        if (!pending || now !== pending.sha256) {
          this.pendingInstaller = null;
          this.fail('signature_failed', 'the verified installer is gone or changed since it was checked; it is downloaded again');
          return false;
        }
        const cmd = nsisUpdateCommand(pending.file, pending.sha256, process.pid);
        // A grandchild outside this app's job, or Windows kills it when the app exits (src/core/after-exit.ts); the
        // app quits only once it runs.
        powerShellAfterExit(cmd.script, windowsPowerShellEnv()).then(() => {
          this.event('update_install', 'started', `version=${this.state.version ?? '?'}`);
          this.onQuitForUpdate();
          app.quit();
        }, (error: Error) => this.fail('download_failed', `the installer could not start: ${error.message}`));
        return true;
      }
      this.event('update_install', 'started', `version=${this.state.version ?? '?'}`);
      // The new AppImage is already in place: starting it again is the install. A system shell outside the image
      // waits for this process to exit and starts it (appImageRelaunchCommand); the app quits once the shell runs.
      const relaunch = appImageRelaunchCommand(process.pid, process.env.APPIMAGE!, process.argv.slice(1));
      const shell = spawnAfterExit(relaunch.file, relaunch.args);
      shell.once('error', (error) => this.fail('download_failed', `the new AppImage could not be started: ${error.message}`));
      shell.once('spawn', () => {
        this.onQuitForUpdate();
        app.quit();
      });
      return true;
    }
    if (this.state.state === 'held' && this.verified) {
      this.event('update_restart', 'requested', `version=${this.verified.version} held=yes`);
      this.set({ state: 'downloading', version: this.verified.version });
      this.stage();
      return true;
    }
    if (this.state.state !== 'ready') {
      this.event('update_restart', 'refused', `state=${this.state.state}`);
      return false;
    }
    if (!this.readyToInstall()) return false; // FD-75: staged again; it installs by itself once ready
    this.event('update_restart', 'requested', `version=${this.state.version ?? '?'}`);
    autoUpdater.quitAndInstall();
    return true;
  }

  private fail(code: string, error: string): void {
    this.lastQuiet = null; // the next quiet check after a failure is logged: it says the failure is over
    this.event('update_check', code, error.replace(/\s+/g, ' ').slice(0, 300));
    this.set({ state: 'error', error });
    // One retry at the check's own pace (5 minutes), then the regular checks go on.
    if (!this.retry) {
      this.retry = setTimeout(() => { this.retry = null; if (this.state.state === 'error') this.check(); }, RETRY_AFTER_FAILURE_MS);
      this.retry.unref();
    }
  }

  private set(state: UpdateState): void {
    if (this.stuck) { clearTimeout(this.stuck); this.stuck = null; }
    if (state.state === 'checking' || state.state === 'downloading') {
      const at = state.state;
      this.stuck = setTimeout(() => {
        this.stuck = null;
        if (this.state.state === at) this.fail(at === 'checking' ? 'check_failed' : 'download_failed', `no progress for ${STUCK_MS / 60_000} minutes`);
      }, STUCK_MS);
      this.stuck.unref();
    }
    this.state = state;
    this.onChange();
  }
}
