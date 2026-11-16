// #region agent-health — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-11-16-agent-health-reports-become-episodes-fd-285
// FD-285: reads each product's `agent-health/1` report every 5 minutes (first 60 s after start) and hands it to the
// outage alerts, which hold the episodes and send what they owe. A product not installed here, or too old to have the
// command, is not read at all: it is no unreadable report. One read at a time; nothing runs after quit.
import { HEALTH_POLL_MS, HEALTH_PRODUCTS, healthAnswerOf, healthCommandMissing, type HealthProduct } from '../core/agent-health';
import type { RunResult } from '../core/launchd';

const FIRST_MS = 60_000;
const DEADLINE_MS = 15_000;

export class HealthPoller {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private running = false;
  /** The products whose program has no `health` command, said once in the log. */
  private missing = new Set<string>();

  constructor(private readonly o: {
    binary: (p: HealthProduct) => Promise<string | null>;
    run: (file: string, args: string[], timeoutMs: number) => Promise<RunResult>;
    observe: (product: string, answer: unknown) => void;
    log: (line: string) => void;
    products?: readonly HealthProduct[];
  }) {}

  start(): void { this.arm(FIRST_MS); }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private arm(ms: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => { this.timer = null; void this.pass().finally(() => this.arm(HEALTH_POLL_MS)); }, ms);
    this.timer.unref();
  }

  /** One read of every product; exported for the tests through `pass`. */
  async pass(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      for (const p of this.o.products ?? HEALTH_PRODUCTS) {
        if (this.stopped) return;
        let file: string | null;
        try { file = await this.o.binary(p); } catch { file = null; }
        if (!file) continue;
        let r: RunResult;
        try { r = await this.o.run(file, [...p.argv], DEADLINE_MS); } catch (error) {
          this.o.log(`health: ${p.product} could not be run: ${(error as Error).message}`);
          this.o.observe(p.product, null);
          continue;
        }
        if (healthCommandMissing(r.code, `${r.stdout}\n${r.stderr}`)) {
          if (!this.missing.has(p.product)) this.o.log(`health: ${p.product} has no health command yet; not read`);
          this.missing.add(p.product);
          continue;
        }
        this.missing.delete(p.product);
        this.o.observe(p.product, r.code === 0 ? healthAnswerOf(r.stdout) : null);
      }
    } finally {
      this.running = false;
    }
  }
}
// #endregion agent-health
