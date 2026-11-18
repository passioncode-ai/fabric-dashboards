// FD-310, step 1 (decision D-5 of the 2026-11-17 refactor plan): the state limit recovery and quit share about the
// stops this launch takes up, out of ConsoleHost. F2 of FIX-2: one stop is taken up by one path at a time. F3 of FIX-2
// and FIX-4: a quit waits for the continues in flight, then finishes as cancelled every stop claimed and not finished,
// and every claim still on the wire, so no stop is left claimed by an app that is gone.
import type { SbStop } from './recovery';

export type ClaimOutcome = 'resumed' | 'cancelled';
export type OpenClaim = { stop: SbStop; sb: string; outcome?: ClaimOutcome };

export class StopClaims {
  /** Stops being taken up now, marked before the claim, so a second press or the background pass never takes one twice. */
  private readonly taking = new Set<string>();
  /** The continues in flight, which a quit waits for. */
  private readonly inFlight = new Set<Promise<unknown>>();
  /** Stops claimed and not finished yet; `outcome` when a finish Switchboard did not take is to be tried again. */
  private readonly claimedOpen = new Map<string, OpenClaim>();
  /** Stops whose `recovery claim` is on the wire now. */
  private readonly claiming = new Map<string, { stop: SbStop; sb: string }>();

  isTaking(event: string): boolean { return this.taking.has(event); }

  /** What a quit still waits for: continues in flight, claims on the wire and stops claimed and not finished. */
  work(): number { return this.inFlight.size + this.claimedOpen.size + this.claiming.size; }

  /** The stop is taken up by this path until `work` settles; the promise is kept for the quit to wait on. */
  track<T>(event: string, work: () => Promise<T>): Promise<T> {
    this.taking.add(event);
    const p = work();
    this.inFlight.add(p);
    const done = () => { this.taking.delete(event); this.inFlight.delete(p); };
    p.then(done, done);
    return p;
  }

  /** Runs a claim with the stop marked as on the wire, so a quit in the meantime cancels it too. */
  async claim<T>(stop: SbStop, sb: string, send: () => Promise<T>): Promise<T> {
    this.claiming.set(stop.event, { stop, sb });
    try { return await send(); } finally { this.claiming.delete(stop.event); }
  }

  /** A claim Switchboard took: the stop is open until it is finished. */
  claimed(stop: SbStop, sb: string): void { this.claimedOpen.set(stop.event, { stop, sb }); }

  /** A finish Switchboard took closes the stop; one it did not take keeps it, with the outcome meant, for the quit. */
  finished(stop: SbStop, sb: string, outcome: ClaimOutcome, done: boolean): void {
    if (done) this.claimedOpen.delete(stop.event);
    else this.claimedOpen.set(stop.event, { stop, sb, outcome });
  }

  /** The continues in flight now, for the quit to wait on. */
  running(): Promise<unknown>[] { return [...this.inFlight]; }

  /** Every stop a quit finishes: the claims on the wire and the stops claimed and not finished, each once. */
  open(): OpenClaim[] { return [...new Map<string, OpenClaim>([...this.claiming, ...this.claimedOpen]).values()]; }
}
