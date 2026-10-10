// #region agent-handoff — docs: docs/adr/0020-agents-first-handoff-and-setup.md#decision
// FD-39 / ADR-0020: a console session starts already knowing the Fabric agent it was opened for. Each
// start writes a context pack in the app's data folder (never in the agent's repository): `context.md`
// (who the agent is, its state and why, its last errors and events, version and update, repository and
// folder, its descriptor without the auth block), an optional `task.md` (Fix / Update with agent), and
// `mcp.json` (this app's MCP server, so the agent can read the same state live). The runtime gets it
// before its first turn: Claude Code through --mcp-config and --append-system-prompt, Codex through -c
// and a first prompt, Gemini through -i, any other through FABRIC_DASHBOARDS_CONTEXT. Fabric's own
// sessionBundle has the same shape, on purpose: one convention across products. Pure: tested on any OS.
import fs from 'node:fs';
import path from 'node:path';
import { t, type Lang } from './i18n';
import type { ActivityItem, ServiceSnapshot } from './types';

/** What the pack says. Built from the monitor's snapshot and the activity store; no token ever. */
export interface HandoffContext {
  key: string;
  name: string;
  summary: string | null;
  placement: 'local' | 'remote';
  state: string;
  reasons: string[];
  problems: string[];
  version: string | null;
  updateAvailable: string | null;
  canUpdate: boolean;
  origin: string | null;
  repository: string | null;
  folder: string | null;
  lastAction: string | null;
  events: { at: string; level: string; text: string }[];
  /** The descriptor, `auth` removed: a token file's path is not the agent's to read (SECURITY.md). */
  descriptor: Record<string, unknown> | null;
}

/** A job handed to the agent with the context (D-3). */
export interface HandoffTask { kind: 'fix' | 'update' | 'setup'; title: string; body: string }

/** The newest first, warnings and errors of the last ones kept even when info rows are many. */
export function handoffContext(s: ServiceSnapshot, activity: ActivityItem[], folder: string | null, lang: Lang = 'en', limit = 20): HandoffContext {
  const d = s.descriptor;
  const events = activity
    .filter((a) => a.serviceKey === s.key)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  // Warnings and errors keep up to half the rows, however many info rows came after them.
  const important = events.filter((e) => e.level === 'warning' || e.level === 'error').slice(0, Math.ceil(limit / 2));
  const rest = events.filter((e) => !important.includes(e)).slice(0, limit - important.length);
  const chosen = [...important, ...rest].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  let descriptor: Record<string, unknown> | null = null;
  if (d) {
    const { auth: _auth, ...rest } = d as unknown as Record<string, unknown>;
    descriptor = rest;
  }
  return {
    key: s.key,
    name: d?.name ?? s.key,
    summary: d?.summary ?? null,
    placement: d?.placement === 'remote' ? 'remote' : 'local',
    state: s.state,
    reasons: s.reasons.map((r) => t(lang, r.code, r.params)),
    problems: s.problems,
    version: s.wellKnown?.service.version ?? null,
    updateAvailable: s.wellKnown?.update?.available ?? null,
    canUpdate: Boolean(d?.commands?.update?.length),
    origin: d?.origin ?? null,
    repository: d?.source?.repository ?? null,
    folder,
    lastAction: s.lastAction ? `${s.lastAction.action} ${s.lastAction.ok ? 'succeeded' : 'failed'} at ${s.lastAction.at}: ${t(lang, s.lastAction.reason.code, s.lastAction.reason.params)}` : null,
    events: chosen.map((e) => ({ at: e.at, level: e.level, text: e.text })),
    descriptor,
  };
}

const line = (label: string, value: string | null) => (value ? `- **${label}:** ${value}` : null);

