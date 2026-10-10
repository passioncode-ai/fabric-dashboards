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
}

export function sinceLastVisit(o: {
  services: readonly Pick<ServiceSnapshot, 'key' | 'latestEvent'>[];
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
  };
}
// #endregion since-last-visit
