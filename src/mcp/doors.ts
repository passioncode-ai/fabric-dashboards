// #region two-doors — docs: docs/ux/scenarios.md#scn-028-an-agent-reads-and-administers-services-through-mcp
// FD-339 (the operator's rule of 2026-11-18, relayed on the board by sshlg-skills, thread `87ea6cd6`; canon agent-stack
// 0.33.0 `mcp-two-doors.md`): `tools/list` answers two doors, `search` and `execute`. `search` finds this server's
// operations by words, each with its purpose, input schema, effect, gate and an example; `execute` runs one by name
// through the same checks, the same operator decision and, for an act on another agent, an idempotency key. The old
// tool names worked one release, unlisted (0.8.201 and 0.8.202); since 0.8.203 a call by one is refused `retired-name`.
import { OWN_ACTIONS } from './actions';
import { TOOLS } from './schema';

type Prop = { type?: string | string[]; enum?: readonly unknown[]; minimum?: number; maxLength?: number };
type Tool = (typeof TOOLS)[number];

export const SEARCH_TOOL = {
  name: 'search',
  description: 'Find this server\'s operations by words (empty: all), each with its purpose, inputSchema, effect (read, write or destructive), gate (none, or relayed: an act on another agent that takes the operator\'s words in params._meta.decision and an idempotencyKey) and an example; then run one with execute. Paged: pass next as cursor.',
  inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 200 }, cursor: { type: 'string', maxLength: 8 }, limit: { type: 'integer', minimum: 1, maximum: 50 } }, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
} as const;

export const EXECUTE_TOOL = {
  name: 'execute',
  description: 'Run one operation search names, with its arguments, through the same checks as the window\'s button. A relayed operation takes an idempotencyKey: the same key with the same arguments answers the first result and does nothing again; with other arguments it is refused. Refusals are typed: unknown-operation, invalid-arguments, idempotency-required, idempotency-conflict, and the decision refusals of the gate.',
  inputSchema: { type: 'object', properties: { operation: { type: 'string', maxLength: 64 }, arguments: { type: 'object' }, idempotencyKey: { type: 'string', maxLength: 128 } }, required: ['operation'], additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: true },
} as const;

export const DOORS = [SEARCH_TOOL, EXECUTE_TOOL];

export interface Operation { name: string; purpose: string; inputSchema: unknown; effect: 'read' | 'write' | 'destructive'; gate: 'none' | 'relayed'; example: { operation: string; arguments: Record<string, unknown> } }

/** The gate an operation carries: relayed when any of this app's buttons it twins is relayed. */
export function gateOf(name: string): 'none' | 'relayed' {
  return OWN_ACTIONS.some((a) => a.tool === name && a.gate === 'relayed') ? 'relayed' : 'none';
}

/** An example call that satisfies the operation's schema: each required argument with a value of its type. */
function exampleOf(tool: Tool): Record<string, unknown> {
  const schema = tool.inputSchema as { properties?: Record<string, Prop>; required?: readonly string[] };
  const out: Record<string, unknown> = {};
  for (const key of schema.required ?? []) {
    const p = schema.properties?.[key] ?? {};
    const type = Array.isArray(p.type) ? p.type[0] : p.type;
    out[key] = p.enum?.length ? p.enum[0]
      : key === 'service' || key === 'key' ? 'example-agent.default'
      : type === 'integer' || type === 'number' ? (p.minimum ?? 1)
      : type === 'boolean' ? true
      : type === 'array' ? []
      : type === 'object' ? {}
      : key === 'url' ? 'http://127.0.0.1:47195/dashboard'
      : key === 'path' ? '/dashboard'
      : 'example';
  }
  return out;
}

export function operationOf(tool: Tool): Operation {
  const a = tool.annotations as { readOnlyHint?: boolean; destructiveHint?: boolean } | undefined;
  return {
    name: tool.name, purpose: tool.description, inputSchema: tool.inputSchema,
    effect: a?.readOnlyHint ? 'read' : a?.destructiveHint ? 'destructive' : 'write',
    gate: gateOf(tool.name), example: { operation: tool.name, arguments: exampleOf(tool) },
  };
}

/** `search`: operations whose name or purpose holds every word of the query, a page at a time. */
export function search(args: { query?: unknown; cursor?: unknown; limit?: unknown }): { operations: Operation[]; total: number; next: string | null } {
  const words = typeof args.query === 'string' ? args.query.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const hits = TOOLS.filter((t) => words.every((w) => `${t.name} ${t.description}`.toLowerCase().includes(w)));
  const from = typeof args.cursor === 'string' && /^\d{1,4}$/.test(args.cursor) ? Number(args.cursor) : 0;
  const limit = typeof args.limit === 'number' && Number.isInteger(args.limit) ? Math.min(50, Math.max(1, args.limit)) : 20;
  const page = hits.slice(from, from + limit);
  return { operations: page.map(operationOf), total: hits.length, next: from + limit < hits.length ? String(from + limit) : null };
}

/** `execute`'s idempotency for relayed operations: within this server's life, a key answers its first result. */
export class Idempotency {
  private readonly seen = new Map<string, { args: string; result: Record<string, unknown> }>();

  check(key: string, operation: string, args: unknown): { kind: 'new' } | { kind: 'repeat'; result: Record<string, unknown> } | { kind: 'conflict' } {
    const was = this.seen.get(key);
    if (!was) return { kind: 'new' };
    return was.args === JSON.stringify([operation, args]) ? { kind: 'repeat', result: was.result } : { kind: 'conflict' };
  }

  remember(key: string, operation: string, args: unknown, result: Record<string, unknown>): void {
    if (this.seen.size >= 1000) this.seen.delete(this.seen.keys().next().value!);
    this.seen.set(key, { args: JSON.stringify([operation, args]), result });
  }
}
// #endregion two-doors