/** `context.md`: the agent's whole picture, readable by a person too. */
export function contextMarkdown(c: HandoffContext, generatedAt: string): string {
  const out: (string | null)[] = [
    `# ${c.name} (${c.key}) — context from Fabric Dashboards`,
    '',
    `Written ${generatedAt}. Read it fresh any time with the \`fabric-dashboards\` MCP tool \`service_context\` (key \`${c.key}\`).`,
    '',
    '## Who',
    line('Agent', `${c.name} — the Fabric service \`${c.key}\`${c.summary ? `: ${c.summary}` : ''}`),
    line('Placement', c.placement === 'remote' ? 'online (runs on its own server)' : 'on this computer'),
    line('Origin', c.origin),
    line('Repository', c.repository),
    line('Folder', c.folder),
    line('Version', c.version),
    '',
    '## State now',
    `- **State:** ${c.state}`,
    ...(c.reasons.length ? c.reasons.map((r) => `- ${r}`) : ['- No reason reported.']),
    ...(c.problems.length ? ['', '### Descriptor problems', ...c.problems.map((p) => `- ${p}`)] : []),
    line('Last action', c.lastAction),
    line('Update available', c.updateAvailable ? `${c.updateAvailable}${c.canUpdate ? ' (the descriptor has an `update` command; the MCP tool `update` runs it)' : ' (the descriptor has no `update` command)'}` : null),
    '',
    '## Recent events (newest first)',
    ...(c.events.length ? c.events.map((e) => `- ${e.at} [${e.level}] ${e.text.replace(/\s+/g, ' ').slice(0, 400)}`) : ['- None recorded.']),
    '',
    '## Descriptor (its auth block left out)',
    '```json',
    JSON.stringify(c.descriptor, null, 2),
    '```',
    '',
    '## What you can do from here',
    '- `fabric-dashboards` MCP: `service_context`, `service_status`, `activity`, `doctor`, `update`, `control` (start/stop/restart), `link`, `open`.',
    '- The person sees the result in Fabric Dashboards: its state, events and dashboard update as you work.',
    '',
  ];
  return out.filter((l) => l !== null).join('\n');
}

/** `task.md`: the job, when the console was opened to do one. */
export function taskMarkdown(task: HandoffTask): string {
  return `# Task: ${task.title}\n\n${task.body.trim()}\n`;
}

/** What a *Fix with agent* hands over: the problem in the person's words and what "fixed" means. */
export function fixTask(c: HandoffContext): HandoffTask {
  const why = [...c.reasons, ...c.problems].map((r) => `- ${r}`).join('\n') || '- (no reason reported)';
  return {
    kind: 'fix',
    title: `${c.name} is ${c.state}`,
    body: `${c.name} (\`${c.key}\`) is **${c.state}** in Fabric Dashboards:\n\n${why}\n\nFind the cause in its repository, logs and recent events (context.md), fix it, and confirm with the MCP tool \`service_status\` that it is \`ready\`. Ask me before anything destructive, any sign-in, or a secret (use a hidden prompt for secrets; never print one).`,
  };
}

/** What *Update with agent* hands over (D-3). */
export function updateTask(c: HandoffContext, failedOutput: string | null): HandoffTask {
  const target = c.updateAvailable ? ` to ${c.updateAvailable}` : '';
  return {
    kind: 'update',
    title: `Update ${c.name}${target}`,
    body: `Update ${c.name} (\`${c.key}\`) from ${c.version ?? 'its current version'}${target}.\n\n`
      + (c.canUpdate ? 'Its descriptor has an `update` command; ' + (failedOutput ? `it failed:\n\n\`\`\`\n${failedOutput.slice(-2000)}\n\`\`\`\n\nFind out why and finish the update.` : 'run it with the MCP tool `update`, and finish what it cannot do.') : 'Its descriptor has no `update` command: update it the way its repository documents (README, AGENTS.md), then restart it.')
      + '\n\nConfirm with `service_status` that it answers as the new version. Ask me before anything destructive.',
  };
}

/** The appended system prompt: short (Switchboard passes at most 1024 characters per argument),
 *  pointing at the pack, like Fabric's PREAMBLE points at `fabric_whoami`. */
export function brief(c: HandoffContext, files: { context: string; task: string | null }): string {
  const text = `You are working on the Fabric agent "${c.name}" (${c.key}), opened from Fabric Dashboards. `
    + `Its state, errors, events, repository and descriptor are in ${files.context}; read it first, `
    + `or call the fabric-dashboards MCP tool service_context with key ${c.key} for the live state. `
    + (files.task ? `Your task is in ${files.task}. ` : '')
    + 'Do the work yourself and show the person the result; ask only for decisions, sign-ins and secrets (hidden prompt, never printed).';
  return text.length <= 1000 ? text : `${text.slice(0, 997)}...`;
}

/** The first prompt for a runtime that has no system-prompt flag, or for a task. */
export function firstPrompt(files: { context: string; task: string | null }): string {
  return files.task
    ? `Read ${files.context} (the Fabric agent you are working on) and ${files.task} (your task), then do the task.`
    : `Read ${files.context}: it describes the Fabric agent you are working on. Then wait for my instruction.`;
}

