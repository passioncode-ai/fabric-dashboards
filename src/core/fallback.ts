// #region fallback-chain — docs: docs/ux/scenarios.md#scn-088-choose-the-default-and-fallback-coding-agents
// FD-117: which coding agent starts work and which continue it, in order, when its accounts reach their limits, and
// the model each works on. Switchboard owns all of it (its machine chain, its default agent, its OpenRouter key's
// model and Hermes's own model); this app reads and writes them through Switchboard's CLI, never its files, and
// passes nothing malformed to it.
import type { Runner } from '@passioncode-ai/fabric-service-host';
import { accountsOf } from './switchboard';

export { MAX_LEVELS, modelOf } from './fallback-types';
export type { FbAgent, FbLevel, FallbackState, FallbackRead, FallbackChange } from './fallback-types';
import { MAX_LEVELS } from './fallback-types';
import type { FallbackChange, FallbackRead, FallbackState, FbAgent, FbLevel } from './fallback-types';

const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PIN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const TIMEOUT_MS = 10_000;

type Answer = { data: Record<string, unknown> } | { old: true } | { error: string };

/** One `--json` call: its data, "this Switchboard has no such command", or Switchboard's own sentence. */
async function call(run: Runner, sb: string, args: string[]): Promise<Answer> {
  const r = await run(sb, ['--json', ...args], TIMEOUT_MS);
  let parsed = null as { ok?: unknown; data?: unknown; error?: unknown } | null;
  try { parsed = JSON.parse(r.stdout) as { ok?: unknown; data?: unknown; error?: unknown } | null; } catch { /* plain text */ }
  if (r.code === 0 && parsed?.ok === true && parsed.data && typeof parsed.data === 'object') return { data: parsed.data as Record<string, unknown> };
  const text = `${r.stdout}\n${r.stderr}`;
  if (/unrecognized subcommand|unexpected argument|earlier version than this command/i.test(text)) return { old: true };
  if (typeof parsed?.error === 'string') return { error: parsed.error.slice(0, 300) };
  return { error: text.trim().split('\n').pop()?.slice(0, 200) || `exit ${r.code}` };
}

const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null);

function levelsOf(executors: unknown, labels: Record<string, string>): FbLevel[] {
  const out: FbLevel[] = [];
  for (const x of Array.isArray(executors) ? (executors as Record<string, unknown>[]) : []) {
    const agent = str(x.agent, 64);
    if (!agent || !AGENT_ID.test(agent)) continue;
    const level: FbLevel = { agent };
    const account = str(x.account_id);
    const key = str(x.key);
    if (account) { level.account = account; if (labels[account]) level.accountLabel = labels[account]; }
    if (key) level.key = key;
    out.push(level);
  }
  return out.slice(0, MAX_LEVELS);
}

