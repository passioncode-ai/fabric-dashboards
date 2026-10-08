// #region dock-follows-window — docs: AGENTS.md#lifecycle
// FD-05: the Dock icon is shown only while the window is. Pure, so it is tested without Electron
// (test/dock.test.ts).
//
// FD-35: one hide() is not enough. dock.show() resolves later, and macOS drops a hide asked for
// while a show is still settling (a full e2e run on 2026-10-08 left the icon for 10 s after the
// window hid). So the wanted state is re-read after every show, and a hide is asked again until
// the Dock reports it hidden — a bounded number of times, and never once the window is back.

export interface DockApi {
  show(): Promise<void> | void;
  hide(): void;
  isVisible(): boolean;
}

export interface DockSyncOptions {
  /** How many times a hide is asked before giving up. */
  tries: number;
  /** The pause between two asks. */
  retryMs: number;
}

const DEFAULTS: DockSyncOptions = { tries: 25, retryMs: 200 };

export class DockSync {
  private wanted = true;
  private readonly opts: DockSyncOptions;

  constructor(
    private readonly dock: DockApi | undefined,
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    opts: Partial<DockSyncOptions> = {},
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
    await dock.show();
    if (!this.wanted) return this.hide(dock); // a hide landed while the show settled
    return dock.isVisible();
  }

  private async hide(dock: DockApi): Promise<boolean> {
    for (let i = 0; i < this.opts.tries; i += 1) {
      if (this.wanted) return false; // the window came back: a show owns the Dock now
      dock.hide();
      if (!dock.isVisible()) return true;
      if (i < this.opts.tries - 1) await this.wait(this.opts.retryMs);
    }
    return false;
  }
}
// #endregion dock-follows-window
