// #region auditor — docs: docs/adr/0023-the-auditor-and-the-connections-map.md#decision
// FD-81 (operator 2026-10-21): the auditor. One pass over every installed agent, live with each status push: what does
// not work (the agent itself, a part it reports, a connection it declares, an agent in its chain), what waits for a
// person (a part marked `setup: true`, DEC-0044), what is out of date, and which spending limit stopped work or is over
// its line. Each finding names the agent to fix, so the person can hand it to a coding agent in one click. Pure: the
// window, the tray and the MCP server read the same findings. Findings are codes with parameters, translated by the
// reader (never a sentence of the app's own here), and an agent's own words stay as it wrote them.
import { ACTIONS_EXTENSION, actionsOf } from '@passioncode-ai/fabric-service-host/actions';
import { LOAD_EXTENSION, loadOf } from '@passioncode-ai/fabric-service-host/load';
import { CONNECTIONS_EXTENSION, connectionsOf } from '@passioncode-ai/fabric-service-host/connections';
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import { resolveTarget, stateOfService, type Seen } from './connections';
import { productIdOf } from './products';
import type { Reason } from './types';

/** FD-151: extensions whose short key an agent may write by mistake. */
const SHORTENED = [CONNECTIONS_EXTENSION, LOAD_EXTENSION, ACTIONS_EXTENSION, 'https://fabric.passioncode.ai/agent-contract/extensions/dashboard/0.1'];

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

const PROBLEM = new Set(['down', 'duplicate', 'foreign-user', 'foreign', 'conflict', 'invalid']);
const ORDER: Record<Severity, number> = { error: 0, warn: 1, setup: 2, info: 3 };
const nameOf = (s: Seen) => s.descriptor?.name ?? s.wellKnown?.service.name ?? s.key;
/** A repository address's last segment (`https://github.com/org/name.git` → `name`), or null. */
const repoNameOf = (url: string | undefined): string | null => {
  const m = /([^/:\s]+?)(?:\.git)?\/?$/.exec(url?.trim() ?? '');
  return m ? m[1]! : null;
};

/** Every finding for the agents installed now. `limits` are the ranked spending limits each agent reported, by key. */
/** FD-226: a failing connection or part, in a sentence that reads whole: its name, then the agent's own words after a
 *  colon, or a full stop when it gave none. */
function connectionReason(state: string, name: string, text: string): { code: string; params: Record<string, string> } {
  return text.trim() ? { code: `audit.connection.${state}`, params: { name, text } } : { code: `audit.connection.${state}.bare`, params: { name } };
}

