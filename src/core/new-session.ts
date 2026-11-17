// #region new-session — docs: docs/ux/scenarios.md#scn-101-start-a-new-session-in-a-folder
// FD-191 (the operator, 2026-11-09, this repository's session 0edbdfdf): a coding session of its own, started from the
// Sessions mode, and a new agent, started from the agent list. Both are a console of this app that belongs to no agent:
// the person chooses the coding agent, the folder (the projects folder by default, any other through the system picker,
// operator rule of 2026-10-09), whether it runs without permission prompts (on by default, FD-174) and whether it runs
// isolated on a Switchboard account's private home. The parts here are pure but for the brief a new agent's console is
// started with (written into its pack folder, like the Setup console's).
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handoffArgs, mcpConfig, writePack, type McpCommand } from './handoff';

export type NewSessionKind = 'session' | 'agent' | 'dashboard';

/** The console key of a session of its own (`session.<12 hex>`), a new agent's (`session.agent-<12 hex>`) or a new
 *  dashboard's (`session.dashboard-<12 hex>`, FD-171). It has the service-key shape the console's IPC takes, and no agent
 *  is ever called `session`. */
export function newSessionKey(kind: NewSessionKind, seed: string = crypto.randomUUID()): string {
  const id = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return kind === 'session' ? `session.${id}` : `session.${kind}-${id}`;
}

export const isNewSessionKey = (key: string): boolean => /^session\.(agent-|dashboard-)?[0-9a-f]{12}$/.test(key);
export const isNewAgentKey = (key: string): boolean => /^session\.agent-[0-9a-f]{12}$/.test(key);
export const isNewDashboardKey = (key: string): boolean => /^session\.dashboard-[0-9a-f]{12}$/.test(key);
/** A console of its own: one that belongs to no agent (a hand-over, a session continued after a limit, or one of these). */
export const isOwnConsoleKey = (key: string): boolean => key.startsWith('handover.') || isNewSessionKey(key);

/** Where people keep their projects, the first that exists: the last folder chosen in this dialog, the folder that holds
 *  most of the folders the agents' consoles use (two at least), a usual projects folder, else the home folder. */
