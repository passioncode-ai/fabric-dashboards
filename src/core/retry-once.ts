// #region retry-once — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#lc-16
/**
 * LC-16's one retry after a failed update check (FD-178). Armed by a failure, at most one pending; cancelled when any
 * check starts, so the regular 5-minute check and the retry never both read the feed: before FD-178 the retry fired a
 * fraction of a second after the regular check that had already failed again, and each of its own failures armed the
 * next one, so every 5 minutes of a failing feed read it twice.
 */
export class RetryOnce {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ms: number, private readonly fire: () => void) {}

  /** A check failed: retry once after `ms`, unless a retry already waits. */
  arm(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.fire(); }, this.ms);
    (this.timer as { unref?: () => void }).unref?.();
  }

  /** A check starts: whatever retry waits is no longer needed. */
  cancel(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  get armed(): boolean { return this.timer !== null; }
}
// #endregion retry-once
