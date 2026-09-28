// Deriving the one state a service is in, in the precedence of design §3.3.
import type { Busy, Descriptor, Reason, ServiceState, WellKnown, WellKnownResult } from './types';

export const DOWN_AFTER_MS = 15_000;

export interface StateInput {
  descriptor: Descriptor | null;
  problems: string[];
  conflict: { port?: number; with: string[] } | undefined;
  launchd: { managed: boolean; loaded: boolean; pid: number | null; disabled: boolean };
  probe: WellKnownResult | null; // null: not probed (invalid, conflict)
  firstUnansweredAt: number | null; // ms epoch when answers stopped
  now: number;
  busy: Busy;
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
  if (probe?.kind === 'answer') {
    const svc = probe.doc.service;
    if (svc.id !== d.id || svc.instance !== d.instance) {
      return { state: 'foreign', reasons: [{ code: 'reason.foreign.other', params: { port: portNum(d.origin), answer: `${svc.id}.${svc.instance}` } }] };
    }
    if (i.launchd.managed && i.launchd.loaded && i.launchd.pid !== null && i.launchd.pid !== probe.doc.process.pid) {
      return { state: 'duplicate', reasons: [{ code: 'reason.duplicate', params: { answering: probe.doc.process.pid, launchd: i.launchd.pid } }] };
    }
    return fromWellKnown(probe.doc);
  }
  if (probe?.kind === 'not-protocol') {
    return { state: 'foreign', reasons: [{ code: 'reason.foreign.protocol', params: { port: portNum(d.origin), detail: probe.detail } }] };
  }
  // No answer.
  if (i.launchd.managed && (i.launchd.disabled || !i.launchd.loaded)) {
    return { state: 'stopped', reasons: [{ code: i.launchd.disabled ? 'reason.stopped' : 'reason.not-loaded' }] };
  }
  const since = i.firstUnansweredAt ?? i.now;
  if (i.now - since < DOWN_AFTER_MS) return { state: 'starting', reasons: [{ code: 'reason.waiting' }] };
  return { state: 'down', reasons: [{ code: 'reason.down', params: { since: new Date(since).toISOString() } }] };
}

function fromWellKnown(doc: WellKnown): StateOutput {
  if (doc.status === 'starting' || doc.status === 'stopping') return { state: doc.status, reasons: [] };
  if (doc.degraded.length || doc.status === 'degraded') {
    return { state: 'degraded', reasons: doc.degraded.map((x) => ({ code: 'reason.degraded', params: { source: x.source, reason: x.reason } })) };
  }
  return { state: 'ready', reasons: [] };
}

function portNum(origin: string): number {
  return Number(/:(\d+)$/.exec(origin)?.[1] ?? 0);
}

/** Needs-attention severity: lower sorts first; null means nothing to show. */
export function attentionRank(state: ServiceState, wellKnown: WellKnown | null): number | null {
  const order: Partial<Record<ServiceState, number>> = { down: 0, duplicate: 1, foreign: 2, conflict: 3, invalid: 4, degraded: 6 };
  if (state in order) return order[state]!;
  if (wellKnown?.update?.available) return 8;
  if (wellKnown?.summary?.some((t) => t.attention)) return 7;
  return null;
}
