// #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
// FD-48 (operator decision 2026-10-11): an outage reaches the operator away from the Mac. The app's shared watcher
// sends one message when a service has been unavailable for fifteen minutes and one when it is back (FD-76: the
// operator's rule of 2026-10-19 for the Telegram channel, one case once and no routine), through the
// operator-channel service on this machine — an installed service that declares an MCP capability `<id>.notify`
// (the contract's operator channel, OC-4). Pure: what an episode is, what it owes, and through which service.
//
// The state is the queue. An episode records what was DELIVERED (set only when the channel answered), so a failed
// delivery, a missing channel or a restart never loses a message, a recovery never precedes its failure, and a
// recovery is never sent for a failure nobody received.
import type { ServiceSnapshot, ServiceState } from './types';

/** How long an outage lasts before it is sent (the banner keeps ADR-0008's one minute). FD-76: over 15 minutes. */
export const OUTAGE_ALERT_AFTER_MS = 15 * 60_000;
/** How long a service must stay well before its episode closes: a service that falls again within this time is the
 *  same case, told once (FD-76), not a new failure and a new recovery. */
export const OUTAGE_CLEAR_AFTER_MS = 15 * 60_000;
/** A message the channel never takes is given up a day after its episode closed. */
export const OUTAGE_GIVE_UP_MS = 24 * 60 * 60_000;

/** One message to the operator channel; its eventId is the same on every retry, so it is delivered once. */
export interface AlertMessage { eventId: string; kind: 'failure' | 'recovery'; subject: string; text: string; serviceKey: string }

export interface Episode {
  start: number;
  name: string;
  /** Why, as the latest look saw it (the subject of the failure). */
  cause: 'down' | 'degraded';
  why: string;
  source?: string;
  /** When the service last looked well; the episode closes OUTAGE_CLEAR_AFTER_MS later. */
  clearSince: number | null;
  /** When it closed (the service is well, or was removed); null while open. */
  end: number | null;
  removed?: boolean;
  failureDelivered: boolean;
  recoveryDelivered: boolean;
}

/** What the watcher keeps across ticks and restarts (`outage-alerts.json` in the app's data). */
export interface OutageState {
  /** A service's degraded sources when it started: a setup state there since the start is not an outage. */
  baselines: Record<string, { startedAt: string; sources: string[] }>;
  /** One episode per service, open or closed-but-owing. */
  episodes: Record<string, Episode>;
}

export const emptyOutageState = (): OutageState => ({ baselines: {}, episodes: {} });

/** What the watcher needs of a service. */
export interface Watched { key: string; name: string; state: ServiceState; startedAt: string | null; degraded: { source: string; reason: string; setup?: boolean }[]; reason: string }

export function watchedOf(s: ServiceSnapshot, name: string, reason: string): Watched {
  return { key: s.key, name, state: s.state, startedAt: s.wellKnown?.process.startedAt ?? null, degraded: s.wellKnown?.degraded ?? [], reason };
}

export interface Words {
  down: (name: string) => string; failing: (name: string, source: string) => string; back: (name: string) => string;
  removed: (name: string) => string; since: (minutes: number, reason: string) => string; after: (minutes: number) => string;
  /** The channel could not be reached during the outage: one message after it, with how long. */
  wasDown: (minutes: number, reason: string) => string;
}

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

/**
 * One look at every service: open, update and close episodes. Only a confirmed outage (`down`, ADR-0008) opens an
 * episode (FD-76: the channel carries unavailability, a degraded source stays on the Mac); while one is open, a
 * degraded source outside the service's start baseline keeps it open, so going from down to degraded is not a
 * recovery. A baseline source that recovers leaves the baseline, so its next failure counts. A service gone from the
 * folder closes its episode as removed.
 */
export function observe(prev: OutageState, services: readonly Watched[], now: number): OutageState {
  const state: OutageState = { baselines: { ...prev.baselines }, episodes: { ...prev.episodes } };
  const present = new Set(services.map((s) => s.key));
  for (const [key, ep] of Object.entries(state.episodes)) {
    if (!present.has(key) && ep.end === null) state.episodes[key] = { ...ep, end: now, removed: true };
  }
  for (const key of Object.keys(state.baselines)) if (!present.has(key)) delete state.baselines[key];
  for (const s of services) {
    // A source marked `setup: true` (DEC-0044) is answered by its flag, so it never enters the baseline either.
    const sources = s.degraded.filter((d) => d.setup !== true).map((d) => d.source);
    const base = state.baselines[s.key];
    // The baseline is the first look after the service LEFT `starting`: a service fills its degraded list during
    // start-up (its first health check), so a look while it still starts would see an empty list.
    if (s.startedAt && base?.startedAt !== s.startedAt) { if (s.state !== 'starting') state.baselines[s.key] = { startedAt: s.startedAt, sources }; }
    else if (base && s.state !== 'down') state.baselines[s.key] = { ...base, sources: base.sources.filter((x) => sources.includes(x)) };
    const baseline = new Set(state.baselines[s.key]?.sources ?? []);
    // DEC-0044 first: an entry marked `setup: true` waits for a person and never opens an episode. The start baseline
    // stays the fallback for a service that does not send the flag yet.
    const fresh = s.state === 'degraded' ? s.degraded.filter((d) => d.setup !== true && !baseline.has(d.source)) : [];
    const cause: Pick<Episode, 'cause' | 'why' | 'source'> | null = s.state === 'down'
      ? { cause: 'down', why: s.reason }
      : fresh.length ? { cause: 'degraded', why: fresh[0]!.reason, source: fresh[0]!.source } : null;
    const ep = state.episodes[s.key];
    if (cause && (s.state === 'down' || (ep && ep.end === null))) {
      if (!ep || ep.end !== null) {
        // A closed episode that still owes its recovery keeps its own key until delivered; the new one starts now.
        if (ep && ep.end !== null) state.episodes[`${s.key}#${ep.start}`] = ep;
        state.episodes[s.key] = { start: now, name: s.name, ...cause, clearSince: null, end: null, failureDelivered: false, recoveryDelivered: false };
      } else {
        state.episodes[s.key] = { ...ep, name: s.name, ...cause, clearSince: null };
      }
    } else if (ep && ep.end === null) {
      const clearSince = ep.clearSince ?? now;
      state.episodes[s.key] = now - clearSince >= OUTAGE_CLEAR_AFTER_MS ? { ...ep, clearSince, end: clearSince } : { ...ep, clearSince };
    }
  }
  // Forget what owes nothing: closed and settled, or given up a day after it closed.
  for (const [id, ep] of Object.entries(state.episodes)) {
    if (ep.end === null) continue;
    const settled = ep.recoveryDelivered || (!ep.failureDelivered && ep.end - ep.start < OUTAGE_ALERT_AFTER_MS);
    if (settled || now - ep.end > OUTAGE_GIVE_UP_MS) delete state.episodes[id];
  }
  return state;
}

