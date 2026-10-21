// #region estate-map — docs: docs/adr/0023-the-auditor-and-the-connections-map.md#decision
// FD-81: how every agent is wired to every other, for the Connections map. Nodes are installed agents; an edge is a
// `service` connection an agent declares (extensions/connections/0.1), resolved to the agent it reaches, with the worse
// of its declared state and that agent's own. A target that is not installed is a node of its own, marked missing.
// The layout is layered: an agent sits one column right of the farthest agent that calls it (a cycle is cut where it
// closes), so data reads left to right; agents with no edge wait in a band below. Pure and deterministic.
import { connectionsOf, type ConnectionState } from '@passioncode-ai/fabric-service-host/connections';
import { resolveTarget, stateOfService, worstOf, type Seen } from './connections';

export interface MapNode { id: string; key: string | null; name: string; state: ConnectionState; missing: boolean; column: number; row: number }
export interface MapEdge { from: string; to: string; state: ConnectionState; capability?: string }
export interface EstateMap {
  nodes: MapNode[];
  edges: MapEdge[];
  /** Agents with no edge in or out, in name order. */
  loose: MapNode[];
  columns: number;
  rows: number;
}

const nameOf = (s: Seen) => s.descriptor?.name ?? s.wellKnown?.service.name ?? s.key;

export function estateMap(all: readonly Seen[]): EstateMap {
  const nodes = new Map<string, Omit<MapNode, 'column' | 'row'>>();
  for (const s of all) nodes.set(s.key, { id: s.key, key: s.key, name: nameOf(s), state: stateOfService(s.state), missing: false });
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  for (const s of all) {
    for (const c of connectionsOf(s.wellKnown).connections) {
      if (c.kind !== 'service') continue;
      const reached = resolveTarget(c.target, all);
      const to = reached ? reached.key : `missing:${c.target}`;
      if (!reached && !nodes.has(to)) nodes.set(to, { id: to, key: null, name: c.label ?? c.target, state: 'unknown', missing: true });
      if (to === s.key) continue;
      const id = `${s.key}>${to}`;
      const state = reached ? worstOf(c.state, stateOfService(reached.state)) : 'unknown';
      if (seen.has(id)) { const e = edges.find((x) => `${x.from}>${x.to}` === id)!; e.state = worstOf(e.state, state); continue; }
      seen.add(id);
      edges.push({ from: s.key, to, state, ...(c.capability ? { capability: c.capability } : {}) });
    }
  }
  const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
  // Longest path from a source, by depth-first walk; a node already on the current path is a cycle and is not followed.
  const out = new Map<string, string[]>();
  for (const e of edges) out.set(e.from, [...(out.get(e.from) ?? []), e.to]);
  const column = new Map<string, number>();
  const visit = (id: string, depth: number, path: Set<string>) => {
    if (path.has(id)) return;
    if ((column.get(id) ?? -1) >= depth) return;
    column.set(id, depth);
    path.add(id);
    for (const next of out.get(id) ?? []) visit(next, depth + 1, path);
    path.delete(id);
  };
  const hasIn = new Set(edges.map((e) => e.to));
  const byName = (a: string, b: string) => nodes.get(a)!.name.localeCompare(nodes.get(b)!.name) || (a < b ? -1 : 1);
  const sources = [...linked].filter((id) => !hasIn.has(id)).sort(byName);
  for (const id of sources) visit(id, 0, new Set());
  for (const id of [...linked].sort(byName)) if (!column.has(id)) visit(id, 0, new Set()); // a pure cycle has no source
  const rowsIn = new Map<number, number>();
  const placed: MapNode[] = [...linked].sort((a, b) => (column.get(a)! - column.get(b)!) || byName(a, b)).map((id) => {
    const c = column.get(id)!;
    const row = rowsIn.get(c) ?? 0;
    rowsIn.set(c, row + 1);
    return { ...nodes.get(id)!, column: c, row };
  });
  const loose = [...nodes.keys()].filter((id) => !linked.has(id)).sort(byName).map((id, i) => ({ ...nodes.get(id)!, column: -1, row: i }));
  return { nodes: placed, edges, loose, columns: Math.max(0, ...placed.map((n) => n.column + 1)), rows: Math.max(0, ...rowsIn.values()) };
}
// #endregion estate-map
