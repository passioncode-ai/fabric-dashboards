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
import { createHash } from 'node:crypto';
import { t, type Lang } from './i18n';
import type { ActivityItem, ServiceSnapshot } from './types';
import { waitsForSetup } from './setup-wait';
import { fence, injectionSignals, literal, newFenceId, oneLine, UNTRUSTED_NOTE, UNTRUSTED_TAG } from './untrusted';

/** What the pack says. Built from the monitor's snapshot and the activity store; no token ever. */
export interface HandoffContext {
  key: string;
  name: string;
  summary: string | null;
  placement: 'local' | 'remote';
  state: string;
  /** FD-169: every degraded entry is a setup one: the job is setting it up, not finding a fault. */
  waitsForSetup: boolean;
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
  /** FD-234: the kinds of instruction-like text in what the service wrote; a non-empty list keeps permission prompts on. */
  signals: string[];
  /** FD-234: the random id that closes this document's fences; text written before the start cannot know it. */
  fenceId: string;
}

/** A job handed to the agent with the context (D-3). */
export interface HandoffTask { kind: 'fix' | 'update' | 'setup' | 'audit'; title: string; body: string }

/** The newest first, warnings and errors of the last ones kept even when info rows are many. */
export function handoffContext(s: ServiceSnapshot, activity: ActivityItem[], folder: string | null, lang: Lang = 'en', limit = 20): HandoffContext {
  const d = s.descriptor;
  const rows = activity
    .filter((a) => a.serviceKey === s.key)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  // Warnings and errors keep up to half the rows, however many info rows came after them.
  const important = rows.filter((e) => e.level === 'warning' || e.level === 'error').slice(0, Math.ceil(limit / 2));
  const rest = rows.filter((e) => !important.includes(e)).slice(0, limit - important.length);
  const chosen = [...important, ...rest].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  let descriptor: Record<string, unknown> | null = null;
  if (d) {
    const { auth: _auth, ...rest } = d as unknown as Record<string, unknown>;
    descriptor = rest;
  }
  const reasons = s.reasons.map((r) => t(lang, r.code, r.params));
  const lastAction = s.lastAction ? `${s.lastAction.action} ${s.lastAction.ok ? 'succeeded' : 'failed'} at ${s.lastAction.at}: ${t(lang, s.lastAction.reason.code, s.lastAction.reason.params)}` : null;
  // FD-234 (verifier round 8): a value the service wrote may not be a string (a version `5`); it is read as text, so
  // nothing here throws and leaves a console without its context.
  const events = chosen.map((e) => ({ at: str(e.at) ?? '', level: str(e.level) ?? '', text: str(e.text) ?? '' }));
  // FD-234: short values the service wrote are kept to one line here, so no heading or step can ride in on them.
  const version = str(s.wellKnown?.service?.version);
  const updateAvailable = str(s.wellKnown?.update?.available);
  const name = str(d?.name) ?? s.key;
  const summary = str(d?.summary);
  const origin = str(d?.origin);
  const repository = str(d?.source?.repository);
  return {
    key: s.key,
    name: oneLine(name),
    summary,
    placement: d?.placement === 'remote' ? 'remote' : 'local',
    state: s.state,
    waitsForSetup: waitsForSetup(s),
    reasons,
    problems: s.problems,
    version: version === null ? null : oneLine(version, 60),
    updateAvailable: updateAvailable === null ? null : oneLine(updateAvailable, 60),
    canUpdate: Boolean(d?.commands?.update?.length),
    origin: origin ? oneLine(origin, 300) : null,
    repository: repository ? oneLine(repository, 300) : null,
    folder,
    lastAction,
    events,
    descriptor,
    fenceId: newFenceId(),
    // Each distinct string once (name and summary are also descriptor strings).
    signals: injectionSignals([...new Set([s.key, version, updateAvailable, ...reasons, ...s.problems.map(str), lastAction, ...events.flatMap((e) => [e.at, e.text]), ...stringsOf(descriptor)])]),
  };
}

/** FD-234 (verifier round 6): every string a descriptor holds, keys included, as the service wrote it: its JSON form
 *  escapes a line break into `\\n`, which would hide an instruction from the reading. */
