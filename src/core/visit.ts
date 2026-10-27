// #region since-last-visit — docs: docs/adr/0020-agents-first-handoff-and-setup.md#decision
// FD-39 SCN-059 (ADR-0020 decision 6): a later session opens on what changed since the last one — agents
// that came or went, warnings and errors they reported since, and the agents the person worked with in a
// console, the last selected first, each with Continue. Pure and Node-free: the renderer computes it once
// per launch from the settings the previous launch left.
import type { ServiceSnapshot } from './types';

export interface SinceLastVisit {
  /** When the previous visit was; null on the very first one (then nothing is shown). */
  since: string | null;
  added: string[];
  removed: string[];
  /** The newest warning or error each agent reported since the last visit. */
  alerts: { key: string; level: string; text: string; at: string }[];
  /** Agents the person ran a console for, the last selected first; each can Continue. */
  continueKeys: string[];
  /** UX-09 (FD-129): agents with an update waiting, named with its version; the Update button is in Needs attention. */
  updates: { key: string; version: string }[];
}

export function sinceLastVisit(o: {
  services: readonly (Pick<ServiceSnapshot, 'key' | 'latestEvent'> & Partial<Pick<ServiceSnapshot, 'wellKnown'>>)[];
  lastVisitAt: string | null;
  known: readonly string[];
  consoles: Record<string, { runtime: string | null }>;
  lastService: string | null;
}): SinceLastVisit {
  const keys = o.services.map((s) => s.key);
  const current = new Set(keys);
  const since = o.lastVisitAt;
  const alerts = since
    ? o.services
      .filter((s) => s.latestEvent && (s.latestEvent.level === 'warning' || s.latestEvent.level === 'error') && s.latestEvent.at > since)
      .map((s) => ({ key: s.key, level: s.latestEvent!.level, text: s.latestEvent!.text, at: s.latestEvent!.at }))
      .sort((a, b) => (a.at < b.at ? 1 : -1))
    : [];
  const worked = keys.filter((k) => o.consoles[k]?.runtime);
  const continueKeys = o.lastService && worked.includes(o.lastService) ? [o.lastService, ...worked.filter((k) => k !== o.lastService)] : worked;
  return {
    since,
    added: since ? keys.filter((k) => !o.known.includes(k)) : [],
    removed: since ? o.known.filter((k) => !current.has(k)) : [],
    alerts,
    continueKeys,
    updates: since ? o.services.flatMap((s) => (s.wellKnown?.update?.available ? [{ key: s.key, version: s.wellKnown.update.available }] : [])) : [],
  };
}

/** UX-08: the window shown again after this long hidden is a new visit: "Since you were last here" is computed
 *  again and this show becomes the next one's baseline. Shorter looks away keep the section as it was. */
export const VISIT_GAP_MS = 60 * 60_000;

/** When the window was last shown and how long it had been hidden before (AppStatus.shown). */
export interface WindowShown { at: string; afterHiddenMs: number }

/** True once per show that ends a hidden gap of VISIT_GAP_MS or more; `handled` is the show already handled. */
export function revisitDue(handled: string | null, shown: WindowShown | undefined): boolean {
  return Boolean(shown && shown.at !== handled && shown.afterHiddenMs >= VISIT_GAP_MS);
}
// #endregion since-last-visit