/** How this app's MCP server is started: its launcher in a packaged app, the binary as Node in development. */
export interface McpCommand { command: string; args: string[]; env?: Record<string, string> }

export function mcpConfig(server: McpCommand): string {
  return `${JSON.stringify({ mcpServers: { 'fabric-dashboards': { type: 'stdio', command: server.command, args: server.args, ...(server.env ? { env: server.env } : {}) } } }, null, 2)}\n`;
}

/** TOML for one value: JSON's string and array forms are valid TOML. */
const toml = (v: string | string[]) => JSON.stringify(v);

/**
 * The arguments that carry the pack, around the runtime's own (`before` precede `continueArgs`, which
 * for Codex is a subcommand; `after` follow them). `--mcp-config` takes several values, so nothing
 * positional follows it directly. Every argument stays under Switchboard's 1024-character limit.
 */
export function handoffArgs(runtimeId: string, o: { mcp: string; mcpServer: McpCommand; brief: string; prompt: string | null }): { before: string[]; after: string[]; env: Record<string, string> } {
  const env: Record<string, string> = {};
  switch (runtimeId) {
    case 'claude-code':
      return { before: ['--mcp-config', o.mcp, '--append-system-prompt', o.brief], after: o.prompt ? [o.prompt] : [], env };
    case 'codex': {
      const before = ['-c', `mcp_servers.fabric-dashboards.command=${toml(o.mcpServer.command)}`, '-c', `mcp_servers.fabric-dashboards.args=${toml(o.mcpServer.args)}`];
      for (const [k, v] of Object.entries(o.mcpServer.env ?? {})) before.push('-c', `mcp_servers.fabric-dashboards.env.${k}=${toml(v)}`);
      return { before, after: o.prompt ? [o.prompt] : [], env };
    }
    case 'gemini-cli':
      return { before: [], after: o.prompt ? ['-i', o.prompt] : [], env };
    default:
      return { before: [], after: [], env };
  }
}
/** Writes the pack: the folder 0700, each file 0600, each written whole (a temp file renamed), and a
 *  task left from an earlier start removed. Returns the paths the runtime is given. */
export function writePack(dir: string, files: { context: string; task: string | null; mcp: string }): { context: string; task: string | null; mcp: string } {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch { /* Windows: the profile's ACL */ }
  const put = (name: string, text: string) => {
    const file = path.join(dir, name);
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, text, { mode: 0o600 });
    fs.renameSync(temp, file);
    return file;
  };
  const out = { context: put('context.md', files.context), mcp: put('mcp.json', files.mcp), task: null as string | null };
  if (files.task) out.task = put('task.md', files.task);
  else fs.rmSync(path.join(dir, 'task.md'), { force: true });
  return out;
}
/** Everything one console start needs from the pack: written now, and the arguments and environment that
 *  carry it. Claude reads the brief as its system prompt and waits; a runtime without one gets a first prompt. */
export function prepareHandoff(o: {
  snapshot: ServiceSnapshot; activity: ActivityItem[]; folder: string; runtimeId: string; dir: string;
  server: McpCommand; task?: { kind: 'fix' | 'update'; output?: string }; now?: () => Date;
}): { handoff: { before: string[]; after: string[] }; env: Record<string, string>; files: { context: string; task: string | null; mcp: string } } {
  const ctx = handoffContext(o.snapshot, o.activity, o.folder);
  const job = o.task ? (o.task.kind === 'fix' ? fixTask(ctx) : updateTask(ctx, o.task.output ?? null)) : null;
  const files = writePack(o.dir, { context: contextMarkdown(ctx, (o.now ?? (() => new Date()))().toISOString()), task: job ? taskMarkdown(job) : null, mcp: mcpConfig(o.server) });
  const prompt = job || o.runtimeId === 'codex' || o.runtimeId === 'gemini-cli' ? firstPrompt(files) : null;
  const h = handoffArgs(o.runtimeId, { mcp: files.mcp, mcpServer: o.server, brief: brief(ctx, files), prompt });
  return { handoff: { before: h.before, after: h.after }, env: { ...h.env, FABRIC_DASHBOARDS_CONTEXT: files.context, ...(files.task ? { FABRIC_DASHBOARDS_TASK: files.task } : {}) }, files };
}
// #endregion agent-handoff
