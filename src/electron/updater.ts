// App self-update (SCN-022): Squirrel.Mac through Electron's autoUpdater with a
// JSON feed published beside each GitHub release. It needs a signed, packaged
// app; an unpackaged run reports `unsupported` instead of pretending.
import { app, autoUpdater } from 'electron';
import type { AppStatus } from '../core/types';

export const DEFAULT_FEED = 'https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json';
const EVERY_MS = 6 * 60 * 60 * 1000;

export type UpdateState = AppStatus['update'];

export class Updater {
  state: UpdateState = { state: 'idle' };
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly onChange: () => void, private readonly log: (message: string) => void) {}

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
    setTimeout(() => this.check(), 10_000).unref();
    this.timer = setInterval(() => this.check(), EVERY_MS);
    this.timer.unref();
  }

  check(): void {
    if (['unsupported', 'misplaced', 'downloading', 'ready'].includes(this.state.state)) return;
    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      this.set({ state: 'error', error: (error as Error).message });
    }
  }

  /** Installs the downloaded update; Squirrel also installs it on the next normal quit. */
  restart(): void {
    if (this.state.state === 'ready') autoUpdater.quitAndInstall();
  }

  private set(state: UpdateState): void {
    this.state = state;
    if (state.state === 'error') this.log(`update: ${state.error}`);
    this.onChange();
  }
}
