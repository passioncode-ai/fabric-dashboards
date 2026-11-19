// #region limit-plan — docs: docs/ux/scenarios.md#scn-037-a-cost-that-is-not-known-reads-as-unknown
// FD-324 (contract DEC-0183 SL-2, SL-3): what a change of an agent's spending limit would be, checked against the
// agent's own report, and where the agent takes it. Pure, so the window's page reads it too; the call is limit-edit.ts.
import type { UsageLimit } from '@passioncode-ai/fabric-service-host/usage';

export const SPEND_LIMITS_SET = 'spend.limits.set';

/** The kinds whose limit is a dollar amount, so `null` is refused for them (DEC-0183 SL-2 `invalid-amount`). */
const DOLLAR_KINDS = new Set(['per_job', 'approval', 'daily', 'weekly', 'monthly', 'pool', 'emergency']);

export interface LimitChangeInput { limitId: string; limitUsd?: number | null; enforced?: boolean; reason: string }

export type LimitPlan =
  | { ok: true; tightens: boolean; args: { limitId: string; limitUsd?: number | null; enforced?: boolean; reason: string } }
  | { ok: false; code: 'unknown-limit' | 'limit-not-editable' | 'invalid-amount' | 'no-change' | 'reason-required'; message: string };

/** What a change of one of `limits` would be, before anything is sent: the agent's own refusals, read from its report. */
export function planLimitChange(limits: readonly UsageLimit[], c: LimitChangeInput): LimitPlan {
  const l = limits.find((x) => x.id === c.limitId);
  if (!l) return { ok: false, code: 'unknown-limit', message: `the agent reports no limit ${JSON.stringify(c.limitId)}` };
  if (l.editable !== true) return { ok: false, code: 'limit-not-editable', message: `${l.id} cannot be changed from here: the agent does not offer it` };
  const reason = typeof c.reason === 'string' ? c.reason.trim() : '';
  if (!reason) return { ok: false, code: 'reason-required', message: 'say why the limit changes: the agent records the reason with the change' };
  if (reason.length > 500) return { ok: false, code: 'reason-required', message: 'the reason is at most 500 characters' };
  const amount = c.limitUsd;
  if (amount !== undefined) {
    if (amount === null ? DOLLAR_KINDS.has(l.kind) : !(typeof amount === 'number' && Number.isFinite(amount) && amount > 0)) {
      return { ok: false, code: 'invalid-amount', message: amount === null ? `${l.id} is a dollar amount and cannot be cleared` : 'the amount is a positive number of dollars' };
    }
    if (typeof amount === 'number' && ((l.minUsd !== undefined && amount < l.minUsd) || (l.maxUsd !== undefined && amount > l.maxUsd))) {
      return { ok: false, code: 'invalid-amount', message: `${l.id} takes ${l.minUsd ?? 0} to ${l.maxUsd ?? '∞'} USD` };
    }
  }
  const amountChanges = amount !== undefined && amount !== l.limitUsd;
  const enforcedChanges = c.enforced !== undefined && c.enforced !== l.enforced;
  if (!amountChanges && !enforcedChanges) return { ok: false, code: 'no-change', message: `${l.id} already reads so` };
  // SL-2: only a lower amount and turning the limit on tighten; a higher amount, a cleared one or turning it off is the operator's.
  const amountTightens = !amountChanges || (typeof amount === 'number' && typeof l.limitUsd === 'number' && amount < l.limitUsd);
  const enforcedTightens = !enforcedChanges || c.enforced === true;
  return {
    ok: true, tightens: amountTightens && enforcedTightens,
    args: { limitId: l.id, ...(amountChanges ? { limitUsd: amount } : {}), ...(enforcedChanges ? { enforced: c.enforced } : {}), reason },
  };
}

/** Where an agent takes `spend.limits.set`: its MCP surface on this machine, when it lists the capability. */
export function limitDoorOf(s: { wellKnown?: { surfaces: { mcp?: { transport?: string; path: string; capabilities?: string[]; compact?: { execute?: string } } } } | null; descriptor?: { origin: string } | null }): { origin: string; path: string; execute?: string } | null {
  const mcp = s.wellKnown?.surfaces.mcp;
  const origin = s.descriptor?.origin ?? '';
  if (!mcp || mcp.transport !== 'streamable-http' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || !/^\/(?!\/)/.test(mcp.path)) return null;
  if (!(mcp.capabilities ?? []).includes(SPEND_LIMITS_SET)) return null;
  // FD-343 (DEC-0180 CM-1): a compact surface names its execute door; the call goes through it by that name.
  const execute = typeof mcp.compact?.execute === 'string' ? mcp.compact.execute : undefined;
  return execute ? { origin, path: mcp.path, execute } : { origin, path: mcp.path };
}

/** The change the agent recorded (DEC-0183 SL-2 answer `{change, repeated?}`), from a tool result, or null. */
export function changeOf(result: unknown): { change: Record<string, unknown>; repeated: boolean } | null {
  const r = result as { structuredContent?: unknown; content?: { type: string; text?: string }[] } | null;
  let body: unknown = r?.structuredContent;
  if (!body) { try { body = JSON.parse((r?.content ?? []).find((c) => c.type === 'text')?.text ?? ''); } catch { body = null; } }
  const b = body as { change?: unknown; repeated?: unknown } | null;
  return b && typeof b.change === 'object' && b.change !== null ? { change: b.change as Record<string, unknown>, repeated: b.repeated === true } : null;
}
// #endregion limit-plan
