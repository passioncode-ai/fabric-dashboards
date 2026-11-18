// FD-310 step 2 (decision D-5 of the 2026-11-17 refactor plan): what limit recovery knows between two reads, out of
// ConsoleHost, as HandoverBook did for the hand-overs: the stops of the last read, what this launch did with each, why
// each waits, and the status the Sessions list shows. Pure: the host reads Switchboard and acts; this keeps the state.
import { degradedSince, type SourceDegraded } from './sessions';
import type { SbStop } from './recovery';
import type { HeldContinue, RecoveryStatus, StopView } from './types';

/** P2-06: a stop acted on stays in the view a day after it stopped once Switchboard no longer lists it. */
export const ACTED_KEEP_MS = 24 * 60 * 60_000;

export class RecoveryBook {
  /** FD-83: stops this launch acted on (continued, or failed to), by event; each is acted on once. */
  readonly acted = new Map<string, StopView>();
  /** FD-233: the reason each stop last waited for room (LC-17), so a stop that keeps waiting is logged once per reason. */
  private readonly waitNoted = new Map<string, string>();
  /** FD-288: what each ready stop waits for on this Mac (LC-17), shown on its session's row and page. */
  readonly held = new Map<string, HeldContinue>();
  /** FD-103: the stops of the last read, by event, for Continue now. */
  readonly last = new Map<string, SbStop>();
  /** R1-U6: an unreadable recovery since its first failure, like the hand-overs'. */
  degraded: SourceDegraded | null = null;
  status: RecoveryStatus = { on: true, stops: [], resumed: 0 };

  /** A read that listed `stops`: what is no longer listed forgets why it waited, and a stop acted on goes a day after it
   *  stopped once it is not listed (P2-06). Returns the stops still to look at: not resumed, not acted on, not taken. */
  read(stops: SbStop[], now: number, taking: (event: string) => boolean): SbStop[] {
    this.degraded = null;
    this.last.clear();
    for (const s of stops) this.last.set(s.event, s);
    for (const e of [...this.waitNoted.keys()]) if (!this.last.has(e)) this.waitNoted.delete(e);
    for (const e of [...this.held.keys()]) if (!this.last.has(e)) this.held.delete(e);
    for (const [e, v] of [...this.acted]) if (!this.last.has(e) && now - v.stoppedAt > ACTED_KEEP_MS) this.acted.delete(e);
    return stops.filter((s) => s.state !== 'resumed' && !this.acted.has(s.event) && !taking(s.event));
  }

  /** A read that failed: degraded since its first failure. */
  unreadable(unavailable: 'old' | 'error', detail: string, now: number): void {
    this.degraded = degradedSince(this.degraded, 'recovery', unavailable, detail.slice(0, 300), now);
  }

  /** FD-233: whether a stop waiting for `why` is worth a log line (the first time, or a new reason); remembers it. */
  noteWait(event: string, why: string): boolean {
    const fresh = this.waitNoted.get(event) !== why;
    this.waitNoted.set(event, why);
    return fresh;
  }

  /** Why the stop last waited on this Mac, if it did. */
  waitingFor(event: string): string | undefined { return this.waitNoted.get(event); }

  /** The stop no longer waits on this Mac. */
  clearWait(event: string): void {
    this.waitNoted.delete(event);
    this.held.delete(event);
  }

  /** The status shown: what this launch acted on first, then the other views. True when it changed. */
  set(next: RecoveryStatus): boolean {
    const changed = JSON.stringify(next) !== JSON.stringify(this.status);
    this.status = next;
    return changed;
  }

  /** F2 of FIX-2: the views with what this launch did replacing each listed one at once, not at the next read. */
  withActed(views: StopView[]): StopView[] {
    return [...this.acted.values(), ...views.filter((v) => !this.acted.has(v.event))];
  }
}