/** FD-234 (verifier round 10): the pack's folder under the packs root. A key that is not a plain name (a broken
 *  entry's key is its file name, which may hold any text) gets a digest instead, so no path a coding agent is handed
 *  (brief, first prompt, MCP config, manifest) carries text a service wrote. */
export function packDir(root: string, key: string): string {
  const plain = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(key) && !key.includes('..');
  return path.join(root, plain ? key : `key-${createHash('sha256').update(key).digest('hex').slice(0, 24)}`);
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));

function stringsOf(value: unknown, out: string[] = [], depth = 0): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'number' || typeof value === 'boolean') out.push(String(value));
  else if (value && typeof value === 'object' && depth < 64) for (const [k, v] of Object.entries(value)) { out.push(k); stringsOf(v, out, depth + 1); }
  return out;
}

const line = (label: string, value: string | null) => (value ? `- **${label}:** ${value}` : null);

/** `context.md`: the agent's whole picture, readable by a person too. */
export function contextMarkdown(c: HandoffContext, generatedAt: string): string {
  const src = `service:${c.key}`;
  const out: (string | null)[] = [
    `# ${literal(c.name, 120)} (${literal(c.key, 200)}): context from Fabric Dashboards`,
    '',
    `Written ${generatedAt}. Read it fresh any time with the \`fabric-dashboards\` MCP tool \`service_context\` (key ${literal(c.key, 200)}).`,
    '',
    // FD-234: what the service wrote is fenced; the agent is told once what the fence means.
    UNTRUSTED_NOTE,
    ...(c.signals.length ? ['', `Some of that text reads like instructions (${c.signals.join(', ')}), so Fabric Dashboards started this session without the flag that turns permission prompts off: the coding agent\'s own permission setting decides each step.`] : []),
    '',
    '## Who',
    line('Agent', `${literal(c.name, 120)}, the Fabric service ${literal(c.key, 200)}`),
    ...(c.summary ? ['', fence(src, c.summary, c.fenceId), ''] : []),
    line('Placement', c.placement === 'remote' ? 'online (runs on its own server)' : 'on this computer'),
    line('Origin', c.origin && literal(c.origin)),
    line('Repository', c.repository && literal(c.repository)),
    line('Folder', c.folder && literal(c.folder, 4096)),
    line('Version', c.version && literal(c.version)),
    '',
    '## State now',
    `- **State:** ${c.state}`,
    ...(c.reasons.length ? [fence(src, c.reasons.map((r) => `- ${r}`).join('\n'), c.fenceId)] : ['- No reason reported.']),
    ...(c.problems.length ? ['', '### Descriptor problems', fence(src, c.problems.map((p) => `- ${p}`).join('\n'), c.fenceId)] : []),
    ...(c.lastAction ? ['- **Last action:**', fence(src, c.lastAction, c.fenceId)] : []),
    line('Update available', c.updateAvailable ? `${literal(c.updateAvailable)}${c.canUpdate ? ' (the descriptor has an `update` command; the MCP tool `update` runs it)' : ' (the descriptor has no `update` command)'}` : null),
    '',
    '## Recent events (newest first)',
    ...(c.events.length ? [fence(src, c.events.map((e) => `- ${e.at} [${e.level}] ${e.text.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n'), c.fenceId)] : ['- None recorded.']),
    '',
    '## Descriptor (its auth block left out)',
    fence(src, ['```json', JSON.stringify(c.descriptor, null, 2), '```'].join('\n'), c.fenceId),
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
  // FD-234: a task that carries text a service or a command wrote says what its fence means.
  const note = task.body.includes(`<${UNTRUSTED_TAG} `) ? `${UNTRUSTED_NOTE}\n\n` : '';
  return `# Task: ${oneLine(task.title, 200)}\n\n${note}${task.body.trim()}\n`;
}

/** What a *Fix with agent* hands over: the problem in the person's words and what "fixed" means. */
export function fixTask(c: HandoffContext): HandoffTask {
  const listed = [...c.reasons, ...c.problems].map((r) => `- ${r}`).join('\n');
  const why = listed ? fence(`service:${c.key}`, listed, c.fenceId) : '- (no reason reported)'; // FD-234
  // FD-169: nothing is broken; the agent waits for what a person sets up (DEC-0149). Same button, a setup job.
  if (c.waitsForSetup && c.problems.length === 0) return {
    kind: 'fix',
    title: `${literal(c.name, 120)} waits for setup`,
    body: `${literal(c.name)} (${literal(c.key, 200)}) runs but waits for you to set it up (Fabric Dashboards):\n\n${why}\n\nSet up each part it names the way its repository documents (README, AGENTS.md, its setup command), and confirm with the MCP tool \`service_status\` that no setup entry is left. Ask me for every secret through a hidden prompt (never print one), and before any sign-in or anything destructive.`,
  };
  return {
    kind: 'fix',
    title: `${literal(c.name, 120)} is ${c.state}`,
    body: `${literal(c.name)} (${literal(c.key, 200)}) is **${c.state}** in Fabric Dashboards:\n\n${why}\n\nFind the cause in its repository, logs and recent events (context.md), fix it, and confirm with the MCP tool \`service_status\` that it is \`ready\`. Ask me before anything destructive, any sign-in, or a secret (use a hidden prompt for secrets; never print one).`,
  };
}

/** FD-81: what *Fix with agent* on the auditor's findings hands over: the findings as the person read them. */
export function auditTask(c: HandoffContext, findings: string): HandoffTask {
  return { kind: 'audit', title: `Audit findings for ${literal(c.name, 120)}`, body: findings.trim() ? fence('audit', findings.trim(), c.fenceId) : `${literal(c.name)} (${literal(c.key, 200)}): the auditor found nothing at the time of the start. Check with the MCP tool \`audit\`.` };
}

/** What *Update with agent* hands over (D-3). */
export function updateTask(c: HandoffContext, failedOutput: string | null): HandoffTask {
  const target = c.updateAvailable ? ` to ${literal(c.updateAvailable)}` : '';
  return {
    kind: 'update',
    title: `Update ${literal(c.name, 120)}${target}`,
    body: `Update ${literal(c.name)} (${literal(c.key, 200)}) from ${c.version ? literal(c.version) : 'its current version'}${target}.\n\n`
      + (c.canUpdate ? 'Its descriptor has an `update` command; ' + (failedOutput ? `it failed:\n\n${fence('command', `\`\`\`\n${failedOutput.slice(-2000)}\n\`\`\``, c.fenceId)}\n\nFind out why and finish the update.` : 'run it with the MCP tool `update`, and finish what it cannot do.') : 'Its descriptor has no `update` command: update it the way its repository documents (README, AGENTS.md), then restart it.')
      + '\n\nConfirm with `service_status` that it answers as the new version. Ask me before anything destructive.',
  };
}

/**
 * FD-47 (contract DEC-0042, `session-handoff/1` SH-6/SH-7): the preamble that ends every brief. One line that
 * names one tool, the first call, and holds no rule: the rules for this console are what `service_context`
 * returns (`rules`), so a rule is never in two places.
 */
export function preamble(key: string): string {
  return `You are working on a Fabric agent, opened from Fabric Dashboards. Call the fabric-dashboards tool service_context with key ${literal(key, 200)} before you do anything else: it returns the agent's live state, its errors, events, repository and descriptor, and the rules for this console. If the call fails, say so and stop rather than guessing what it would have said.`;
}

/** The brief (SH-8): the agent's own text — where its task is, when it has one — then the preamble. */
export function brief(key: string, files: { task: string | null }): string {
  return `${files.task ? `Your task is in ${literal(files.task, 4096)}. ` : ''}${preamble(key)}`;
}

/** Whether a brief travels in one argument (SH-8): at most 1000 characters, no control character. */
export const briefFitsInline = (text: string) => text.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(text);

/** The first prompt that starts a task at once in a runtime that also takes a system prompt (Claude Code). */
export function taskPrompt(task: string): string {
  return `Do the task in ${literal(task, 4096)}.`;
}

/** How this app's MCP server is started: its launcher in a packaged app, the binary as Node in development. */
export interface McpCommand { command: string; args: string[]; env?: Record<string, string> }

/** `mcp.json` (SH-9, `mcp.auth: none`): the stdio launcher, no header and no credential. */
export function mcpConfig(server: McpCommand): string {
  return `${JSON.stringify({ mcpServers: { 'fabric-dashboards': { type: 'stdio', command: server.command, args: server.args, ...(server.env ? { env: server.env } : {}) } } }, null, 2)}\n`;
}

/** TOML for one value: JSON's string and array forms are valid TOML. */
const toml = (v: string | string[]) => JSON.stringify(v);

/** The runtimes the brief reaches, by their shared runner kind (runners.md): only these get a `handoff.json`. */
export const HANDOFF_RUNTIMES: Readonly<Record<string, string>> = { 'claude-code': 'claude-code', codex: 'codex', 'gemini-cli': 'gemini-cli' };

/**
 * The arguments that carry the pack (SH-11), around the runtime's own (`before` precede `continueArgs`, which
 * for Codex is a subcommand; `after` follow them). Claude Code: the joined `--mcp-config=<path>` (the spaced
 * form leaves its variadic list open — Switchboard SB-94), the brief inline or as `brief.md`, and a task's first
 * prompt. Codex: the stdio server as `-c mcp_servers.fabric-dashboards.*`, the brief as its first prompt. Gemini
 * CLI: the brief as `-i`. Every argument stays under Switchboard's 1024-character limit.
 */
export function handoffArgs(runtimeId: string, o: { mcp: string; mcpServer: McpCommand; brief: { inline: string } | { file: string }; task: string | null }): { before: string[]; after: string[] } {
  const prompt = 'inline' in o.brief ? o.brief.inline : `Read ${o.brief.file} and follow it.`;
  switch (runtimeId) {
    case 'claude-code':
      return {
        before: [`--mcp-config=${o.mcp}`, ...('inline' in o.brief ? ['--append-system-prompt', o.brief.inline] : ['--append-system-prompt-file', o.brief.file])],
        after: o.task ? [taskPrompt(o.task)] : [],
      };
    case 'codex': {
      const before = ['-c', `mcp_servers.fabric-dashboards.command=${toml(o.mcpServer.command)}`, '-c', `mcp_servers.fabric-dashboards.args=${toml(o.mcpServer.args)}`];
      for (const [k, v] of Object.entries(o.mcpServer.env ?? {})) before.push('-c', `mcp_servers.fabric-dashboards.env.${k}=${toml(v)}`);
      return { before, after: [prompt] };
    }
    case 'gemini-cli':
      return { before: [], after: ['-i', prompt] };
    default:
      return { before: [], after: [] };
  }
}

/** Writes one file of the pack whole: a temporary file renamed over it, 0600 (SH-2, SH-3). */
function put(dir: string, name: string, text: string): string {
  const file = path.join(dir, name);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, text, { mode: 0o600 });
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, { force: true }); // SH-3: never leave a file the manifest does not list
    throw error;
  }
  return file;
}

/** Writes the pack: the folder 0700, each file 0600, each written whole, and an optional file left from an
 *  earlier start removed (a task, a brief, a manifest). Returns the paths the runtime is given. */
export function writePack(dir: string, files: { context: string; task: string | null; mcp: string; brief?: string | null }): { context: string; task: string | null; mcp: string; brief: string | null } {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dir, 0o700); } catch { /* Windows: the profile's ACL */ }
  // The manifest goes first and comes back last: a folder caught half-written never claims to be a handoff.
  fs.rmSync(path.join(dir, 'handoff.json'), { force: true });
  // A temporary file a killed writer left behind (SH-3: nothing the manifest does not list).
  for (const name of fs.readdirSync(dir)) if (name.endsWith('.tmp')) fs.rmSync(path.join(dir, name), { force: true });
  const out = { context: put(dir, 'context.md', files.context), mcp: put(dir, 'mcp.json', files.mcp), task: null as string | null, brief: null as string | null };
  for (const [name, text] of [['task.md', files.task], ['brief.md', files.brief ?? null]] as const) {
    if (text) out[name === 'task.md' ? 'task' : 'brief'] = put(dir, name, text);
    else fs.rmSync(path.join(dir, name), { force: true });
  }
  return out;
}

/** FD-129 (UX-16): a task for a session that already runs: only `task.md` is written, beside the pack that session
 *  started with, and the line that points the running agent at it is returned for the person to send. */
export function writeTaskOnly(o: { snapshot: ServiceSnapshot; activity: ActivityItem[]; folder: string; dir: string; task: { kind: 'fix' | 'update' | 'audit'; output?: string } }): { path: string; line: string; signals: string[] } {
  const ctx = handoffContext(o.snapshot, o.activity, o.folder);
  const signals = [...new Set([...ctx.signals, ...injectionSignals([o.task.output])])]; // FD-234
  const job = o.task.kind === 'fix' ? fixTask(ctx) : o.task.kind === 'audit' ? auditTask(ctx, o.task.output ?? '') : updateTask(ctx, o.task.output ?? null);
  // A session started outside this app (a hand-over, a continue) may have no pack folder yet.
  fs.mkdirSync(o.dir, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(o.dir, 0o700); } catch { /* Windows: the profile's ACL */ }
  const file = put(o.dir, 'task.md', taskMarkdown(job));
  return { path: file, line: `Read ${literal(file, 4096)} and do the task it describes.`, signals };
}

/**
 * Everything one console start needs from the pack (FD-47, `session-handoff/1`): the files written now, the
 * arguments and environment that carry them, and — for a runtime the brief reaches — `handoff.json`, the
 * manifest Fabric reads the same way (`lifetime: agent-key`, `mcp.auth: none`, `strict: false`).
 */
export function prepareHandoff(o: {
  snapshot: ServiceSnapshot; activity: ActivityItem[]; folder: string; runtimeId: string; dir: string;
  server: McpCommand; version: string; task?: { kind: 'fix' | 'update' | 'audit'; output?: string }; now?: () => Date;
}): { handoff: { before: string[]; after: string[] }; env: Record<string, string>; signals: string[]; files: { context: string; task: string | null; mcp: string; brief: string | null; manifest: string | null } } {
  // A start that fails before the manifest is written again must not leave the last start's manifest behind.
  fs.rmSync(path.join(o.dir, 'handoff.json'), { force: true });
  const now = (o.now ?? (() => new Date()))().toISOString();
  const read = handoffContext(o.snapshot, o.activity, o.folder);
  // FD-234: a task's output (audit findings, a failed update) is read for instruction-like text too.
  const ctx = { ...read, signals: [...new Set([...read.signals, ...injectionSignals([o.task?.output])])] };
  const job = o.task ? (o.task.kind === 'fix' ? fixTask(ctx) : o.task.kind === 'audit' ? auditTask(ctx, o.task.output ?? '') : updateTask(ctx, o.task.output ?? null)) : null;
  const taskPath = job ? path.join(o.dir, 'task.md') : null;
  const text = brief(ctx.key, { task: taskPath });
  const inline = briefFitsInline(text);
  const files = writePack(o.dir, { context: contextMarkdown(ctx, now), task: job ? taskMarkdown(job) : null, mcp: mcpConfig(o.server), brief: inline ? null : `${text}\n` });
  const h = handoffArgs(o.runtimeId, { mcp: files.mcp, mcpServer: o.server, brief: inline ? { inline: text } : { file: files.brief! }, task: files.task });
  const env: Record<string, string> = { FABRIC_DASHBOARDS_CONTEXT: files.context, ...(files.task ? { FABRIC_DASHBOARDS_TASK: files.task } : {}) };
  const runtime = HANDOFF_RUNTIMES[o.runtimeId];
  let manifest: string | null = null;
  if (runtime) {
    manifest = put(o.dir, 'handoff.json', `${JSON.stringify({
      format: 'session-handoff/1',
      writer: { product: 'fabric-dashboards', version: o.version },
      writtenAt: now,
      lifetime: { kind: 'agent-key', agentKey: ctx.key },
      files: ['context.md', 'mcp.json', ...(files.brief ? ['brief.md'] : []), ...(files.task ? ['task.md'] : [])],
      firstCall: { server: 'fabric-dashboards', tool: 'service_context', arguments: { key: ctx.key } },
      preamble: preamble(ctx.key),
      mcp: { auth: 'none', strict: false },
      brief: inline ? { delivery: 'inline', text } : { delivery: 'file' },
      // SH-10: what the handoff adds, in order. The runtime's own arguments (Continue's `--continue`, Codex's
      // `resume --last`) sit between `before` and `after` on the command line and are not the handoff's.
      launch: { runtime, args: [...h.before, ...h.after], env },
    }, null, 2)}\n`);
  }
  return { handoff: h, env, signals: ctx.signals, files: { ...files, manifest } };
}
// #endregion agent-handoff