export function audit(all: readonly Seen[], limits: Readonly<Record<string, readonly LimitView[]>> = {}): Audit {
  const out: Finding[] = [];
  const add = (f: Finding) => out.push(f);
  let declaring = 0;
  for (const s of all) {
    // The agent itself: one finding with its own reasons, so a person reads why, not only that.
    if (PROBLEM.has(s.state)) {
      add({ id: `${s.key}:state`, key: s.key, severity: 'error', kind: 'state', reason: s.reasons[0] ?? { code: `audit.state.${s.state}`, params: {} } });
    }
    if (s.wellKnown?.update?.available) {
      add({ id: `${s.key}:update`, key: s.key, severity: 'info', kind: 'update', reason: { code: 'audit.update', params: { version: s.wellKnown.update.available } } });
    }
    // #region short-extension-key — docs: docs/ux/scenarios.md#scn-074-see-how-agents-are-wired-and-what-problems-were-found
    // FD-151: an extension declared under the short form of its key (`extensions/connections/0.1`) is read by nobody;
    // without this the agent simply looks as if it declared nothing.
    const ext = (s.wellKnown as { extensions?: unknown } | undefined)?.extensions;
    if (ext && typeof ext === 'object' && !Array.isArray(ext)) {
      for (const full of SHORTENED) {
        const short = full.slice(full.indexOf('extensions/'));
        if (Object.hasOwn(ext, short) && !Object.hasOwn(ext, full)) {
          add({ id: `${s.key}:short:${short}`, key: s.key, severity: 'warn', kind: 'declaration', reason: { code: 'audit.declaration.shortKey', params: { key: short, full } } });
        }
      }
    }
    // #endregion short-extension-key
    const view = connectionsOf(s.wellKnown);
    if (view.declared) declaring += 1;
    // #region part-into-connection — docs: docs/ux/scenarios.md#scn-074-see-how-agents-are-wired-and-what-problems-were-found
    // FD-155: a failing part whose source is the id of a connection the agent declares down or degraded is that one
    // failure, told once on the connection (with the part's words when the connection gives none), not twice.
    const told = new Map(view.connections.filter((c) => c.state === 'down' || c.state === 'degraded').map((c) => [c.id, c]));
    const partWords = new Map<string, string>();
    for (const d of s.wellKnown?.degraded ?? []) {
      if (!d.setup && told.has(d.source)) { partWords.set(d.source, d.reason); continue; }
      add({ id: `${s.key}:part:${d.source}`, key: s.key, severity: d.setup ? 'setup' : 'warn', kind: 'part', reason: { code: d.setup ? 'audit.part.setup' : 'audit.part.failing', params: { source: d.source, text: d.reason } } });
    }
    // #endregion part-into-connection
    if (view.errors.length) {
      add({ id: `${s.key}:declaration`, key: s.key, severity: 'warn', kind: 'declaration', reason: { code: 'audit.declaration.invalid', params: { errors: view.errors.slice(0, 3).join('; ') } } });
    }
    // FD-93 review: an invalid load declaration (FAC-SEM-133) is reported here too, not only in the agent's Load tab.
    const load = loadOf(s.wellKnown);
    if (load.reported) {
      add({ id: `${s.key}:load-declaration`, key: s.key, severity: 'warn', kind: 'declaration', reason: { code: 'audit.declaration.loadInvalid', params: { errors: load.errors.slice(0, 3).join('; ') } } });
    }
    // FD-110 (DEC-0121, CT-126): the actions a service's pages offer and their agent twins. FAC-SEM-142 on the declaration
    // (an invalid value, an id twice, a humanStep that disagrees with gate, a tool its MCP surface does not serve); a
    // service that serves a dashboard and declares none has not adopted the contract's action parity yet.
    const actions = actionsOf(s.wellKnown);
    if (actions.reported) {
      add({ id: `${s.key}:actions-declaration`, key: s.key, severity: 'warn', kind: 'declaration', reason: { code: 'audit.declaration.actionsInvalid', params: { errors: actions.errors.slice(0, 3).join('; ') } } });
    }
    if (!actions.reported) for (const f of actions.findings) {
      const tool = /\/actions\/(\d+)\/tool$/.exec(f.instancePath);
      const at = /\/actions\/(\d+)\//.exec(f.instancePath);
      const action = at ? actions.actions[Number(at[1])] : undefined;
      add({
        id: `${s.key}:action:${f.instancePath.slice(f.instancePath.indexOf('/actions/') + 1)}`, key: s.key, severity: 'warn', kind: 'declaration',
        reason: tool && action
          ? { code: 'audit.action.noTwin', params: { title: action.title, tool: action.tool } }
          : { code: 'audit.action.invalid', params: { title: action?.title ?? '', text: f.message } },
      });
    }
    if (!actions.declared && !actions.reported && s.wellKnown?.surfaces.dashboard) {
      add({ id: `${s.key}:actions-not-adopted`, key: s.key, severity: 'info', kind: 'declaration', reason: { code: 'audit.action.notAdopted', params: {} } });
    }
    for (const c of view.connections) {
      const failing = c.state === 'down' || c.state === 'degraded';
      if (c.kind !== 'service') {
        if (failing) add({ id: `${s.key}:conn:${c.id}`, key: s.key, severity: c.state === 'down' ? 'error' : 'warn', kind: 'connection', reason: connectionReason(c.state, c.label ?? c.target, c.reason ?? partWords.get(c.id) ?? '') });
        continue;
      }
      const reached = resolveTarget(c.target, all);
      if (!reached) {
        // FD-147: a target that is the repository of agents installed here names a repository, not a service; the
        // finding says which services it holds instead of reading as an agent that is missing. Nothing is resolved
        // from it: a repository may hold several services, and the declaration is the agent's to correct.
        const held = all.filter((x) => repoNameOf(x.descriptor?.source?.repository) === c.target).map(nameOf);
        add({ id: `${s.key}:conn:${c.id}`, key: s.key, severity: 'warn', kind: 'connection', reason: held.length
          ? { code: 'audit.connection.repository', params: { name: c.target, services: held.join(', ') } }
          : { code: 'audit.connection.missing', params: { name: c.label ?? c.target } } });
        continue;
      }
      // #region ambiguous-target — docs: docs/ux/scenarios.md#scn-074-see-how-agents-are-wired-and-what-problems-were-found
      // FD-149: a bare product id with several instances here and no `.default` is followed to the first by key, which
      // may not be the one the agent calls; the finding names them all and the one followed, never guesses further.
      if (reached.key !== c.target) {
        const twins = all.filter((x) => productIdOf(x.key) === c.target).map((x) => x.key).sort();
        if (twins.length > 1 && !twins.some((k) => k.endsWith('.default'))) {
          add({ id: `${s.key}:ambiguous:${c.id}`, key: s.key, severity: 'warn', kind: 'connection', reason: { code: 'audit.connection.ambiguous', params: { name: c.target, instances: twins.join(', '), chosen: reached.key } } });
        }
      }
      // #endregion ambiguous-target
      // #region cross-organization — docs: docs/ux/scenarios.md#scn-074-see-how-agents-are-wired-and-what-problems-were-found
      // FD-163 (operator 2026-11-06): an organization's agents work only with agents of the same organization. Told only
      // when both organizations are known (Project Observatory's registry); one not known is never guessed.
      if (s.organization && reached.organization && s.organization.name !== reached.organization.name) {
        add({ id: `${s.key}:org:${c.id}`, key: s.key, severity: 'error', kind: 'connection', reason: { code: 'audit.connection.crossOrg', params: { name: nameOf(reached), theirs: reached.organization.label, ours: s.organization.label } } });
      }
      // #endregion cross-organization
      const theirs = stateOfService(reached.state);
      if (failing) {
        add({ id: `${s.key}:conn:${c.id}`, key: s.key, severity: c.state === 'down' ? 'error' : 'warn', kind: 'connection', reason: connectionReason(c.state, nameOf(reached), c.reason ?? partWords.get(c.id) ?? '') });
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
