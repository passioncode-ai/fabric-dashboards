// #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
// FD-48 (operator decision 2026-10-11): an outage reaches the operator away from the Mac. The app's shared watcher
// sends one message when a service has been unavailable for five minutes and one when it is back, through the
// operator-channel service on this machine — an installed service that declares an MCP capability `<id>.notify`
// (the contract's operator channel, OC-4). Pure: what an episode is, when it is told, and through which service.
import type { ServiceSnapshot, ServiceState } from './types';

/** How long an outage lasts before it is sent (the banner keeps ADR-0008's one minute). */
export const OUTAGE_ALERT_AFTER_MS = 5 * 60_000;

/** One message to the operator channel: one eventId per episode and step, so a retry never doubles it. */
export interface AlertMessage { eventId: string; kind: 'failure' | 'recovery' | 'result'; subject: string; text: string; serviceKey: string }

/** What the watcher keeps across ticks and restarts (`outage-alerts.json` in the app's data). */
export interface OutageState {
  /** A service's degraded sources when it started: a setup state there since the start is not an outage. */
  baselines: Record<string, { startedAt: string; sources: string[] }>;
  /** Open episodes by `<key>|<cause>`: when it began, why, and whether its failure was sent. */
  open: Record<string, { start: number; why: string; sent: boolean }>;
}

export const emptyOutageState = (): OutageState => ({ baselines: {}, open: {} });

/** What the watcher needs of a service. */
export interface Watched { key: string; name: string; state: ServiceState; startedAt: string | null; degraded: { source: string; reason: string }[]; reason: string }

export function watchedOf(s: ServiceSnapshot, name: string, reason: string): Watched {
  return { key: s.key, name, state: s.state, startedAt: s.wellKnown?.process.startedAt ?? null, degraded: s.wellKnown?.degraded ?? [], reason };
}

/** A cause's slug inside an eventId: no `/`, nothing but what the channel accepts. */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';

export interface Words { down: (name: string) => string; failing: (name: string, source: string) => string; back: (name: string) => string; since: (minutes: number, reason: string) => string; after: (minutes: number) => string }

/**
 * One tick: the episodes that began, crossed five minutes or ended, and the messages they owe. A confirmed outage
 * (`down`, ADR-0008) or a degraded source not in the service's start baseline is a cause; a service that is gone
 * from the folder closes its episodes without a message (it was removed, not recovered). `allowed` is the person's
 * own rules (switch, pause, quiet hours, per service): an episode they muted is never sent, nor its recovery.
 */
export function stepOutages(prev: OutageState, services: readonly Watched[], now: number, words: Words, allowed: (key: string) => boolean): { state: OutageState; messages: AlertMessage[] } {
  const state: OutageState = { baselines: { ...prev.baselines }, open: { ...prev.open } };
  const messages: AlertMessage[] = [];
  const present = new Set(services.map((s) => s.key));
  for (const id of Object.keys(state.open)) if (!present.has(id.split('|')[0]!)) delete state.open[id];
  for (const key of Object.keys(state.baselines)) if (!present.has(key)) delete state.baselines[key];
  for (const s of services) {
    if (s.startedAt && state.baselines[s.key]?.startedAt !== s.startedAt) state.baselines[s.key] = { startedAt: s.startedAt, sources: s.degraded.map((d) => d.source) };
    const baseline = new Set(state.baselines[s.key]?.sources ?? []);
    const causes = new Map<string, { why: string; subject: string }>();
    if (s.state === 'down') causes.set('down', { why: s.reason, subject: words.down(s.name) });
    if (s.state === 'degraded') {
      for (const d of s.degraded) if (!baseline.has(d.source)) causes.set(`degraded:${d.source}`, { why: d.reason, subject: words.failing(s.name, d.source) });
    }
    for (const [id, ep] of Object.entries(state.open)) {
      const [key, cause] = [id.slice(0, id.indexOf('|')), id.slice(id.indexOf('|') + 1)];
      if (key !== s.key || causes.has(cause)) continue;
      if (ep.sent) {
        messages.push({ serviceKey: s.key, kind: 'recovery', eventId: `outage:${s.key}:${slug(cause)}:${Math.floor(ep.start / 1000)}:back`, subject: words.back(s.name), text: words.after(Math.max(1, Math.round((now - ep.start) / 60_000))) });
      }
      delete state.open[id];
    }
    for (const [cause, c] of causes) {
      const id = `${s.key}|${cause}`;
      const ep = state.open[id] ?? (state.open[id] = { start: now, why: c.why, sent: false });
      if (ep.sent || now - ep.start < OUTAGE_ALERT_AFTER_MS || !allowed(s.key)) continue;
      ep.sent = true;
      messages.push({ serviceKey: s.key, kind: 'failure', eventId: `outage:${s.key}:${slug(cause)}:${Math.floor(ep.start / 1000)}`, subject: c.subject, text: words.since(Math.round((now - ep.start) / 60_000), c.why) });
    }
  }
  return { state, messages };
}

/** A capability that delivers to the operator: `<id>.notify` on a local service's streamable-HTTP MCP surface. */
export function notifyChannelOf(s: Pick<ServiceSnapshot, 'key' | 'state' | 'descriptor' | 'wellKnown'>): { key: string; origin: string; path: string; capability: string } | null {
  const mcp = s.wellKnown?.surfaces.mcp;
  const origin = s.descriptor?.origin ?? '';
  if (!mcp || mcp.transport !== 'streamable-http' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return null;
  const capability = (mcp.capabilities ?? []).find((c) => /^[a-z][a-z0-9-]*\.notify$/.test(c));
  if (!capability) return null;
  return { key: s.key, origin, path: mcp.path, capability };
}

/** The channel the person chose: `auto` takes the one service that offers it (none, or several, is no channel). */
export function chooseChannel(services: readonly Pick<ServiceSnapshot, 'key' | 'state' | 'descriptor' | 'wellKnown'>[], choice: string): ReturnType<typeof notifyChannelOf> | { none: 'off' | 'none-installed' | 'several' | 'chosen-gone' } {
  if (choice === 'off') return { none: 'off' };
  const offered = services.map(notifyChannelOf).filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (choice !== 'auto') return offered.find((c) => c.key === choice) ?? { none: 'chosen-gone' };
  if (offered.length === 1) return offered[0]!;
  return { none: offered.length ? 'several' : 'none-installed' };
}
// #endregion outage-alerts
