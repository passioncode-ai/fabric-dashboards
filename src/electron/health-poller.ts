// #region agent-health — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-11-16-agent-health-reports-become-episodes-fd-285
// FD-285: reads each product's `agent-health/1` report every 5 minutes (first 60 s after start) and hands it to the
// outage alerts, which hold the episodes and send what they owe. A product not installed here, or too old to have the
// command, is not read at all: it is no unreadable report. One read at a time; nothing runs after quit.
// FD-293: then each answering service, asked for its report over HTTP (`HEALTH_PATH`); one that
// has never answered a report there (a 404, a refused token, a page) is asked again only an hour later, said once.
import { HEALTH_NONE_RETRY_MS, HEALTH_PATH, HEALTH_POLL_MS, HEALTH_PRODUCTS, healthAnswerOf, healthCommandMissing, servesReport, type HealthProduct } from '../core/agent-health';
import type { RunResult } from '../core/launchd';

/** FD-293: one service to read over HTTP on this pass. */
/** FD-293: one service read over HTTP; `wellKnown` its last well-known answer, read beside the report (HL-7, FD-297). */
export interface HealthServiceRead { key: string; expected: string; known: boolean; read: () => Promise<unknown>; wellKnown?: () => { status?: unknown; degraded?: unknown } | null }

const FIRST_MS = 60_000;
const DEADLINE_MS = 15_000;

export class HealthPoller {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private running = false;
  /** The products whose program has no `health` command, said once in the log. */
  private missing = new Set<string>();
  /** FD-293: the services that answered no report, with when to ask again; each said once in the log. */
  private none = new Map<string, number>();
  private said = new Set<string>();

  constructor(private readonly o: {
    binary: (p: HealthProduct) => Promise<string | null>;
    run: (file: string, args: string[], timeoutMs: number) => Promise<RunResult>;
    observe: (product: string, answer: unknown, expected?: string, wellKnown?: { status?: unknown; degraded?: unknown } | null) => void;
    log: (line: string) => void;
    products?: readonly HealthProduct[];
    /** FD-293: the services to read over HTTP now: their service key, the product their report must name, whether the
     *  book already holds them (`known`), and the read (`undefined`: no report there, `null`: no answer). */
    services?: () => readonly HealthServiceRead[];
    now?: () => number;
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
      let services: readonly HealthServiceRead[] = [];
      try { services = this.o.services?.() ?? []; } catch (error) { this.o.log(`health: the services could not be listed: ${(error as Error).message}`); }
      const now = this.o.now ?? Date.now;
      for (const s of services) {
        if (this.stopped) return;
        if (!s.known && (this.none.get(s.key) ?? 0) > now()) continue;
        let answer: unknown;
        try { answer = await s.read(); } catch { answer = null; }
        // a service that has never answered a report: no report, asked again later; a known one that stops is blind
        if (!s.known && !servesReport(answer, s.expected)) {
          if (!this.said.has(s.key)) this.o.log(`health: ${s.key} serves no report at ${HEALTH_PATH}; asked again in an hour`);
          this.said.add(s.key);
          this.none.set(s.key, now() + HEALTH_NONE_RETRY_MS);
          continue;
        }
        this.none.delete(s.key);
        this.said.delete(s.key);
        this.o.observe(s.key, answer, s.expected, s.wellKnown?.() ?? null);
      }
    } finally {
      this.running = false;
    }
  }
}
// #endregion agent-health