export const USUAL_PROJECT_FOLDERS = ['DATA', 'Projects', 'projects', 'Developer', 'Code', 'code', 'src', 'dev', 'repos', 'GitHub'];
export function projectsFolder(o: { last: string | null; consoleFolders: readonly (string | null)[]; home: string; isDir: (p: string) => boolean }): string {
  if (o.last && o.isDir(o.last)) return o.last;
  const counts = new Map<string, number>();
  for (const f of o.consoleFolders) {
    if (!f) continue;
    const parent = path.dirname(f);
    if (parent === f || parent === o.home || parent === path.dirname(o.home)) continue; // the home folder is the last resort, not a find
    counts.set(parent, (counts.get(parent) ?? 0) + 1);
  }
  const best = [...counts.entries()].filter(([p, n]) => n >= 2 && o.isDir(p)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (best) return best[0];
  for (const name of USUAL_PROJECT_FOLDERS) {
    const p = path.join(o.home, name);
    if (o.isDir(p)) return p;
  }
  return o.home;
}

/** Why the isolated choice cannot be taken, or null when it can: Switchboard runs an isolated session of Claude Code or
 *  Codex on an account's private home, in this console only when it takes `launch --in-place`. */
export type IsolatedBlock = 'no-switchboard' | 'old-switchboard' | 'provider';
export function isolatedBlock(o: { switchboard: boolean; inPlace: boolean; provider: 'claude' | 'codex' | null }): IsolatedBlock | null {
  if (!o.switchboard) return 'no-switchboard';
  if (!o.inPlace) return 'old-switchboard';
  return o.provider ? null : 'provider';
}

/** What the dialog's start asks for, checked against what is installed; null fields fall back to the remembered choice. */
/** FD-206: `machine` starts it on another machine (as ssh knows it), and `folder` is then that machine's. */
export interface NewSessionChoice { kind: NewSessionKind; runtime: string; folder: string; bypass: boolean; isolated: boolean; machine?: string }

/** The brief a new agent's console starts with: create one Fabric agent with the person, in their projects folder. */
export function newAgentMarkdown(o: { folder: string }): string {
  return [
    '# A new agent',
    '',
    'The person pressed **New agent** in Fabric Dashboards. Create one agent with them, from the first question to an agent that runs as a service and shows in Fabric Dashboards. Run every command yourself; ask the person only for decisions, consents, sign-ins and secrets (a hidden prompt, never printed), one question at a time.',
    '',
    `This session runs in \`${o.folder}\`, the folder where the person keeps their projects. Make the agent's own folder inside it unless they name another.`,
    '',
    '1. **What it does.** Ask what the agent should do, and whether a project they already have should become it.',
    '2. **Build it.** A new agent: the `creating-fabric-agents` skill and its intake questions. An existing project: `adapting-projects-to-fabric`. When neither skill is installed, say so and install the Fabric agent adapter as the setup does (`npx --yes @passioncode-ai/passioncode doctor` names it).',
    '3. **Make it a service** with `building-fabric-services`, so it runs by itself.',
    '4. **Show it.** Confirm with the MCP tool `list_services` (fabric-dashboards, loaded in this session) that it is listed and `ready`, then tell the person to look at the agent list.',
    '',
    'Finish with what was made, where it lives and what is left.',
    '',
  ].join('\n');
}

/** FD-171 step 2: the brief a new dashboard's console starts with. A dashboard here is a `fabric-service/0.1` service
 *  that is only a page and its agent twin (the adapter's `building-fabric-services` recipe `recipes/dashboard-only/`,
 *  FAA-268): it reads what it shows through this app's MCP and Project Observatory, never another agent's token. */
export function newDashboardMarkdown(o: { folder: string }): string {
  return [
    '# A new dashboard',
    '',
    'The person pressed **New dashboard** in Fabric Dashboards. Make one dashboard with them: a page that shows what they want to see about the agents of this computer, served as a `fabric-service/0.1` service so it opens inside Fabric Dashboards. Run every command yourself; ask the person only for decisions, consents, sign-ins and secrets (a hidden prompt, never printed), one question at a time.',
    '',
    `This session runs in \`${o.folder}\`, the folder where the person keeps their projects. Make the dashboard's own folder inside it unless they name another.`,
    '',
    '1. **What it shows.** Ask what the page should show and for whom: which agents, which numbers (state, spend, connections, sessions, findings), how fresh.',
    '2. **Make the service** with the `building-fabric-services` skill, recipe `recipes/dashboard-only/`: `python3 recipes/dashboard-only/install.py --id <id> --folder <its folder>` (or `node recipes/dashboard-only/install.mjs` with the same flags). Its last line names the descriptor, the key and the port. It holds no provider key and no token but its own. When the skill is not installed, say so and install the Fabric agent adapter as the setup does (`npx --yes @passioncode-ai/passioncode doctor` names it).',
    '3. **Fill it.** Write the page\'s data (`snapshot.json` in its folder) from the MCP tools of this session: fabric-dashboards `list_services`, `spend`, `connections`, `sessions`, and Project Observatory\'s tools when they are loaded. Never read another agent\'s token or key.',
    '4. **Run it** under launchd as the recipe\'s README says, so it runs by itself.',
    '5. **Show it.** Confirm with `list_services` that it is listed and `ready`, then open it with the MCP tool `open` (its key, path `/`).',
    '',
    'Finish with what was made, where it lives, how its data is refreshed and what is left.',
    '',
  ].join('\n');
}

/** Writes a briefed console's pack (its brief file and the MCP config) and gives the runtime's arguments, as the Setup
 *  console's are given: Claude Code reads the brief as its system prompt and starts on the prompt; Codex and Gemini CLI
 *  start on the prompt alone; another runtime starts with nothing added. */
function prepareBriefed(o: { dir: string; runtimeId: string; server: McpCommand; markdown: string; fileName: string; brief: (file: string) => string; prompt: (file: string) => string; envName: string }): { handoff: { before: string[]; after: string[] }; env: Record<string, string>; file: string } {
  const packed = writePack(o.dir, { context: o.markdown, task: null, mcp: mcpConfig(o.server) });
  const file = path.join(o.dir, o.fileName);
  fs.renameSync(packed.context, file);
  const brief = o.brief(file);
  const prompt = o.prompt(file);
  const claude = o.runtimeId === 'claude-code';
  const h = handoffArgs(o.runtimeId, { mcp: packed.mcp, mcpServer: o.server, brief: { inline: claude ? brief : prompt }, task: null });
  return { handoff: { before: h.before, after: claude ? [prompt] : h.after }, env: { [o.envName]: file }, file };
}

/** Writes the new agent's pack (`agent.md` and the MCP config) and gives the runtime's arguments. */
export function prepareNewAgent(o: { dir: string; runtimeId: string; folder: string; server: McpCommand }): { handoff: { before: string[]; after: string[] }; env: Record<string, string>; file: string } {
  return prepareBriefed({
    dir: o.dir, runtimeId: o.runtimeId, server: o.server, markdown: newAgentMarkdown({ folder: o.folder }), fileName: 'agent.md', envName: 'FABRIC_DASHBOARDS_NEW_AGENT',
    brief: (file) => 'You were started from Fabric Dashboards\' New agent button to create a new Fabric agent with this person. '
      + `The steps are in ${file}; the fabric-dashboards MCP server is loaded in this session. `
      + 'Run every command yourself; ask the person only for decisions, consents, sign-ins and secrets, one question at a time.',
    prompt: (file) => `Read ${file} and let's create a new agent together.`,
  });
}

/** FD-171 step 2: writes the new dashboard's pack (`dashboard.md` and the MCP config) and gives the runtime's arguments. */
export function prepareNewDashboard(o: { dir: string; runtimeId: string; folder: string; server: McpCommand }): { handoff: { before: string[]; after: string[] }; env: Record<string, string>; file: string } {
  return prepareBriefed({
    dir: o.dir, runtimeId: o.runtimeId, server: o.server, markdown: newDashboardMarkdown({ folder: o.folder }), fileName: 'dashboard.md', envName: 'FABRIC_DASHBOARDS_NEW_DASHBOARD',
    brief: (file) => 'You were started from Fabric Dashboards\' New dashboard button to make a new dashboard with this person. '
      + `The steps are in ${file}; the fabric-dashboards MCP server is loaded in this session. `
      + 'Run every command yourself; ask the person only for decisions, consents, sign-ins and secrets, one question at a time.',
    prompt: (file) => `Read ${file} and let's make a new dashboard together.`,
  });
}

export const homeFolder = () => os.homedir();
// #endregion new-session
