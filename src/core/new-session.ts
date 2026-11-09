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

export type NewSessionKind = 'session' | 'agent';

/** The console key of a session of its own (`session.<12 hex>`) or a new agent's (`session.agent-<12 hex>`). It has the
 *  service-key shape the console's IPC takes, and no agent is ever called `session`. */
export function newSessionKey(kind: NewSessionKind, seed: string = crypto.randomUUID()): string {
  const id = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return kind === 'agent' ? `session.agent-${id}` : `session.${id}`;
}

export const isNewSessionKey = (key: string): boolean => /^session\.(agent-)?[0-9a-f]{12}$/.test(key);
export const isNewAgentKey = (key: string): boolean => /^session\.agent-[0-9a-f]{12}$/.test(key);
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
export interface NewSessionChoice { kind: NewSessionKind; runtime: string; folder: string; bypass: boolean; isolated: boolean }

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

/** Writes the new agent's pack (`agent.md` and the MCP config) and gives the runtime's arguments, as the Setup console's
 *  are given: Claude Code reads the brief as its system prompt and starts on the prompt; Codex and Gemini CLI start on the
 *  prompt alone; another runtime starts with nothing added. */
export function prepareNewAgent(o: { dir: string; runtimeId: string; folder: string; server: McpCommand }): { handoff: { before: string[]; after: string[] }; env: Record<string, string>; file: string } {
  const packed = writePack(o.dir, { context: newAgentMarkdown({ folder: o.folder }), task: null, mcp: mcpConfig(o.server) });
  const file = path.join(o.dir, 'agent.md');
  fs.renameSync(packed.context, file);
  const brief = 'You were started from Fabric Dashboards\' New agent button to create a new Fabric agent with this person. '
    + `The steps are in ${file}; the fabric-dashboards MCP server is loaded in this session. `
    + 'Run every command yourself; ask the person only for decisions, consents, sign-ins and secrets, one question at a time.';
  const prompt = `Read ${file} and let's create a new agent together.`;
  const claude = o.runtimeId === 'claude-code';
  const h = handoffArgs(o.runtimeId, { mcp: packed.mcp, mcpServer: o.server, brief: { inline: claude ? brief : prompt }, task: null });
  return { handoff: { before: h.before, after: claude ? [prompt] : h.after }, env: { FABRIC_DASHBOARDS_NEW_AGENT: file }, file };
}

export const homeFolder = () => os.homedir();
// #endregion new-session
