// #region waits-for-setup — docs: docs/ux/scenarios.md#scn-095-see-an-agent-that-only-waits-for-setup
// FD-169 (the contract's DEC-0149, decided with it 2026-11-07, board thread `1fe66e6e`, message `5549a61a`): an agent
// whose every degraded entry is a setup one (`setup: true`, DEC-0044) is not partly broken, it waits for a person to
// set it up. That is a presentation over `degraded`, never a host state: the state order, its vectors and everything
// handed outward (MCP, events, digests) keep `degraded` with `reason.setup`. Pure: the renderer imports it.
import type { Reason, ServiceState } from '@passioncode-ai/fabric-service-host/protocol';

type Read = { state: ServiceState; reasons: readonly Reason[] };

// Scenario walk 2026-11-11 (SCN-095): the monitor adds reasons that are not degraded entries: an update waiting
// (`reason.update`) and the last line of its log (`reason.log`, FD-198). Neither makes a setup a failure.
const BESIDE = new Set(['reason.update', 'reason.log']);

/** Degraded, with at least one setup entry and every degraded entry a setup one. A mixed list stays degraded. */
export function waitsForSetup(s: Read): boolean {
  if (s.state !== 'degraded') return false;
  const own = s.reasons.filter((r) => !BESIDE.has(r.code));
  return own.length > 0 && own.every((r) => r.code === 'reason.setup');
}

/** What a person reads: the host state, or `setup` over a degraded one that only waits for setup. */
export type ShownState = ServiceState | 'setup';
export const shownState = (s: Read): ShownState => (waitsForSetup(s) ? 'setup' : s.state);

/** Its place in the attention queue: after degraded (6), before a tile asking for attention (7). */
export const SETUP_RANK = 6.5;
// #endregion waits-for-setup