/** One episode id per outage, the same across restarts; never a `/`, at most 160 characters. */
const idOf = (key: string, ep: Episode) => `outage:${key.split('#')[0]!.slice(0, 120)}:${Math.floor(ep.start / 1000)}`;

/**
 * What the state owes now, in order: a failure once an open episode has lasted fifteen minutes and the service is
 * still unavailable (never during the calm before an episode closes, FD-76); after a delivered
 * failure, the recovery once it closed; an outage that closed with its failure undelivered (the channel itself was
 * unreachable) is told once afterwards. `allowed` is the person's own rules: an episode they muted owes nothing.
 */
export function owed(state: OutageState, now: number, words: Words, allowed: (key: string) => boolean): { id: string; step: 'failure' | 'recovery'; msg: AlertMessage }[] {
  const out: { id: string; step: 'failure' | 'recovery'; msg: AlertMessage }[] = [];
  for (const [id, ep] of Object.entries(state.episodes).sort((a, b) => a[1].start - b[1].start)) {
    const key = id.split('#')[0]!;
    if (!allowed(key)) continue;
    const eventId = idOf(id, ep);
    const lasted = (ep.end ?? now) - ep.start;
    if (ep.end === null) {
      // Only while it is unavailable now: an episode in its calm (clearSince set) is a service that is well again.
      if (!ep.failureDelivered && ep.clearSince === null && lasted >= OUTAGE_ALERT_AFTER_MS) {
        out.push({ id, step: 'failure', msg: { serviceKey: key, kind: 'failure', eventId, subject: ep.cause === 'down' ? words.down(ep.name) : words.failing(ep.name, ep.source ?? '?'), text: words.since(minutes(lasted), ep.why) } });
      }
      continue;
    }
    if (ep.recoveryDelivered) continue;
    const subject = ep.removed ? words.removed(ep.name) : words.back(ep.name);
    if (ep.failureDelivered) out.push({ id, step: 'recovery', msg: { serviceKey: key, kind: 'recovery', eventId: `${eventId}:back`, subject, text: words.after(minutes(lasted)) } });
    else if (lasted >= OUTAGE_ALERT_AFTER_MS) out.push({ id, step: 'recovery', msg: { serviceKey: key, kind: 'recovery', eventId: `${eventId}:back`, subject, text: words.wasDown(minutes(lasted), ep.why) } });
  }
  return out;
}

/** The channel took a message: the only place an episode's delivery is recorded. */
export function delivered(state: OutageState, id: string, step: 'failure' | 'recovery'): OutageState {
  const ep = state.episodes[id];
  if (!ep) return state;
  return { ...state, episodes: { ...state.episodes, [id]: step === 'failure' ? { ...ep, failureDelivered: true } : { ...ep, recoveryDelivered: true } } };
}

/** A capability that delivers to the operator: `<id>.notify` on a local service's streamable-HTTP MCP surface. */
export function notifyChannelOf(s: Pick<ServiceSnapshot, 'key' | 'state' | 'descriptor' | 'wellKnown'>): { key: string; origin: string; path: string; capability: string } | null {
  const mcp = s.wellKnown?.surfaces.mcp;
  const origin = s.descriptor?.origin ?? '';
  if (!mcp || mcp.transport !== 'streamable-http' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || !/^\/(?!\/)/.test(mcp.path)) return null;
  const capability = (mcp.capabilities ?? []).find((c) => /^[a-z][a-z0-9-]*\.notify$/.test(c));
  if (!capability) return null;
  return { key: s.key, origin, path: mcp.path, capability };
}

export type NoChannel = 'off' | 'none-installed' | 'several' | 'chosen-gone' | 'chosen-unreachable';

/** The channel the person chose: `auto` takes the one service that offers it (none, or several, is no channel). A
 *  chosen service that is installed but not answering is unreachable, not gone. */
export function chooseChannel(services: readonly Pick<ServiceSnapshot, 'key' | 'state' | 'descriptor' | 'wellKnown'>[], choice: string): NonNullable<ReturnType<typeof notifyChannelOf>> | { none: NoChannel } {
  if (choice === 'off') return { none: 'off' };
  const offered = services.map(notifyChannelOf).filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (choice !== 'auto') return offered.find((c) => c.key === choice) ?? { none: services.some((s) => s.key === choice) ? 'chosen-unreachable' : 'chosen-gone' };
  if (offered.length === 1) return offered[0]!;
  return { none: offered.length ? 'several' : 'none-installed' };
}
// #endregion outage-alerts
