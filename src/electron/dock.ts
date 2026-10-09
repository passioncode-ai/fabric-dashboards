// #region dock-follows-window — docs: AGENTS.md#lifecycle
// FD-05: the Dock icon is shown only while the window is. Pure, so it is tested without Electron
// (test/dock.test.ts).
//
// FD-35: one hide() is not enough. Electron 44 (`shell/browser/browser_mac.mm:441-504`) makes
// DockHide a no-op within 1 s of DockShow, an active app's show transforms at +1 s and resolves at
// +2 s, and isVisible() reads NSRunningApplication's activationPolicy, which macOS updates only
// after the run loop turns — so a read right after a dropped hide can say "hidden" while the icon
// stays (full e2e runs on 2026-10-08 and 2026-10-09, under load). So: the time of the last show is
// kept and a hide waits out the 1-second guard first; the state is read only after a settle pause;
// the wanted state is re-read after every show; a hide is asked again until the Dock reports it
// hidden — a bounded number of times, and never once the window is back.

export interface DockApi {
  show(): Promise<void> | void;
  hide(): void;
  isVisible(): boolean;
}

export interface DockSyncOptions {
  /** How many times a hide is asked before giving up. */
  tries: number;
  /** The pause after an ask before the Dock's state is read (and between two asks). */
  retryMs: number;
  /** Electron ignores a hide this soon after a show (1 s in browser_mac.mm), plus a margin. */
  showGuardMs: number;
}

const DEFAULTS: DockSyncOptions = { tries: 25, retryMs: 200, showGuardMs: 1100 };

export class DockSync {
  private wanted = true;
  private lastShowAt = Number.NEGATIVE_INFINITY;
  private readonly opts: DockSyncOptions;

  constructor(
    private readonly dock: DockApi | undefined,
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    opts: Partial<DockSyncOptions> = {},
    private readonly now: () => number = Date.now,
  ) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  /**
   * Makes the Dock follow `visible`. Resolves true once the Dock matches, false when it did not
   * within the bounded tries or a newer wish replaced this one — never a silent success.
   */
  async want(visible: boolean): Promise<boolean> {
    this.wanted = visible;
    const dock = this.dock;
    if (!dock) return true;
    if (!visible) return this.hide(dock);
    if (dock.isVisible()) return true; // already there: a pending show would only race a later hide
    this.lastShowAt = this.now();
    await dock.show();
    if (!this.wanted) return this.hide(dock); // a hide landed while the show settled
    await this.wait(this.opts.retryMs); // activationPolicy is read after it has settled
    if (!this.wanted) return this.hide(dock);
    return dock.isVisible();
  }

  private async hide(dock: DockApi): Promise<boolean> {
    for (let i = 0; i < this.opts.tries; i += 1) {
      if (this.wanted) return false; // the window came back: a show owns the Dock now
      const sinceShow = this.now() - this.lastShowAt;
      if (sinceShow < this.opts.showGuardMs) await this.wait(this.opts.showGuardMs - sinceShow); // a hide inside the guard is dropped
      if (this.wanted) return false;
      dock.hide();
      await this.wait(this.opts.retryMs); // never trust a read made before activationPolicy settles
      if (this.wanted) return false;
      if (!dock.isVisible()) return true;
    }
    return false;
  }
}
// #endregion dock-follows-window
