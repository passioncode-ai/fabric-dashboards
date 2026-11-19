// #region access-view — docs: docs/ux/scenarios.md#scn-123-see-who-holds-access-and-what-each-agent-holds
// FD-351 (contract DEC-0187): the pure half of the access read, shared by the main process, the MCP server and the page:
// where a product answers `access.grants.list`, and one agent's side of every answer. No I/O, no Node.
import { ACCESS_GRANTS_OPERATION, grantState, type AccessGrants, type Grant, type GrantState } from '@passioncode-ai/fabric-service-host/access-grants';

export type GrantsRead =
  | { key: string; state: 'read'; answer: AccessGrants }
  | { key: string; state: 'not-declared' }
  | { key: string; state: 'refused' | 'unreadable'; why: string };

export type Look = {
  descriptor: { origin: string; auth?: { tokenFile?: string } } | null;
  wellKnown?: { surfaces: { mcp?: { transport?: string; path: string; capabilities?: string[]; compact?: { execute?: string } } } } | null;
};

/** Where a service answers `access.grants.list`: its declared capability, or a compact surface's execute door. */
export function grantsDoorOf(s: Look): { origin: string; path: string; execute?: string; declared: boolean } | null {
  const mcp = s.wellKnown?.surfaces.mcp;
  const origin = s.descriptor?.origin ?? '';
  if (!mcp || mcp.transport !== 'streamable-http' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || !/^\/(?!\/)/.test(mcp.path)) return null;
  const declared = (mcp.capabilities ?? []).some((c) => c === ACCESS_GRANTS_OPERATION || c === ACCESS_GRANTS_OPERATION.replace(/\./g, '_'));
  const execute = typeof mcp.compact?.execute === 'string' ? mcp.compact.execute : undefined;
  if (!declared && !execute) return null;
  return { origin, path: mcp.path, declared, ...(execute ? { execute } : {}) };
}

export interface AgentAccess {
  /** Grants this agent holds, each with the product that issued it. */
  holds: { issuer: string; grant: Grant }[];
  /** Grants that open this agent: issued by it with no subject, or naming it as their subject. */
  grantedTo: { issuer: string; grant: Grant }[];
}

/** One agent's side of every answer read (AG-2, AG-3): never a guess from an unresolved label. */
export function accessOf(key: string, reads: readonly GrantsRead[]): AgentAccess {
  const holds: AgentAccess['holds'] = [];
  const grantedTo: AgentAccess['grantedTo'] = [];
  for (const r of reads) {
    if (r.state !== 'read') continue;
    for (const grant of r.answer.grants) {
      if (grant.holder.kind === 'agent' && grant.holder.agent === key) holds.push({ issuer: r.answer.issuer, grant });
      const opens = grant.subject ? grant.subject.kind === 'agent' && grant.subject.agent === key : r.answer.issuer === key;
      if (opens) grantedTo.push({ issuer: r.answer.issuer, grant });
    }
  }
  return { holds, grantedTo };
}
/** One grant on an agent's Access tab: who issued it and its state at the read. */
export interface GrantRow { issuer: string; grant: Grant; state: GrantState }

/** What one agent's Access tab shows (SCN-123): what it holds, what opens it, and every product's state of the read. */
export interface AccessView {
  readAt: string | null;
  holds: GrantRow[];
  grantedTo: GrantRow[];
  /** Products whose list was not read, with why: `not-declared` is never counted as holding nothing. */
  products: { key: string; state: GrantsRead['state']; why?: string }[];
}

/** Active grants first, then by issue time, newest first. */
const order = (a: GrantRow, b: GrantRow) => Number(a.state !== 'active') - Number(b.state !== 'active') || Date.parse(b.grant.issued.at) - Date.parse(a.grant.issued.at);

export function accessView(key: string, reads: readonly GrantsRead[], now: number, readAt: string | null): AccessView {
  const mine = accessOf(key, reads);
  const row = (h: { issuer: string; grant: Grant }): GrantRow => ({ ...h, state: grantState(h.grant, now) });
  return {
    readAt,
    holds: mine.holds.map(row).sort(order),
    grantedTo: mine.grantedTo.map(row).sort(order),
    products: reads.map((r) => ({ key: r.key, state: r.state, ...('why' in r ? { why: r.why } : {}) })),
  };
}

/** Whether any installed product declares the list: the Access tab shows from then on. */
export const anyDeclares = (looks: readonly Look[]) => looks.some((l) => Boolean(l.descriptor) && grantsDoorOf(l)?.declared === true);

/** Whether a product might answer the list behind its compact `execute` door, which says nothing until it is asked. */
export const anyMayAnswer = (looks: readonly Look[]) => looks.some((l) => Boolean(l.descriptor) && grantsDoorOf(l) !== null);

/** Whether a read found any product's list: a compact door that answered shows the tab as a declared one does. */
export const anyRead = (view: Pick<AccessView, 'products'> | null) => Boolean(view?.products.some((p) => p.state === 'read'));
// #endregion access-view
