// #region agent-handoff — docs: docs/adr/0020-agents-first-handoff-and-setup.md#decision
// FD-39 D-3: where Fix / Update with agent is offered. Pure and free of Node: the renderer imports it.
import type { ServiceSnapshot } from './types';

/** D-3: *Fix with agent* is offered where something is wrong — a problem state, a degraded one, a
 *  descriptor problem, or a failed last action. Pure: the renderer and tests share it. */
export function offersFix(s: Pick<ServiceSnapshot, 'state' | 'problems' | 'lastAction'>): boolean {
  return ['down', 'duplicate', 'foreign', 'conflict', 'invalid', 'degraded'].includes(s.state) || s.problems.length > 0 || s.lastAction?.ok === false;
}

/** D-3: *Update with agent* is offered when an update is available and the agent's own command cannot
 *  apply it — there is none, or it just failed. */
export function offersAgentUpdate(s: Pick<ServiceSnapshot, 'wellKnown' | 'descriptor'>, updateFailed: boolean): boolean {
  return Boolean(s.wellKnown?.update?.available) && (!s.descriptor?.commands?.update?.length || updateFailed);
}
// #endregion agent-handoff
