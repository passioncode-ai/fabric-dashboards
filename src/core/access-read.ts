// #region access-read — docs: docs/ux/scenarios.md#scn-123-see-who-holds-access-and-what-each-agent-holds
// FD-351 (contract DEC-0187): the host asks each product that issues access for `access.grants.list` and joins the
// answers by service key. A product names the operation in its MCP capabilities, or answers it behind its compact
// `execute` door; one that does neither is "not declared", never shown as holding nothing. An answer that breaks the
// shape is refused whole with its reason (checkAccessGrants), never read in part. No key value is read or kept.
import { ACCESS_GRANTS_OPERATION, authHeaders, checkAccessGrants, type AccessGrants, type Grant } from '@passioncode-ai/fabric-service-host';
import { grantsDoorOf, type GrantsRead, type Look } from './access-view';
import { callCapability, type McpTarget } from './mcp-client';

export * from './access-view';

/** At most this many pages of one product (500 grants each); a longer list is read in part and says so. */
export const GRANT_PAGES = 10;

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

// #endregion access-read
