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
import { feedNamesOwnRelease, parseSums, releaseFile, sumsSignedByRelease, zipName } from '../core/release-verify';
import { CHECK_EVERY_MS, FIRST_CHECK_MS, isNewer, mayCheck, stagedBundlePath, stagedRefusal } from '../core/version';
import type { AppStatus } from '../core/types';

/** The one feed this app reads: pinned, never taken from the environment. */
export const DEFAULT_FEED = 'https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json';
const FEED_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000;
const RETRY_AFTER_FAILURE_MS = 45 * 60_000;
const BUNDLE_ID = 'ai.passioncode.fabric-dashboards';

export type UpdateState = AppStatus['update'];
type Feed = { currentRelease?: unknown; needsPerson?: unknown };
type Verified = { version: string; cdhash: string };

function run(file: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 120_000, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ code: error ? 1 : 0, out: `${stdout ?? ''}${stderr ?? ''}` });
    });
  });
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
  state: UpdateState = { state: 'idle' };
  private timer: NodeJS.Timeout | null = null;
  private retry: NodeJS.Timeout | null = null;
  private verified: Verified | null = null;

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
    if (!app.isPackaged || process.platform !== 'darwin') {
      this.state = { state: 'unsupported' };
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
    autoUpdater.on('update-available', () => { this.event('update_download', 'started', `version=${this.verified?.version ?? '?'} by=squirrel`); this.set({ state: 'downloading', version: this.verified?.version }); });
    autoUpdater.on('update-not-available', () => { this.event('update_check', 'current', `version=${app.getVersion()} by=squirrel`); this.set({ state: 'idle', checkedAt: new Date().toISOString() }); });
    autoUpdater.on('update-downloaded', () => void this.checkStaged());
    autoUpdater.on('error', (error) => this.fail(this.state.state === 'downloading' ? 'download_failed' : 'check_failed', error.message));
    autoUpdater.on('before-quit-for-update', () => { this.event('update_install', 'started', `version=${this.state.version ?? '?'}`); this.onQuitForUpdate(); });
    this.switched(this.enabled());
    setTimeout(() => this.check(), FIRST_CHECK_MS).unref();
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS);
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
      this.event('update_check', 'current', `version=${app.getVersion()} feed=${version}${manual ? ' asked=person' : ''}`);
      this.set({ state: 'idle', checkedAt: new Date().toISOString() });
      return;
    }
    if (!feedNamesOwnRelease(feed, version)) return this.fail('signature_failed', `the feed for ${version} names a file outside its own release`);
    this.set({ state: 'downloading', version });
    const verified = await this.verify(version);
    if ('error' in verified) return this.fail(verified.code, verified.error);
    this.verified = verified;
    const steps = typeof feed.needsPerson === 'string' && /^https:\/\//.test(feed.needsPerson) ? feed.needsPerson : null;
    if (steps) {
      this.event('update_check', 'needs_migration', `version=${version}`);
      this.set({ state: 'held', version, steps });
      return;
    }
    this.stage();
  }

  /** Hand the verified release to Squirrel; the bundle it stages is checked against what was verified. */
  private stage(): void {
    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      this.fail('download_failed', (error as Error).message);
    }
  }

  /** The release's own files, verified end to end, before Squirrel touches anything. */
  private async verify(version: string): Promise<Verified | { code: string; error: string }> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-update-'));
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
      const expected = parseSums(sums.toString('utf8')).get(zipName(version));
      if (!expected) return { code: 'signature_failed', error: `SHA256SUMS of ${version} names no ${zipName(version)}` };
      this.event('update_download', 'started', `version=${version}`);
      const zip = path.join(dir, zipName(version));
      let actual: string;
      try {
        const res = await net.fetch(releaseFile(version, zipName(version)), { cache: 'no-store', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!res.ok || !res.body) throw new Error(`${zipName(version)} answered HTTP ${res.status}`);
        const hash = createHash('sha256');
        const out = fs.createWriteStream(zip, { mode: 0o600 });
        // A write error (a full disk, no permission) ends the wait for `drain` instead of hanging it.
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
        actual = hash.digest('hex');
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
      this.event('update_download', 'done', `version=${version} sha256=${actual.slice(0, 12)} team=${seen.team} cdhash=${seen.cdhash.slice(0, 12)}`);
      return { version, cdhash: seen.cdhash };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  /** The bundle Squirrel staged must be the one verified (same code-directory hash and version); else it is removed. */
  private async checkStaged(): Promise<void> {
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
    this.event('update_check', 'ready', `version=${seen!.version}`);
    this.set({ state: 'ready', version: seen!.version ?? undefined });
  }

  /** Install now: a ready update restarts into the new version; a held one is handed to Squirrel. */
  restart(): boolean {
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
    this.event('update_restart', 'requested', `version=${this.state.version ?? '?'}`);
    autoUpdater.quitAndInstall();
    return true;
  }

  private fail(code: string, error: string): void {
    this.event('update_check', code, error.replace(/\s+/g, ' ').slice(0, 300));
    this.set({ state: 'error', error });
    // One retry within the hour, then back to the 6-hour rhythm.
    if (!this.retry) {
      this.retry = setTimeout(() => { this.retry = null; if (this.state.state === 'error') this.check(); }, RETRY_AFTER_FAILURE_MS);
      this.retry.unref();
    }
  }

  private set(state: UpdateState): void {
    this.state = state;
    this.onChange();
  }
}
