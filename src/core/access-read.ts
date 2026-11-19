// #region access-read — docs: docs/ux/scenarios.md#scn-123-see-who-holds-access-and-what-each-agent-holds
// FD-351 (contract DEC-0187): the host asks each product that issues access for `access.grants.list` and joins the
// answers by service key. A product names the operation in its MCP capabilities, or answers it behind its compact
// `execute` door; one that does neither is "not declared", never shown as holding nothing. An answer that breaks the
// shape is refused whole with its reason (checkAccessGrants), never read in part. No key value is read or kept.
import { ACCESS_GRANTS_OPERATION, authHeaders, checkAccessGrants, type AccessGrants, type Grant } from '@passioncode-ai/fabric-service-host';
import { callCapability, type McpTarget } from './mcp-client';

export type GrantsRead =
  | { key: string; state: 'read'; answer: AccessGrants }
  | { key: string; state: 'not-declared' }
  | { key: string; state: 'refused' | 'unreadable'; why: string };

type Look = {
  descriptor: { origin: string; auth?: { tokenFile?: string } } | null;
  wellKnown?: { surfaces: { mcp?: { transport?: string; path: string; capabilities?: string[]; compact?: { execute?: string } } } } | null;
};

/** At most this many pages of one product (500 grants each); a longer list is read in part and says so. */
export const GRANT_PAGES = 10;

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

/** The answer's body: its structured content, or the JSON in its text. */
function bodyOf(result: unknown): unknown {
  const r = result as { structuredContent?: unknown; content?: { type: string; text?: string }[] } | null;
  if (r?.structuredContent) return r.structuredContent;
  try { return JSON.parse((r?.content ?? []).find((c) => c.type === 'text')?.text ?? ''); } catch { return null; }
}

/** A refusal that only says the server has no such operation: the product does not declare it (yet). */
const unknownOperation = (message: string) => /offers no tool for|unknown[ -]operation|operation[^.]{0,40}not (found|known)|no such operation|unknown tool/i.test(message);

/** One product's grants, every page of them, under its own token. */
export async function readGrants(o: {
  key: string; look: Look; readToken: (file: string) => string | Promise<string>; version: string;
  call?: typeof callCapability; timeoutMs?: number;
}): Promise<GrantsRead> {
  const door = o.look.descriptor ? grantsDoorOf(o.look) : null;
  if (!door) return { key: o.key, state: 'not-declared' };
  const d = o.look.descriptor!;
  let headers: Record<string, string> = {};
  try { headers = d.auth?.tokenFile ? authHeaders(d as Parameters<typeof authHeaders>[0], await o.readToken(d.auth.tokenFile)) : {}; } catch (error) {
    return { key: o.key, state: 'unreadable', why: `its token could not be read: ${(error as Error).message}` };
  }
  const call = o.call ?? callCapability;
  const target: McpTarget = { origin: door.origin, path: door.path, headers };
  const grants: Grant[] = [];
  let first: AccessGrants | null = null;
  let cursor: string | undefined;
  for (let page = 0; page < GRANT_PAGES; page += 1) {
    let result: unknown;
    try {
      result = await call(target, ACCESS_GRANTS_OPERATION, { includeRevoked: true, ...(cursor ? { cursor } : {}) }, o.version, o.timeoutMs ?? 15_000, door.execute ? { execute: door.execute } : {});
    } catch (error) {
      const message = (error as Error).message;
      // A compact surface that does not know the operation has not declared it; a declared one that fails is unreadable.
      if (!door.declared && unknownOperation(message)) return { key: o.key, state: 'not-declared' };
      return { key: o.key, state: 'unreadable', why: message.slice(0, 300) };
    }
    const body = bodyOf(result);
    const problem = checkAccessGrants(body, { issuer: o.key });
    if (problem) return { key: o.key, state: 'refused', why: problem };
    const answer = body as AccessGrants;
    first ??= answer;
    grants.push(...answer.grants);
    cursor = answer.nextCursor;
    if (!cursor) break;
  }
  const degraded = [...(first!.degraded ?? []), ...(cursor ? [`more than ${GRANT_PAGES} pages: the rest was not read`] : [])];
  return { key: o.key, state: 'read', answer: { ...first!, grants, ...(degraded.length ? { degraded } : {}), nextCursor: undefined } };
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
// #endregion access-read
