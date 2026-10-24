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

// #region first-action — docs: docs/ux/scenarios.md#scn-006-overview-lists-what-needs-attention
/** UX-01, UX-03 (decision of 2026-10-24): the state's one deterministic action, offered first on the agent page as
 *  on Overview: Restart for an agent that is down or runs twice, Start for one that is off, "Update to <v>" when its
 *  own command can apply an update. *Fix with coding agent* (a paid session) always comes after it. Null when the
 *  app cannot act here: an online agent (its platform supervises it), one launchd does not manage, or one whose
 *  action is already running. */
export type FirstAction = { kind: 'restart' } | { kind: 'start' } | { kind: 'update'; version: string };

export function firstAction(s: Pick<ServiceSnapshot, 'state' | 'busy' | 'launchd' | 'descriptor' | 'wellKnown'>): FirstAction | null {
  if (s.busy || s.descriptor?.placement === 'remote') return null;
  const managed = s.launchd.managed && (s.launchd.by ?? 'launchd') === 'launchd';
  if (managed && (s.state === 'down' || s.state === 'duplicate')) return { kind: 'restart' };
  if (managed && s.state === 'stopped') return { kind: 'start' };
  const version = s.wellKnown?.update?.available;
  if (version && s.descriptor?.commands?.update?.length) return { kind: 'update', version };
  return null;
}
// #endregion first-action
