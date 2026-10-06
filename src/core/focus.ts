// ADR-0017: what the compact service bar must still say. It is one line, so it carries one problem:
// the first reason of a state that is not ready, else a failed action that is still news. Nothing
// a person needs is hidden by folding the header away. No Node imports: the renderer uses it.
import type { Reason, ServiceSnapshot } from './types';

/** How long a finished action stays news on Overview and the service page (U-1, P-15). */
export const NEWS_MS = 30 * 60_000;

const QUIET = new Set(['ready', 'starting', 'stopping']);

/** The one problem the compact bar shows, or null when there is none to show. */
export function problemOf(s: Pick<ServiceSnapshot, 'state' | 'reasons' | 'lastAction' | 'busy'>, now: number): Reason | null {
  if (s.busy) return null; // its progress shows instead
  if (!QUIET.has(s.state)) return s.reasons[0] ?? { code: `state.${s.state}` };
  if (s.lastAction && !s.lastAction.ok && now - Date.parse(s.lastAction.at) < NEWS_MS) return s.lastAction.reason;
  return null;
}
