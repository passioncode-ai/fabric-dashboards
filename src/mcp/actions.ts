// #region own-actions — docs: docs/ux/scenarios.md#scn-028-an-agent-reads-and-administers-services-through-mcp
// FD-110 part 3 (contract DEC-0121, AP-1 and AP-2; fabric-workspace MD-10 with its note acc45a98): this app's own
// buttons and their agent twins on the fabric-dashboards MCP surface, declared under the actions extension key in the
// `initialize` answer's `_meta` (the app serves no well-known document). Start, Stop, Restart and Update change
// another agent, so their gate is `relayed`: a call that carries the operator's decision in `_meta.decision` is
// recorded as the operator's, and an invalid decision is refused `decision-invalid`. Until the app can ask the person
// itself (an elicitation) or the Fabric hub relays a decision (CT-125), a call without one still runs and is recorded
// as the caller's own act: Claude Code and Codex cannot set `_meta` yet, and refusing them would take `control` and
// `update` away from every coding agent (the operator's rule of 2026-10-23: never break what works).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ACTIONS_EXTENSION, type DeclaredAction } from '@passioncode-ai/fabric-service-host/actions';
import { places } from '../core/platform';

export const OWN_ACTIONS: DeclaredAction[] = [
  { id: 'open-dashboard', title: 'Open dashboard', tool: 'open', gate: 'none' },
  { id: 'self-check', title: 'Self-check', tool: 'doctor', gate: 'none' },
  { id: 'start', title: 'Start', tool: 'control', gate: 'relayed' },
  { id: 'stop', title: 'Stop', tool: 'control', gate: 'relayed' },
  { id: 'restart', title: 'Restart', tool: 'control', gate: 'relayed' },
  { id: 'update', title: 'Update', tool: 'update', gate: 'relayed' },
  // ADR-0025 (FD-120): the console's buttons, through the app's channel; they start a program in the person's folder.
  { id: 'new-session', title: 'New session', tool: 'console_new', gate: 'relayed' },
  { id: 'fix-with-coding-agent', title: 'Fix with coding agent', tool: 'console_fix', gate: 'relayed' },
];

/** The `_meta` of the initialize answer: this app's declared actions (DEC-0121 AP-1). */
export const ACTIONS_META = { [ACTIONS_EXTENSION]: { actions: OWN_ACTIONS } };

/** The declared action a tool call performs, or null for a call no button stands for. */
export function actionOf(tool: string, args: Record<string, unknown>): DeclaredAction | null {
  if (tool === 'control') return OWN_ACTIONS.find((a) => a.tool === 'control' && a.id === args.action) ?? null;
  return OWN_ACTIONS.find((a) => a.tool === tool) ?? null;
}

const DECISION_LIFETIME_MS = 24 * 60 * 60_000;
const DECISION_AHEAD_MS = 60_000;
const RFC3339 = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;
const REQUEST_KEY = /^[A-Za-z0-9_.-]{1,64}$/;
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export type DecisionOutcome =
  | { ok: true; recordAs: 'caller' }
  | { ok: true; recordAs: { by: 'operator'; via: 'relayed-instruction'; caller: string }; decision: { action: string; target?: string; instruction: string; at: string } }
  | { ok: false; code: 'decision-invalid'; message: string };

/**
 * What a call of `action` on `target` carrying `decision` (the call's `_meta.decision`) is recorded as. The checks are
 * decision.schema.json's (by, via, action, target, instruction, at, nothing else) and AP-2's: the action it names, the
 * object it names, from its `at` for 24 hours and no more than 60 s ahead of `now`.
 */
export function decisionFor(action: DeclaredAction, target: string | null, decision: unknown, now: number, caller: string): DecisionOutcome {
  if (action.gate !== 'relayed' || decision === undefined) return { ok: true, recordAs: 'caller' };
  const invalid = (message: string): DecisionOutcome => ({ ok: false, code: 'decision-invalid', message });
  if (!isPlain(decision)) return invalid('the decision is not an object');
  const extra = Object.keys(decision).filter((k) => !['by', 'via', 'action', 'target', 'instruction', 'at'].includes(k));
  if (extra.length) return invalid(`the decision carries ${extra[0]}, which decision.schema.json does not`);
  if (decision.by !== 'operator') return invalid('a decision is the operator\'s: by is "operator"');
  if (decision.via !== 'relayed-instruction') return invalid('via is "relayed-instruction"');
  if (typeof decision.action !== 'string' || !REQUEST_KEY.test(decision.action)) return invalid('action is an action id');
  if (decision.action !== action.id) return invalid(`the decision is for ${decision.action}, not ${action.id}`);
  if (decision.target !== undefined) {
    if (typeof decision.target !== 'string' || decision.target.length < 1 || decision.target.length > 200) return invalid('target is 1 to 200 characters');
    if (decision.target !== target) return invalid(`the decision names ${decision.target}, not ${target ?? 'this call\'s object'}`);
  }
  if (typeof decision.instruction !== 'string' || decision.instruction.length < 1 || [...decision.instruction].length > 500) return invalid('instruction is the operator\'s words, 1 to 500 characters');
  if (typeof decision.at !== 'string' || !RFC3339.test(decision.at) || Number.isNaN(Date.parse(decision.at))) return invalid('at is an RFC 3339 time');
  const at = Date.parse(decision.at);
  if (at > now + DECISION_AHEAD_MS) return invalid('the decision is dated in the future');
  if (now - at > DECISION_LIFETIME_MS) return invalid('the decision is more than 24 hours old');
  return {
    ok: true, recordAs: { by: 'operator', via: 'relayed-instruction', caller },
    decision: { action: decision.action, ...(decision.target !== undefined ? { target: decision.target as string } : {}), instruction: decision.instruction, at: decision.at },
  };
}

/** Where the decisions of the operator relayed to this app are kept: beside the app's own log, 0600 (never the events
 *  feed, a usage report or any page: an instruction may name people, AP-2). */
export function decisionsFile(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const logs = places(platform, env, home)?.logs ?? p.join(home, 'Library', 'Logs', 'Fabric Dashboards');
  return p.join(logs, 'decisions.jsonl');
}

/** One audit line per relayed act; a failure to write is reported to the caller, never swallowed into a silent act. */
export function recordDecision(file: string, row: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.appendFileSync(file, `${JSON.stringify(row)}\n`, { mode: 0o600 });
}
// #endregion own-actions
