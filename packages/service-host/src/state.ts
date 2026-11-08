// The one state a service is in, in the precedence of the Fabric Dashboards design §3.3. The
// shared vectors (test-vectors/state-precedence.json) are the normative test of this order; any
// host that reads services/ runs them. Pure: no Node import, so a renderer may import
// `@passioncode-ai/fabric-service-host/state`.
import { heldButSilent } from './health';
import type { Busy, ClaimConflict, Descriptor, Elsewhere, LaunchdStatus, Reason, ServiceState, WellKnown, WellKnownResult } from './protocol';

// #region state-precedence — docs: packages/service-host/README.md#state-precedence

/** Silence shorter than this after answering is `starting`; longer is `down`. */
export const DOWN_AFTER_MS = 15_000;
/** DEC-0019: an online service is reached over the internet; a minute of silence before `down` (ADR-0008). */
export const REMOTE_DOWN_AFTER_MS = 60_000;

export interface StateInput {
  descriptor: Descriptor | null;
  problems: string[];
  conflict: ClaimConflict | null | undefined;
  launchd: LaunchdStatus;
  probe: WellKnownResult | null; // null: not probed (invalid, conflict)
  firstUnansweredAt: number | null; // ms epoch when answers stopped
  now: number;
  busy: Busy;
  /** FD-132: the placement record puts it on another machine; absent or null: placed here. */
  elsewhere?: Elsewhere | null;
  /** FD-158: the host checked its port and the listening socket is not this OS user's own (FD-159: `unknown`, its owner
   * could not be told, DEC-0154 HA-2); absent: not checked. */
  foreignUser?: boolean | 'unknown';
}

export interface StateOutput { state: ServiceState; reasons: Reason[] }

export function deriveState(i: StateInput): StateOutput {
  if (!i.descriptor || i.problems.length) {
    return { state: 'invalid', reasons: [{ code: 'reason.invalid', params: { problem: i.problems[0] ?? 'unreadable' } }] };
  }
  const d = i.descriptor;
  if (i.conflict) {
    return { state: 'conflict', reasons: [{ code: i.conflict.port ? 'reason.conflict.port' : 'reason.conflict.key', params: { port: i.conflict.port ?? 0, with: i.conflict.with.join(', ') } }] };
  }
  if (i.busy === 'stopping') return { state: 'stopping', reasons: [] };
  if (i.busy === 'starting' || i.busy === 'restarting') return { state: 'starting', reasons: [] };

  const probe = i.probe;
  if (d.placement === 'remote') return remoteState(d, probe, i);
  const away = i.elsewhere ?? null;
  // FD-158, DEC-0154 HA-2: a listener of another OS account, or one whose owner cannot be told, wins over whatever it
  // answers, its own id included, and over its silence; its answer is never shown as this agent's. A port nobody holds
  // (a refused connection) stays `down` below.
  if (i.foreignUser && (probe?.kind === 'answer' || probe?.kind === 'not-protocol' || probe?.kind === 'refused' || heldButSilent(probe))) {
    return { state: 'foreign-user', reasons: [{ code: i.foreignUser === 'unknown' ? 'reason.foreign.unknown' : 'reason.foreign.user', params: { port: portNum(d.origin) } }] };
  }
  if (probe?.kind === 'answer') {
    const svc = probe.doc.service;
    if (svc.id !== d.id || svc.instance !== d.instance) {
      return { state: 'foreign', reasons: [{ code: 'reason.foreign.other', params: { port: portNum(d.origin), answer: `${svc.id}.${svc.instance}` } }] };
    }
    if (away) {
      // FD-179: this machine's own job for it is not running (launchd has it unloaded, or loaded without a process): the
      // answer comes from the placed copy through a forward of the port, as the move's SSH tunnels do. It is that copy's
      // health, said with where it runs. A host that does not supervise it cannot tell, and keeps the FD-132 rule.
      if (i.launchd.managed && (!i.launchd.loaded || i.launchd.pid === null)) {
        const own = fromWellKnown(probe.doc);
        return { state: own.state, reasons: [...own.reasons, { code: 'reason.reached.elsewhere', params: { machine: away.placedOn } }] };
      }
      // FD-132: placed on the other machine and running here too: two copies, one of them on the wrong machine.
      return { state: 'duplicate', reasons: [{ code: 'reason.duplicate.elsewhere', params: { machine: away.placedOn } }] };
    }
    if (i.launchd.managed && i.launchd.loaded && i.launchd.pid !== null && i.launchd.pid !== probe.doc.process.pid) {
      return { state: 'duplicate', reasons: [{ code: 'reason.duplicate', params: { answering: probe.doc.process.pid, launchd: i.launchd.pid } }] };
    }
    return fromWellKnown(probe.doc);
  }
  if (probe?.kind === 'not-protocol') {
    return { state: 'foreign', reasons: [{ code: 'reason.foreign.protocol', params: { port: portNum(d.origin), detail: probe.detail } }] };
  }
  // A program on the port answers 401 or 403 to the well-known document: it turned this host away. That is not proof of
  // another program (the agent itself may refuse a peer it cannot place, DEC-0154 HA-2), and nothing is read from it:
  // the agent serves this host nothing, so it reads down, with the refusal as the reason.
  if (probe?.kind === 'refused') return { state: 'down', reasons: [{ code: 'reason.refused', params: { port: portNum(d.origin), detail: probe.detail } }] };
  // No answer.
  // FD-132: silent here because it runs on the other machine: off here, never down, whatever launchd says.
  if (away) return { state: 'stopped', reasons: [{ code: 'reason.elsewhere', params: { machine: away.placedOn } }] };
  if (i.launchd.managed && (i.launchd.disabled || !i.launchd.loaded)) {
    return { state: 'stopped', reasons: [{ code: i.launchd.disabled ? 'reason.stopped' : 'reason.not-loaded' }] };
  }
  const since = i.firstUnansweredAt ?? i.now;
  if (i.now - since < DOWN_AFTER_MS) return { state: 'starting', reasons: [{ code: 'reason.waiting' }] };
  return { state: 'down', reasons: [{ code: 'reason.down', params: { since: new Date(since).toISOString() } }] };
}

