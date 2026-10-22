// #region attention-groups — docs: docs/ux/scenarios.md#scn-006-overview-lists-what-needs-attention
// FD-86 (dashboard perception principle 4): the "now" queue is only about now, and items of one class
// fold into one line with a count. Agents in the same state for the same reason (five agents down
// because one hub is) read as one line naming them all, not five identical lines. Pure, for the renderer.

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
