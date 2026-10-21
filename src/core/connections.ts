// #region connections-graph — docs: docs/ux/scenarios.md#scn-073-see-what-an-agent-is-connected-to
// FD-78: an agent's connections as a person reads them on its Connections tab. Declared connections come first (the
// contract's `extensions/connections/0.1`, DEC-0096, packages/service-host/src/connections.ts); what the app already sees is added
// beside them: the models its usage report names, the runner it resolved (DEC-0046), parts it reports failing
// (`degraded[].source`) that no declaration names, and the other agents whose declarations point at it. A connection
// to another installed agent carries that agent's own state and, below it, that agent's connections (the chain),
// without visiting an agent twice. Pure: the renderer uses it.
import { connectionsOf, type Connection, type ConnectionKind, type ConnectionState } from '@passioncode-ai/fabric-service-host/connections';
import { productIdOf } from '@passioncode-ai/fabric-service-host/links';
import type { Reason, ServiceSnapshot, ServiceState } from './types';

/** What the graph needs of a service: the app's snapshot and the MCP server's look both carry it. */
export type Seen = Pick<ServiceSnapshot, 'key' | 'state' | 'reasons' | 'descriptor' | 'wellKnown'>;

export type NodeKind = ConnectionKind | 'runner' | 'part';
export type NodeSource = 'declared' | 'usage' | 'runner' | 'degraded';

export interface ConnectionNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** The thing's own name, when the label is not it. */
  target?: string;
  capability?: string;
  purpose?: string;
  state: ConnectionState;
  reason?: string;
  /** The reached agent's own first reason, when it is not well: translated by the reader, never shown as a code. */
  agentReason?: Reason;
  lastAt?: string;
  /** Where the app learned of it. */
  source: NodeSource;
  /** An installed agent this connection reaches: its key, so a click opens it. */
  serviceKey?: string;
  /** Calls in the last 30 days, for a model read from the usage report. */
  calls?: number;
  /** The reached agent's own connections, one level each, until MAX_DEPTH or an agent already shown. */
  children: ConnectionNode[];
  /** The reached agent is already shown higher in this chain: its connections are not repeated. */
  repeated?: boolean;
}

export interface ConnectionGraph {
  /** What the agent uses, declared first, then what the app sees. */
  uses: ConnectionNode[];
  /** Installed agents whose declarations name this one. */
  /** One row per agent, with every capability it declares calling here. */
  usedBy: { key: string; name: string; state: ConnectionState; capabilities: string[] }[];
  /** What the agent offers: its MCP capabilities and surfaces. */
  offers: { capabilities: string[]; surfaces: ('dashboard' | 'mcp' | 'events' | 'usage')[] };
  declared: boolean;
  /** The declaration is present and invalid: why (shown, never guessed past). */
  errors: string[];
}

/** One model row from the agent's usage report (ADR-0013): enough to draw it. */
export interface ModelUse { provider: string; model: string; calls: number }

export const MAX_DEPTH = 3;
const WORST: Record<ConnectionState, number> = { down: 0, degraded: 1, unknown: 2, ok: 3 };
const worst = (a: ConnectionState, b: ConnectionState) => (WORST[a] <= WORST[b] ? a : b);
/** The worse of two states. */
export const worstOf = worst;

/** How an installed agent's own state reads as a connection's state. */
export function stateOfService(s: ServiceState): ConnectionState {
  if (s === 'ready') return 'ok';
  if (s === 'degraded' || s === 'starting' || s === 'stopping') return 'degraded';
  if (s === 'down' || s === 'duplicate' || s === 'foreign' || s === 'conflict' || s === 'invalid' || s === 'stopped') return 'down';
  return 'unknown';
}

const nameOf = (s: Seen) => s.descriptor?.name ?? s.wellKnown?.service.name ?? s.key;

/** The installed agent a service target names: an exact key, else the product's `default`, else its first member. */
export function resolveTarget(target: string, all: readonly Seen[]): Seen | undefined {
  const exact = all.find((s) => s.key === target);
  if (exact) return exact;
  const members = all.filter((s) => productIdOf(s.key) === target).sort((a, b) => (a.key < b.key ? -1 : 1));
  return members.find((s) => s.key.endsWith('.default')) ?? members[0];
}

function declaredNodes(s: Seen, all: readonly Seen[], seen: Set<string>, depth: number): ConnectionNode[] {
  return connectionsOf(s.wellKnown).connections.map((c) => nodeOf(c, all, seen, depth));
}

