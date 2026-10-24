// #region attention-groups — docs: docs/ux/scenarios.md#scn-006-overview-lists-what-needs-attention
// FD-86 (dashboard perception principle 4): the "now" queue is only about now, and items of one class
// fold into one line with a count. Agents in the same state for the same reason (five agents down
// because one hub is) read as one line naming them all, not five identical lines. Pure, for the renderer.
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import { attentionRank } from '@passioncode-ai/fabric-service-host/state';
import { NEWS_MS } from './focus';
import type { ServiceSnapshot } from './types';

export interface AttentionEntry<T> {
  /** The first member, in the queue's order: its place decides the group's place. */
  lead: T;
  /** Every member, the lead first; one member is an ordinary row. */
  members: T[];
}

/**
 * Groups a ranked queue by class (`classOf`: the state and the reason a person reads), keeping the
 * queue's order by each group's first member. An item whose class is empty is never grouped: a row
 * that says nothing in common with another is not the same class.
 */
export function groupAttention<T>(queue: readonly T[], classOf: (item: T) => string): AttentionEntry<T>[] {
  const groups = new Map<string, AttentionEntry<T>>();
  const out: AttentionEntry<T>[] = [];
  for (const item of queue) {
    const key = classOf(item);
    const known = key ? groups.get(key) : undefined;
    if (known) { known.members.push(item); continue; }
    const entry = { lead: item, members: [item] };
    if (key) groups.set(key, entry);
    out.push(entry);
  }
  return out;
}
/** SCN-042: the lines Needs attention shows: the first `visible` unless the person asked for all, and whether the
 *  "Show all N" control is offered (N counts lines after folding, never agents). */
export function foldAttention<T>(entries: readonly T[], showAll: boolean, visible = 3): { shown: readonly T[]; more: number | null } {
  const more = entries.length > visible ? entries.length : null;
  return { shown: showAll || more === null ? entries : entries.slice(0, visible), more };
}
// #endregion attention-groups

// #region attention-queue — docs: docs/ux/scenarios.md#scn-006-overview-lists-what-needs-attention
// W2 (UX-04, UX-06): one queue of what needs the person, read the same way by Overview's Needs attention, the
// strip, the sidebar badge, the tray headline and the Dock badge, so the glance and the window never disagree.

/** A running action sorts right after what does not answer; a limit that stopped work after what is broken;
 *  a failed action after both (attentionRank's own ranks: down 0 … invalid 4, degraded 6, tile 7, update 8). */
export const BUSY_RANK = 0.5;
export const LIMIT_RANK = 4.5;
export const FAILED_RANK = 5;

type Queued = Pick<ServiceSnapshot, 'key' | 'state' | 'wellKnown' | 'busy' | 'lastAction'>;
export interface QueueItem<S extends Queued> {
  s: S;
  rank: number;
  /** A failed action that is still news (30 minutes). */
  failed: boolean;
  /** The spending limit that stopped this agent's work, when one did (UX-06). */
  limit: LimitView | null;
}

const failedNow = (s: Queued, now: number) => Boolean(s.lastAction && !s.lastAction.ok && !s.busy && now - Date.parse(s.lastAction.at) < NEWS_MS);

/** Everything that needs the person now, most severe first; one item per agent. `limits` are the limits each
 *  agent reported that need a person (`limitsNeedingPerson`); without them nothing about limits is invented. */
export function attentionQueue<S extends Queued>(services: readonly S[], o: { now: number; limits?: Readonly<Record<string, readonly LimitView[]>> }): QueueItem<S>[] {
  const out: QueueItem<S>[] = [];
  for (const s of services) {
    const failed = failedNow(s, o.now);
    const limit = o.limits?.[s.key]?.find((l) => l.state === 'tripped') ?? null;
    let rank = attentionRank(s.state, s.wellKnown) ?? (s.busy ? BUSY_RANK : failed ? FAILED_RANK : null);
    if (limit) rank = Math.min(rank ?? LIMIT_RANK, LIMIT_RANK);
    if (rank !== null) out.push({ s, rank, failed, limit });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

/** Something does not work: a problem state, a limit that stopped work, a failed action; not a running action,
 *  a degraded agent, a tile or an update. The sidebar badge turns red and the tray icon reads it. */
export function urgent(item: Pick<QueueItem<Queued>, 'rank'>): boolean {
  return item.rank < 6 && item.rank !== BUSY_RANK;
}

/** The Dock badge: the queue's count, nothing when it is empty. */
export function badgeText(count: number): string {
  return count > 0 ? String(count) : '';
}

/** When the next failed action stops being news, so the main process can count again then; null when none is. */
export function nextNewsExpiry(services: readonly Queued[], now: number): number | null {
  let next: number | null = null;
  for (const s of services) {
    if (!failedNow(s, now)) continue;
    const end = Date.parse(s.lastAction!.at) + NEWS_MS;
    if (next === null || end < next) next = end;
  }
  return next;
}
// #endregion attention-queue
