// #region fallback-chain — docs: docs/ux/scenarios.md#scn-088-choose-the-default-and-fallback-coding-agents
// FD-117: the shapes Settings → Coding agents shows, kept free of Node so the renderer can name them.
export interface FbAgent { id: string; name: string; offered: boolean; openrouter: boolean }
/** One level of the order: an agent, optionally pinned to an account (`agent@id`) or a vault key (`agent#name`). */
export interface FbLevel { agent: string; account?: string; accountLabel?: string; key?: string }
export interface FallbackState {
  /** The machine's default agent; null is Auto. */
  default: string | null;
  /** Installed agents, those that can take over work first. */
  agents: FbAgent[];
  /** The machine chain, first tried first. */
  levels: FbLevel[];
  /** Groups with a chain of their own (read-only here). */
  others: { name: string; agents: string[] }[];
  /** Tasks (workflows) with a chain of their own. */
  workflows: number;
  /** The machine OpenRouter key's default model (null: no key saved) and the models offered for it. */
  openrouter: { model: string | null; models: { id: string; name: string }[] };
  /** Hermes's own model on OpenRouter, or why it is not known; null when Hermes is not installed. */
  hermes: { model: string | null; error: string | null } | null;
}
export type FallbackRead = { kind: 'old' } | { kind: 'error'; detail: string } | ({ kind: 'ok' } & FallbackState);
export type FallbackChange = { default: string | null } | { levels: FbLevel[] } | { openrouterModel: string } | { hermesModel: string };
/** Switchboard keeps at most eight executors in one chain (`switchboard_chain_set`). */
export const MAX_LEVELS = 8;

/** The model a level works on: its account's (subscription agents), an OpenRouter model, or not known. */
export function modelOf(agent: string, s: Pick<FallbackState, 'agents' | 'openrouter' | 'hermes'>): { kind: 'account' } | { kind: 'openrouter'; model: string } | { kind: 'unknown' } {
  if (agent === 'hermes' && s.hermes?.model) return { kind: 'openrouter', model: s.hermes.model };
  const viaKey = agent === 'hermes' || agent === 'opencode' || (s.agents.find((a) => a.id === agent)?.openrouter === true && !['claude-code', 'codex', 'kimi-code'].includes(agent));
  if (!viaKey) return { kind: 'account' };
  return s.openrouter.model ? { kind: 'openrouter', model: s.openrouter.model } : { kind: 'unknown' };
}
// #endregion fallback-chain
