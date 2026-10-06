// App self-update (SCN-022): Squirrel.Mac through Electron's autoUpdater with a
// JSON feed published beside each GitHub release. It needs a signed, packaged
// app; an unpackaged run reports `unsupported` instead of pretending.
import { app, autoUpdater, net } from 'electron';
import { isNewer } from '../core/version';
import type { AppStatus } from '../core/types';

export const DEFAULT_FEED = 'https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json';
const EVERY_MS = 6 * 60 * 60 * 1000;
const FEED_TIMEOUT_MS = 20_000;

export type UpdateState = AppStatus['update'];

export class Updater {
  state: UpdateState = { state: 'idle' };
  private url = DEFAULT_FEED;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly onChange: () => void,
    private readonly log: (message: string) => void,
    /** Squirrel is about to close the windows and quit to install: the window must let itself close (R-3). */
    private readonly onQuitForUpdate: () => void = () => undefined,
  ) {}

  start(): void {
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
    const url = process.env.FABRIC_DASHBOARDS_UPDATE_URL || DEFAULT_FEED;
    this.url = url;
    try {
      autoUpdater.setFeedURL({ url, serverType: 'json' });
    } catch (error) {
      this.set({ state: 'error', error: (error as Error).message });
      return;
    }
    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }));
    autoUpdater.on('update-available', () => this.set({ state: 'downloading' }));
    autoUpdater.on('update-not-available', () => this.set({ state: 'idle', checkedAt: new Date().toISOString() }));
    autoUpdater.on('update-downloaded', (_event, _notes, name) => this.set({ state: 'ready', version: String(name || '').replace(/^Fabric Dashboards\s*/, '') || undefined }));
    autoUpdater.on('error', (error) => this.set({ state: 'error', error: error.message }));
    autoUpdater.on('before-quit-for-update', () => this.onQuitForUpdate());
    setTimeout(() => this.check(), 10_000).unref();
    this.timer = setInterval(() => this.check(), EVERY_MS);
    this.timer.unref();
  }

  /** F-1: the feed's version is read first; Squirrel is asked only for a newer one, so an older
   *  release published by mistake can never move an installed copy backwards. */
  check(): void {
    if (['unsupported', 'misplaced', 'downloading', 'ready', 'checking'].includes(this.state.state)) return;
    this.set({ state: 'checking' });
    void this.newerInFeed().then((verdict) => {
      if (verdict === 'newer') {
        try {
          autoUpdater.checkForUpdates();
        } catch (error) {
          this.set({ state: 'error', error: (error as Error).message });
        }
      } else if (verdict === 'same-or-older') {
        this.set({ state: 'idle', checkedAt: new Date().toISOString() });
      } else {
        this.set({ state: 'error', error: verdict.error });
      }
    });
  }

  private async newerInFeed(): Promise<'newer' | 'same-or-older' | { error: string }> {
    try {
      // A feed that never answers must not leave the state at checking, which blocks every later check.
      const res = await net.fetch(this.url, { cache: 'no-store', signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
      if (!res.ok) return { error: `the update feed answered HTTP ${res.status}` };
      const feed = (await res.json()) as { currentRelease?: unknown };
      if (typeof feed.currentRelease !== 'string') return { error: 'the update feed names no release' };
      if (isNewer(feed.currentRelease, app.getVersion())) return 'newer';
      if (feed.currentRelease !== app.getVersion()) this.log(`update: the feed names ${feed.currentRelease}, older than ${app.getVersion()}; not installed`);
      return 'same-or-older';
    } catch (error) {
      return { error: `the update feed could not be read: ${(error as Error).message}` };
    }
  }

  /** Installs the downloaded update; Squirrel also installs it on the next normal quit. Returns
   *  whether an install started — nothing is ready, nothing happens, and the app keeps running. */
  restart(): boolean {
    if (this.state.state !== 'ready') return false;
    autoUpdater.quitAndInstall();
    return true;
  }

  private set(state: UpdateState): void {
    this.state = state;
    if (state.state === 'error') this.log(`update: ${state.error}`);
    this.onChange();
  }
}