function nodeOf(c: Connection, all: readonly Seen[], seen: Set<string>, depth: number): ConnectionNode {
  const base: ConnectionNode = { id: c.id, kind: c.kind, label: c.label ?? c.target, target: c.label ? c.target : undefined, capability: c.capability, purpose: c.purpose, state: c.state, reason: c.reason, lastAt: c.lastAt, source: 'declared', children: [] };
  if (c.kind !== 'service') return base;
  const reached = resolveTarget(c.target, all);
  if (!reached) return { ...base, state: c.state === 'ok' ? 'unknown' : c.state, reason: c.reason ?? undefined };
  const own = stateOfService(reached.state);
  const node: ConnectionNode = { ...base, label: c.label ?? nameOf(reached), target: reached.key, serviceKey: reached.key, state: worst(c.state, own), agentReason: own !== 'ok' ? reached.reasons[0] : undefined };
  if (seen.has(reached.key)) return { ...node, repeated: true };
  if (depth >= MAX_DEPTH) return node;
  const next = new Set(seen).add(reached.key);
  return { ...node, children: declaredNodes(reached, all, next, depth + 1) };
}

/** Everything the Connections tab draws for one agent. `models` is its usage report's models, when read. */
export function buildGraph(s: Seen, all: readonly Seen[], models: readonly ModelUse[] = []): ConnectionGraph {
  const view = connectionsOf(s.wellKnown);
  const uses = declaredNodes(s, all, new Set([s.key]), 1);
  const named = new Set(view.connections.flatMap((c) => [c.id, c.target]));
  // A model the declaration already names (by its model or provider) is not drawn twice.
  for (const m of models) {
    if (named.has(m.model) || named.has(`${m.provider}/${m.model}`)) continue;
    uses.push({ id: `model:${m.provider}/${m.model}`, kind: 'model', label: m.model, target: m.provider, state: 'ok', source: 'usage', calls: m.calls, children: [] });
  }
  const r = s.wellKnown?.configuration?.resolved;
  if (r && (r.runnerKind || r.runnerProfile)) {
    uses.push({ id: 'runner', kind: 'runner', label: r.runnerKind ?? r.runnerProfile!, target: r.route, purpose: r.models?.length ? r.models.join(', ') : undefined, state: 'ok', source: 'runner', children: [] });
  }
  // A failing part no declaration names is still a dependency the agent has: drawn as a part, in its words.
  for (const d of s.wellKnown?.degraded ?? []) {
    const known = uses.find((n) => n.source === 'declared' && n.id === d.source);
    if (known) { known.state = worst(known.state, 'degraded'); known.reason = known.reason ?? d.reason; continue; }
    uses.push({ id: `part:${d.source}`, kind: 'part', label: d.source, state: d.setup ? 'unknown' : 'degraded', reason: d.reason, source: 'degraded', children: [] });
  }
  const me = productIdOf(s.key);
  const usedBy = all
    .filter((o) => o.key !== s.key)
    .flatMap((o) => {
      // An agent that names this one several times (two capabilities) is one row.
      const here = connectionsOf(o.wellKnown).connections
        .filter((c) => c.kind === 'service' && (c.target === s.key || (c.target === me && resolveTarget(me, all)?.key === s.key)));
      if (!here.length) return [];
      const state = here.reduce<ConnectionState>((w, c) => worst(w, c.state), stateOfService(o.state));
      return [{ key: o.key, name: nameOf(o), state, capabilities: [...new Set(here.flatMap((c) => (c.capability ? [c.capability] : [])))] }];
    })
    .sort((a, b) => a.name.localeCompare(b.name) || (a.key < b.key ? -1 : 1));
  const surf = s.wellKnown?.surfaces;
  const surfaces = (['dashboard', 'mcp', 'events', 'usage'] as const).filter((k) => Boolean(surf?.[k]));
  return { uses, usedBy, offers: { capabilities: surf?.mcp?.capabilities ?? [], surfaces }, declared: view.declared, errors: view.errors };
}

/** The connections a person should look at first: the worst state in the whole chain (or ok when there is none). */
export function chainState(nodes: readonly ConnectionNode[]): ConnectionState {
  let out: ConnectionState = 'ok';
  for (const n of nodes) out = worst(worst(out, n.state), chainState(n.children));
  return out;
}
// #endregion connections-graph
