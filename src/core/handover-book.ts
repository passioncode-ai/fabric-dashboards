// FD-62, FD-69, FD-103 (refactor wave 7, FD-307): what the console host knows of Switchboard's hand-overs between two
// reads, out of ConsoleHost: which offers were seen (each is acted on once), whether the list can be read, and whether
// hand-overs open in this app at all. Pure: the host reads Switchboard and acts; this decides what each read means.
import { degradedSince, type PendingHandover, type SourceDegraded } from './sessions';
import type { SbHandover, SbHandovers } from './switchboard';

/** At most this many offers are remembered as seen; the oldest is forgotten first. */
export const SEEN_HANDOVERS_MAX = 512;

export interface HandoverRead {
  /** A line for the log when the list's readability changed, else null. */
  log: string | null;
  /** The offers not seen before, in Switchboard's order: `expired` ones lapsed before this app saw them. */
  fresh: { handover: SbHandover; expired: boolean }[];
}

export class HandoverBook {
  private readonly seen = new Set<string>();
  /** Why the list cannot be read now ('old' or 'error'), null while it can. */
  unavailable: string | null = null;
  degraded: SourceDegraded | null = null;
  /** Whether hand-overs open in this app (Switchboard's setting); null until read. */
  enabled: boolean | null = null;
  pending: PendingHandover[] | null = null;

  read(r: SbHandovers, now: number): HandoverRead {
    if ('unavailable' in r) {
      const log = this.unavailable !== r.unavailable ? `console: hand-overs cannot be read (${r.unavailable}): ${r.detail}` : null;
      this.unavailable = r.unavailable;
      this.degraded = degradedSince(this.degraded, 'handovers', r.unavailable, r.detail, now);
      return { log, fresh: [] };
    }
    const log = this.unavailable ? 'console: hand-overs can be read again' : null; // FD-69: a recovery is said, not silent
    this.unavailable = null;
    this.degraded = null;
    this.pending = r.handovers;
    this.enabled = r.enabled;
    const fresh: HandoverRead['fresh'] = [];
    for (const h of r.handovers) {
      if (this.seen.has(h.id)) continue;
      // FD-103: an offer that lapsed before this app saw it is a row for the person, not only a skip.
      const expired = h.offeredUntil <= now;
      this.seen.add(h.id);
      if (!expired && this.seen.size > SEEN_HANDOVERS_MAX) this.seen.delete(this.seen.values().next().value!);
      fresh.push({ handover: h, expired });
    }
    return { log, fresh };
  }
}