/**
 * DEC-0019: a remote placement. No launchd, so no `stopped`/`duplicate` (several processes may
 * answer one origin). A definite refusal — the token, TLS, a redirect — is `down` at once with its
 * reason; silence waits REMOTE_DOWN_AFTER_MS, because a missed probe over the internet is not an
 * outage.
 */
function remoteState(d: Descriptor, probe: WellKnownResult | null, i: StateInput): StateOutput {
  if (probe?.kind === 'answer') {
    const svc = probe.doc.service;
    if (svc.id !== d.id || svc.instance !== d.instance) {
      return { state: 'foreign', reasons: [{ code: 'reason.remote.foreign', params: { origin: d.origin, answer: `${svc.id}.${svc.instance}` } }] };
    }
    return fromWellKnown(probe.doc);
  }
  if (probe?.kind === 'not-protocol') {
    return { state: 'foreign', reasons: [{ code: 'reason.remote.protocol', params: { origin: d.origin, detail: probe.detail } }] };
  }
  if (probe?.kind === 'refused') return { state: 'down', reasons: [{ code: 'reason.remote.refused', params: { origin: d.origin } }] };
  if (probe?.kind === 'no-answer' && probe.cause === 'tls') return { state: 'down', reasons: [{ code: 'reason.remote.tls', params: { origin: d.origin, detail: probe.detail } }] };
  if (probe?.kind === 'no-answer' && probe.cause === 'redirect') return { state: 'down', reasons: [{ code: 'reason.remote.redirect', params: { origin: d.origin } }] };
  const since = i.firstUnansweredAt ?? i.now;
  if (i.now - since < REMOTE_DOWN_AFTER_MS) return { state: 'starting', reasons: [{ code: 'reason.waiting' }] };
  // An HTTP 5xx is the platform answering for a service that is not up: down with the status, after the same grace as silence.
  if (probe?.kind === 'no-answer' && probe.cause === 'http') return { state: 'down', reasons: [{ code: 'reason.remote.http', params: { origin: d.origin, detail: probe.detail } }] };
  return { state: 'down', reasons: [{ code: 'reason.remote.down', params: { origin: d.origin, since: new Date(since).toISOString() } }] };
}

function fromWellKnown(doc: WellKnown): StateOutput {
  if (doc.status === 'starting' || doc.status === 'stopping') return { state: doc.status, reasons: [] };
  if (doc.degraded.length || doc.status === 'degraded') {
    // DEC-0044: a source waiting for a person's setup is said as such, not as a failure.
    return { state: 'degraded', reasons: doc.degraded.map((x) => ({ code: x.setup === true ? 'reason.setup' : 'reason.degraded', params: { source: x.source, reason: x.reason } })) };
  }
  return { state: 'ready', reasons: [] };
}

function portNum(origin: string): number {
  return Number(/:(\d+)$/.exec(origin)?.[1] ?? 0);
}

/** Needs-attention severity: lower sorts first; null means nothing to show. */
export function attentionRank(state: ServiceState, wellKnown: WellKnown | null): number | null {
  const order: Partial<Record<ServiceState, number>> = { down: 0, duplicate: 1, 'foreign-user': 2, foreign: 2, conflict: 3, invalid: 4, degraded: 6 };
  if (state in order) return order[state]!;
  if (wellKnown?.update?.available) return 8;
  if (wellKnown?.summary?.some((t) => t.attention)) return 7;
  return null;
}
/** FD-132: the reason that says the service is placed on another machine, if it carries one. */
export function placedElsewhere(reasons: readonly Reason[]): string | null {
  const r = reasons.find((x) => x.code === 'reason.elsewhere' || x.code === 'reason.duplicate.elsewhere' || x.code === 'reason.reached.elsewhere');
  return r ? String(r.params?.machine ?? '') : null;
}
// #endregion state-precedence
