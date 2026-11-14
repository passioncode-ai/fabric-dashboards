// #region ipc-guard — docs: SECURITY.md#what-the-app-touches
// FD-259 (security audit F7): every IPC handler answers only the app's own page, in its main frame. Only the window and
// the console drawer load the preload today, so nothing else can call; this keeps it true if a page ever gets one by
// mistake (a service view, a subframe, a page navigated away from the app's file).

/** Whether a call comes from the app's own renderer: its main frame, on the app's own index file (any query or hash). */
export function trustedSender(frameUrl: string | undefined, isMainFrame: boolean, indexUrl: string): boolean {
  if (!isMainFrame || !frameUrl) return false;
  try {
    const a = new URL(frameUrl);
    const b = new URL(indexUrl);
    return a.protocol === 'file:' && a.protocol === b.protocol && decodeURIComponent(a.pathname) === decodeURIComponent(b.pathname);
  } catch {
    return false;
  }
}

/** FD-259 (F9): a page may ask for one dialog at a time and not again within `gapMs` of the last one it asked for, so a
 *  dashboard cannot stack external-link or save dialogs over the window. */
export class DialogGate {
  private readonly open = new Set<string>();
  private readonly last = new Map<string, number>();
  constructor(private readonly gapMs = 2000, private readonly now: () => number = Date.now) {}
  /** Takes the gate for `key`, or false when one is open or the last was too recent. Call `done(key)` when it closes. */
  take(key: string): boolean {
    const at = this.now();
    if (this.open.has(key) || at - (this.last.get(key) ?? -Infinity) < this.gapMs) return false;
    this.open.add(key);
    this.last.set(key, at);
    return true;
  }
  done(key: string): void {
    this.open.delete(key);
    this.last.set(key, this.now());
  }
}
// #endregion ipc-guard
