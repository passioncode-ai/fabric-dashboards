// #region auditor — docs: docs/adr/0023-the-auditor-and-the-connections-map.md#decision
// FD-81 (operator 2026-10-21): the auditor. One pass over every installed agent, live with each status push: what does
// not work (the agent itself, a part it reports, a connection it declares, an agent in its chain), what waits for a
// person (a part marked `setup: true`, DEC-0044), what is out of date, and which spending limit stopped work or is over
// its line. Each finding names the agent to fix, so the person can hand it to a coding agent in one click. Pure: the
// window, the tray and the MCP server read the same findings. Findings are codes with parameters, translated by the
// reader (never a sentence of the app's own here), and an agent's own words stay as it wrote them.
import { connectionsOf } from '@passioncode-ai/fabric-service-host/connections';
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import { resolveTarget, stateOfService, type Seen } from './connections';
import { productIdOf } from './products';
import type { Reason } from './types';

/** error: something does not work · warn: works in part · setup: waits for a person · info: worth knowing. */
export type Severity = 'error' | 'warn' | 'setup' | 'info';
export type FindingKind = 'state' | 'part' | 'connection' | 'chain' | 'declaration' | 'update' | 'limit';

export interface Finding {
  /** Stable across passes: the same problem keeps its id while it lasts. */
  id: string;
  /** The agent to fix (its `id.instance` key). */
  key: string;
  severity: Severity;
  kind: FindingKind;
  /** What the reader shows: an app sentence by code, or the agent's own words in `params.text`. */
  reason: Reason;
}

export interface AuditCoverage {
  agents: number;
  /** Agents whose well-known document declares its connections (extensions/connections/0.1). */
  declaring: number;
}

export interface Audit {
  findings: Finding[];
  coverage: AuditCoverage;
  /** Findings by severity, for a badge and a summary line. */
  counts: Record<Severity, number>;
}

const PROBLEM = new Set(['down', 'duplicate', 'foreign', 'conflict', 'invalid']);
const ORDER: Record<Severity, number> = { error: 0, warn: 1, setup: 2, info: 3 };
const nameOf = (s: Seen) => s.descriptor?.name ?? s.wellKnown?.service.name ?? s.key;

/** Every finding for the agents installed now. `limits` are the ranked spending limits each agent reported, by key. */
export function audit(all: readonly Seen[], limits: Readonly<Record<string, readonly LimitView[]>> = {}): Audit {
  const out: Finding[] = [];
  const add = (f: Finding) => out.push(f);
  let declaring = 0;
  for (const s of all) {
    // The agent itself: one finding with its own reasons, so a person reads why, not only that.
    if (PROBLEM.has(s.state)) {
      add({ id: `${s.key}:state`, key: s.key, severity: 'error', kind: 'state', reason: s.reasons[0] ?? { code: `audit.state.${s.state}`, params: {} } });
    }
    for (const d of s.wellKnown?.degraded ?? []) {
      add({ id: `${s.key}:part:${d.source}`, key: s.key, severity: d.setup ? 'setup' : 'warn', kind: 'part', reason: { code: d.setup ? 'audit.part.setup' : 'audit.part.failing', params: { source: d.source, text: d.reason } } });
    }
    if (s.wellKnown?.update?.available) {
      add({ id: `${s.key}:update`, key: s.key, severity: 'info', kind: 'update', reason: { code: 'audit.update', params: { version: s.wellKnown.update.available } } });
    }
    const view = connectionsOf(s.wellKnown);
    if (view.declared) declaring += 1;
    if (view.errors.length) {
      add({ id: `${s.key}:declaration`, key: s.key, severity: 'warn', kind: 'declaration', reason: { code: 'audit.declaration.invalid', params: { errors: view.errors.slice(0, 3).join('; ') } } });
    }
    for (const c of view.connections) {
      const failing = c.state === 'down' || c.state === 'degraded';
      if (c.kind !== 'service') {
        if (failing) add({ id: `${s.key}:conn:${c.id}`, key: s.key, severity: c.state === 'down' ? 'error' : 'warn', kind: 'connection', reason: { code: `audit.connection.${c.state}`, params: { name: c.label ?? c.target, text: c.reason ?? '' } } });
        continue;
      }
      const reached = resolveTarget(c.target, all);
      if (!reached) {
        add({ id: `${s.key}:conn:${c.id}`, key: s.key, severity: 'warn', kind: 'connection', reason: { code: 'audit.connection.missing', params: { name: c.label ?? c.target } } });
        continue;
      }
      const theirs = stateOfService(reached.state);
      if (failing) {
        add({ id: `${s.key}:conn:${c.id}`, key: s.key, severity: c.state === 'down' ? 'error' : 'warn', kind: 'connection', reason: { code: `audit.connection.${c.state}`, params: { name: nameOf(reached), text: c.reason ?? '' } } });
      } else if (theirs === 'down' || theirs === 'degraded') {
        // The agent's own call is fine as far as it knows; the one it relies on is not. Named on the caller, so the
        // person sees whose work is at risk; the fix belongs to the agent reached, which has its own finding.
        add({ id: `${s.key}:chain:${c.id}`, key: s.key, severity: theirs === 'down' ? 'error' : 'warn', kind: 'chain', reason: { code: `audit.chain.${theirs}`, params: { name: nameOf(reached), target: reached.key } } });
      }
    }
    for (const l of limits[s.key] ?? []) {
      if (l.state === 'tripped' || l.state === 'breach') {
        add({ id: `${s.key}:limit:${l.id}`, key: s.key, severity: l.state === 'tripped' ? 'error' : 'warn', kind: 'limit', reason: { code: `audit.limit.${l.state}`, params: { limit: l.id } } });
      }
    }
  }
  out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || (a.id < b.id ? -1 : 1));
  const counts: Record<Severity, number> = { error: 0, warn: 0, setup: 0, info: 0 };
  for (const f of out) counts[f.severity] += 1;
  return { findings: out, coverage: { agents: all.length, declaring }, counts };
}

/** Findings grouped by the agent to fix, worst agent first. */
export function byAgent(findings: readonly Finding[]): { key: string; findings: Finding[] }[] {
  const groups = new Map<string, Finding[]>();
  for (const f of findings) groups.set(f.key, [...(groups.get(f.key) ?? []), f]);
  return [...groups.entries()].map(([key, list]) => ({ key, findings: list }))
    .sort((a, b) => ORDER[a.findings[0]!.severity] - ORDER[b.findings[0]!.severity] || (a.key < b.key ? -1 : 1));
}

/** The text a coding agent gets for its task: every finding of one agent, as the reader worded it. */
export function auditBrief(name: string, key: string, lines: readonly string[]): string {
  return `${name} (\`${key}\`) has ${lines.length} problem(s) the Fabric Dashboards auditor found:\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\n`
    + 'Find the cause of each in its repository, logs and recent events (context.md), fix what is this agent\'s to fix, and confirm with the MCP tools `audit` and `service_status` that the findings are gone. A finding about an agent it uses belongs to that agent: say so rather than working around it. Ask me before anything destructive, any sign-in, or a secret.';
}

// #endregion auditor