/** Everything the section shows, in one pass; Hermes is asked only when it is installed. */
export async function readFallback(run: Runner, sb: string): Promise<FallbackRead> {
  const [chains, status, keys, accounts] = await Promise.all([
    call(run, sb, ['chain', 'list']), call(run, sb, ['agents', 'status']), call(run, sb, ['agents', 'openrouter', 'list']), accountsOf(run, sb),
  ]);
  if ('old' in chains || 'old' in status) return { kind: 'old' };
  if ('error' in chains) return { kind: 'error', detail: chains.error };
  if ('error' in status) return { kind: 'error', detail: status.error };
  const labels = accounts?.labels ?? {};

  const agents: FbAgent[] = [];
  for (const a of Array.isArray(status.data.agents) ? (status.data.agents as Record<string, unknown>[]) : []) {
    const id = str(a.id, 64);
    if (!id || !AGENT_ID.test(id) || a.installed !== true) continue;
    agents.push({ id, name: str(a.name, 80) ?? id, offered: a.enabled === true && a.switchable === true, openrouter: a.openrouter === true });
  }
  agents.sort((x, y) => Number(y.offered) - Number(x.offered));
  const nameOf = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  const groupNames: Record<string, string> = {};
  const keyData = 'data' in keys ? keys.data : {};
  for (const p of Array.isArray(keyData.projects) ? (keyData.projects as Record<string, unknown>[]) : []) {
    const pool = str(p.pool, 120);
    if (pool) groupNames[pool] = str(p.name, 120) ?? pool;
  }
  let levels: FbLevel[] = [];
  const others: FallbackState['others'] = [];
  let workflows = 0;
  for (const c of Array.isArray(chains.data.chains) ? (chains.data.chains as Record<string, unknown>[]) : []) {
    const scope = (c.scope ?? {}) as Record<string, unknown>;
    if (scope.kind === 'machine') levels = levelsOf(c.executors, labels);
    else if (scope.kind === 'project') {
      const pool = str(scope.pool, 120) ?? '?';
      others.push({ name: groupNames[pool] ?? pool, agents: levelsOf(c.executors, labels).map((l) => nameOf(l.agent)) });
    } else if (scope.kind === 'workflow') workflows += 1;
  }

  const machineKey = (Array.isArray(keyData.keys) ? (keyData.keys as Record<string, unknown>[]) : []).find((k) => k.pool === null || k.pool === undefined);
  const models: { id: string; name: string }[] = [];
  for (const m of Array.isArray(status.data.recommended_models) ? (status.data.recommended_models as Record<string, unknown>[]) : []) {
    const id = str(m.id);
    if (id && MODEL_ID.test(id)) models.push({ id, name: str(m.name, 80) ?? id });
  }

  let hermes: FallbackState['hermes'] = null;
  if (agents.some((a) => a.id === 'hermes')) {
    const h = await call(run, sb, ['agents', 'hermes']);
    if ('data' in h) {
      const own = h.data.configured === true && h.data.provider === 'openrouter' ? str(h.data.model) : null;
      hermes = { model: own, error: h.data.configured === true ? null : str(h.data.error, 300) ?? 'Hermes did not answer.' };
    } else hermes = { model: null, error: 'old' in h ? 'This Switchboard cannot read Hermes.' : h.error };
  }

  return {
    kind: 'ok',
    default: str(status.data.default, 64),
    agents, levels, others, workflows,
    openrouter: { model: machineKey ? str(machineKey.model) : null, models },
    hermes,
  };
}

/** The machine chain written whole, first tried first; no level clears it. */
export function chainArgv(levels: FbLevel[]): string[] {
  if (!levels.length) return ['--json', 'chain', 'clear', '--scope', 'machine'];
  return ['--json', 'chain', 'set', '--scope', 'machine', ...levels.map((l) => (l.account ? `${l.agent}@${l.account}` : l.key ? `${l.agent}#${l.key}` : l.agent))];
}

/** Writes one change through Switchboard. Anything malformed is refused here, before Switchboard sees it. */
export async function writeFallback(run: Runner, sb: string, change: FallbackChange): Promise<{ ok: true } | { ok: false; detail: string }> {
  let args: string[];
  if ('default' in change) {
    if (change.default !== null && !AGENT_ID.test(change.default)) return { ok: false, detail: 'not an agent id' };
    args = ['--json', 'agents', 'default', change.default ?? 'auto'];
  } else if ('levels' in change) {
    const ls = change.levels;
    if (!Array.isArray(ls) || ls.length > MAX_LEVELS) return { ok: false, detail: `at most ${MAX_LEVELS} levels` };
    if (!ls.every((l) => AGENT_ID.test(l.agent) && (l.account === undefined || PIN.test(l.account)) && (l.key === undefined || PIN.test(l.key)))) return { ok: false, detail: 'not an agent id' };
    args = chainArgv(ls);
  } else if ('openrouterModel' in change) {
    if (!MODEL_ID.test(change.openrouterModel)) return { ok: false, detail: 'not a model id' };
    args = ['--json', 'agents', 'openrouter', 'model', change.openrouterModel];
  } else if ('hermesModel' in change) {
    if (!MODEL_ID.test(change.hermesModel)) return { ok: false, detail: 'not a model id' };
    args = ['--json', 'agents', 'hermes', 'set', '--provider', 'openrouter', '--model', change.hermesModel];
  } else return { ok: false, detail: 'unknown change' };
  const r = await call(run, sb, args.slice(1));
  if ('data' in r) return { ok: true };
  return { ok: false, detail: 'old' in r ? 'This Switchboard cannot change it; update Switchboard.' : r.error };
}
// #endregion fallback-chain
