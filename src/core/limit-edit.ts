// #region limit-edit — docs: docs/ux/scenarios.md#scn-037-a-cost-that-is-not-known-reads-as-unknown
// FD-324 (contract DEC-0183 SL-2, SL-3): a person changes an agent's spending limit from Spend, and an agent does the same
// through MCP `spend_limit_set`; both call the agent's own `spend.limits.set`. The host checks what it can see first (the
// limit is in the report, editable, the amount inside its bounds) and says whether the change only tightens: a lower
// amount or the limit turned on is the caller's own act; any other change is the operator's and travels with the
// operator's decision in `_meta.decision` (DEC-0121 AP-2). The agent checks again and records the change; the host keeps
// nothing of its own.
import { createHash } from 'node:crypto';
import { authHeaders } from '@passioncode-ai/fabric-service-host';
import type { UsageLimit } from '@passioncode-ai/fabric-service-host/usage';
import { changeOf, limitDoorOf, planLimitChange, SPEND_LIMITS_SET, type LimitChangeInput } from './limit-plan';
import { callCapability } from './mcp-client';

export { changeOf, limitDoorOf, planLimitChange, SPEND_LIMITS_SET, type LimitChangeInput, type LimitPlan } from './limit-plan';

/** The operator's decision a relayed change carries (DEC-0121 AP-2), sent on to the agent in `_meta.decision`. */
export interface RelayedDecision { by: 'operator'; via: 'relayed-instruction'; action: string; instruction: string; at: string }

export class LimitEditError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

/** One change, as Change on Spend and MCP `spend_limit_set` both make it: checked against the agent's report, sent to
 *  its `spend.limits.set` with the operator's decision when it does more than tighten, and answered with the change the
 *  agent recorded. Refusals are `LimitEditError` with the contract's code (or this host's: `operator-decision-required`
 *  before sending, `no-limit-door`, `agent-refused`, `no-change-recorded`). */
export async function applyLimitChange(o: {
  key: string;
  look: { descriptor: { origin: string; auth?: { tokenFile?: string } } | null; wellKnown?: Parameters<typeof limitDoorOf>[0]['wellKnown'] };
  limits: readonly UsageLimit[];
  change: LimitChangeInput;
  decision: RelayedDecision | null;
  readToken: (file: string) => string | Promise<string>;
  version: string;
  now: number;
  idempotencyKey?: string;
}): Promise<{ change: Record<string, unknown>; repeated: boolean }> {
  const plan = planLimitChange(o.limits, o.change);
  if (!plan.ok) throw new LimitEditError(plan.code, plan.message);
  if (!plan.tightens && !o.decision) throw new LimitEditError('operator-decision-required', `raising, clearing or turning off ${o.change.limitId} is the operator's decision`);
  const door = o.look.descriptor ? limitDoorOf({ descriptor: o.look.descriptor, wellKnown: o.look.wellKnown }) : null;
  if (!door) throw new LimitEditError('no-limit-door', 'the agent does not take spend.limits.set on this Mac');
  const d = o.look.descriptor!;
  const headers = d.auth?.tokenFile ? authHeaders(d as Parameters<typeof authHeaders>[0], await o.readToken(d.auth.tokenFile)) : {};
  // Without a key of the caller's, one per change and minute: a retry within it is the same change at the agent.
  const key = o.idempotencyKey ?? `fd-${createHash('sha256').update(JSON.stringify([o.key, plan.args, o.decision?.at ?? null, Math.floor(o.now / 60_000)])).digest('hex').slice(0, 32)}`;
  let result: unknown;
  try {
    result = await callCapability({ ...door, headers }, SPEND_LIMITS_SET, { ...plan.args, idempotencyKey: key }, o.version, 20_000, { ...(o.decision ? { meta: { decision: o.decision } } : {}), idempotencyKey: key });
  } catch (error) {
    throw new LimitEditError('agent-refused', (error as Error).message);
  }
  const answer = changeOf(result);
  if (!answer) throw new LimitEditError('no-change-recorded', 'the agent answered without the change it recorded');
  return answer;
}
// #endregion limit-edit
